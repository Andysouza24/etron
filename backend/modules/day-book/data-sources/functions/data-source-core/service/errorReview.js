// Author(s): Rhys Cleary, Holly Wyatt
// Error-review flow for data sources stuck in the "error" state.
//
//  getErrorContext      - reads the stored schema, the temp schema, and a
//                         sample of pending temp rows so the UI can surface
//                         what changed and let the user revise the schema.
//
//  resolveError         - applies a user-confirmed revised schema. Existing
//                         stored rows and any pending temp rows are translated
//                         into the new schema (preserving original timestamp
//                         and rowId), written back to the main partition,
//                         the temp store is cleared, and the source returns
//                         to "active".

const dataSourceRepo = require("@etron/day-book-shared/repositories/dataSourceRepository");
const {
    getDataSchema,
    getTempSchema,
    clearTempSchema,
    clearTempStoredData,
    readAllStoredRows,
    readAllTempStoredRows,
    replaceStoredData,
} = require("@etron/data-sources-shared/repositories/dataBucketRepository");
const { saveSchemaAndUpdateTable } = require("@etron/data-sources-shared/utils/schema");
const { suggestRevisedSchema, isReservedField } = require("@etron/data-sources-shared/utils/schemaDrift");
const { castDataToSchema } = require("@etron/data-sources-shared/utils/castDataToSchema");
const { toParquet } = require("@etron/data-sources-shared/utils/typeConversion");
const { validateWorkspaceId } = require("@etron/shared/utils/validation");
const { getDefaultDashboardSchema } = require("@etron/data-sources-shared/utils/defaultDashboardSchemas");
const { v4: uuidv4 } = require("uuid");

const { PERMISSIONS, requirePermission, requireEnabled } = require("./helpers");

// returns a summary of what is wrong with this data source plus enough
// information for the frontend to render the "revise schema" UI.
async function getErrorContext(authUserId, dataSourceId, payload) {
    const { workspaceId } = payload || {};
    await validateWorkspaceId(workspaceId);
    await requirePermission(authUserId, workspaceId, PERMISSIONS.MANAGE_DATASOURCES);

    if (!dataSourceId || typeof dataSourceId !== "string") {
        throw new Error("dataSourceId must be a UUID, 'string'");
    }

    const dataSource = await dataSourceRepo.getDataSourceById(workspaceId, dataSourceId);
    if (!dataSource) throw new Error(`Data source not found: ${dataSourceId}`);
    requireEnabled(dataSource);

    const oldSchema = (await getDataSchema(workspaceId, dataSourceId)) || [];
    const tempSchema = (await getTempSchema(workspaceId, dataSourceId)) || [];
    const tempRows = await readAllTempStoredRows(workspaceId, dataSourceId, tempSchema).catch(() => []);

    const suggestedSchema = suggestRevisedSchema(oldSchema, tempRows);

    // include up to 10 sample rows so the user can see what's blocking ingest.
    const sampleRows = Array.isArray(tempRows) ? tempRows.slice(0, 10) : [];

    return {
        status: dataSource.status,
        errorType: dataSource.errorType || null,
        errorMessage: dataSource.errorMessage || null,
        oldSchema: oldSchema.filter((c) => !isReservedField(c.name)),
        tempSchema: tempSchema.filter((c) => !isReservedField(c.name)),
        suggestedSchema,
        sampleRows,
        tempRowCount: Array.isArray(tempRows) ? tempRows.length : 0,
    };
}

// Apply a user-confirmed schema, retranslate every existing + pending row to
// the new schema (preserving timestamp/rowId where present), write the merged
// dataset back to the main partition, and clear the temp store.
async function resolveError(authUserId, dataSourceId, payload) {
    const { workspaceId, confirmedSchema } = payload || {};
    await validateWorkspaceId(workspaceId);
    await requirePermission(authUserId, workspaceId, PERMISSIONS.MANAGE_DATASOURCES);

    if (!dataSourceId || typeof dataSourceId !== "string") {
        throw new Error("dataSourceId must be a UUID, 'string'");
    }
    if (!Array.isArray(confirmedSchema) || confirmedSchema.length === 0) {
        throw new Error("confirmedSchema must be a non-empty array");
    }

    const dataSource = await dataSourceRepo.getDataSourceById(workspaceId, dataSourceId);
    if (!dataSource) throw new Error(`Data source not found: ${dataSourceId}`);
    requireEnabled(dataSource);

    // strip any reserved entries the client included, then re-attach the
    // canonical reserved columns. This stops a malformed UI submission from
    // breaking parquet writes.
    const userColumns = confirmedSchema
        .filter((c) => c && typeof c.name === "string" && !isReservedField(c.name))
        .map((c) => normaliseColumn(c));
    const finalSchema = [
        ...userColumns,
        { name: "timestamp", type: "timestamp", category: "date" },
        { name: "rowId", type: "string", category: "dimension" },
    ];

    await dataSourceRepo.updateDataSourceStatus(workspaceId, dataSourceId, {
        status: "processing",
        errorMessage: null,
        errorType: null,
        progressStage: "Reapplying schema",
        progressPercent: 10,
    });

    try {
        // need to load the old + temp schemas to be able to parse the parquet
        // partitions. Both can be empty (eg. an error on the first ingest), in
        // which case we just skip the corresponding read.
        const [oldSchema, tempSchema] = await Promise.all([
            getDataSchema(workspaceId, dataSourceId).then((s) => s || []),
            getTempSchema(workspaceId, dataSourceId).then((s) => s || []),
        ]);

        // load both the previously-good rows and the pending temp rows. Each
        // call is best-effort - a missing partition is treated as no rows.
        const [existingRows, pendingRows] = await Promise.all([
            readAllStoredRows(workspaceId, dataSourceId, oldSchema).catch(() => []),
            readAllTempStoredRows(workspaceId, dataSourceId, tempSchema).catch(() => []),
        ]);

        await dataSourceRepo.updateDataSourceProgress(workspaceId, dataSourceId, { stage: "Translating rows", percent: 35 });
        const allRows = [
            ...((Array.isArray(existingRows) ? existingRows : []).map(stampRowDefaults)),
            ...((Array.isArray(pendingRows) ? pendingRows : []).map(stampRowDefaults)),
        ];

        await dataSourceRepo.updateDataSourceProgress(workspaceId, dataSourceId, { stage: "Casting rows", percent: 55 });
        const castedRows = castDataToSchema(allRows, finalSchema);

        await dataSourceRepo.updateDataSourceProgress(workspaceId, dataSourceId, { stage: "Writing parquet", percent: 75 });
        const parquetBuffer = await toParquet(castedRows, finalSchema);

        await dataSourceRepo.updateDataSourceProgress(workspaceId, dataSourceId, { stage: "Saving data", percent: 85 });
        // resolve always overwrites - the merged dataset is the new source of truth.
        await replaceStoredData(workspaceId, dataSourceId, parquetBuffer);

        await dataSourceRepo.updateDataSourceProgress(workspaceId, dataSourceId, { stage: "Finalising", percent: 95 });
        await saveSchemaAndUpdateTable(workspaceId, dataSourceId, finalSchema);

        // tear down the temp store so the next ingest cycle starts clean.
        await clearTempStoredData(workspaceId, dataSourceId).catch(() => {});
        await clearTempSchema(workspaceId, dataSourceId).catch(() => {});

        await dataSourceRepo.updateDataSourceStatus(workspaceId, dataSourceId, {
            status: "active",
            errorMessage: null,
            errorType: null,
            requiresReview: false,
        });

        return { success: true, mergedRowCount: castedRows.length };
    } catch (err) {
        console.error(`[ResolveError] failed for ${workspaceId}/${dataSourceId}:`, err);
        // leave the data source in error - the temp store is still intact so
        // the user can retry without losing any pending data.
        await dataSourceRepo.updateDataSourceStatus(workspaceId, dataSourceId, {
            status: "error",
            errorMessage: `Failed to apply revised schema: ${err.message || err}`,
            errorType: "resolve",
        });
        throw err;
    }
}

// Strips client-supplied junk (isNew, suggestedType, etc.) before persisting.
function normaliseColumn(col) {
    const out = {
        name: col.name,
        type: col.type || "string",
        category: col.category || "dimension",
    };
    if (col.dateFormat) out.dateFormat = col.dateFormat;
    if (col.userDateFormat) out.userDateFormat = col.userDateFormat;
    if (col.currencySymbol) out.currencySymbol = col.currencySymbol;
    if (col.group) out.group = col.group;
    return out;
}

// rows pulled from parquet sometimes lack timestamp/rowId (e.g. older data
// migrated from before stamping was added). Stamp the defaults rather than
// dropping the row.
function stampRowDefaults(row) {
    if (!row || typeof row !== "object") return row;
    if (!row.timestamp) row.timestamp = new Date().toISOString();
    if (!row.rowId) row.rowId = uuidv4();
    return row;
}

// Re-applies the bundled default schema for this data source (matched by
// `config.fileName`) merged with whatever columns are already stored. Useful
// when an older data source was created before the default-schema feature
// existed and is now hitting schema drift for fields the default already
// declares. Existing column types are preserved; missing columns from the
// default are appended. Internally calls `resolveError` so the existing
// rebuild path (temp store merge, parquet rewrite, Glue update, status
// reset) is reused unchanged.
async function refreshFromDefaultSchema(authUserId, dataSourceId, payload) {
    const { workspaceId } = payload || {};
    await validateWorkspaceId(workspaceId);
    await requirePermission(authUserId, workspaceId, PERMISSIONS.MANAGE_DATASOURCES);

    if (!dataSourceId || typeof dataSourceId !== "string") {
        throw new Error("dataSourceId must be a UUID, 'string'");
    }

    const dataSource = await dataSourceRepo.getDataSourceById(workspaceId, dataSourceId);
    if (!dataSource) throw new Error(`Data source not found: ${dataSourceId}`);
    requireEnabled(dataSource);

    const fileName = dataSource?.config?.fileName;
    const defaultSchema = getDefaultDashboardSchema(fileName);
    if (!Array.isArray(defaultSchema) || defaultSchema.length === 0) {
        throw new Error(
            "No default schema available for this data source. Use the revise-schema flow to confirm fields manually.",
        );
    }

    const currentSchema = (await getDataSchema(workspaceId, dataSourceId)) || [];

    // build a merged schema: existing columns keep their stored type (so any
    // user-revised types stick around), then any default columns not already
    // present are appended.
    const seen = new Map();
    for (const col of currentSchema) {
        if (!col || typeof col.name !== "string") continue;
        if (isReservedField(col.name)) continue;
        seen.set(col.name, col);
    }
    for (const col of defaultSchema) {
        if (!col || typeof col.name !== "string") continue;
        if (isReservedField(col.name)) continue;
        if (seen.has(col.name)) continue;
        seen.set(col.name, col);
    }

    const mergedSchema = [...seen.values()];
    if (mergedSchema.length === 0) {
        throw new Error("Default schema produced no usable columns.");
    }

    return resolveError(authUserId, dataSourceId, { workspaceId, confirmedSchema: mergedSchema });
}

module.exports = {
    getErrorContext,
    resolveError,
    refreshFromDefaultSchema,
};
