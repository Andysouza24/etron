// Author(s): Rhys Cleary, Holly Wyatt
// CSV schema preview & confirmation flow.

const dataSourceRepo = require("@etron/day-book-shared/repositories/dataSourceRepository");
const dataSourceSecretsRepo = require("@etron/data-sources-shared/repositories/dataSourceSecretsRepository");
const { appendToStoredData, replaceStoredData } = require("@etron/data-sources-shared/repositories/dataBucketRepository");
const { validateFormat } = require("@etron/data-sources-shared/utils/validateFormat");
const { translateData } = require("@etron/data-sources-shared/utils/translateData");
const { toParquet } = require("@etron/data-sources-shared/utils/typeConversion");
const { generateSchema, detectNumericType, saveSchemaAndUpdateTable } = require("@etron/data-sources-shared/utils/schema");
const { castDataToSchema } = require("@etron/data-sources-shared/utils/castDataToSchema");
const { validateWorkspaceId } = require("@etron/shared/utils/validation");
const { detectDateFormat } = require("@etron/data-sources-shared/utils/dateParser");

const { PERMISSIONS, requirePermission, requireEnabled, resolveAndValidateAdapter } = require("./helpers");

// build schema preview from already-translated row data
// ({ schema, sampleData, totalRows, isEmpty })
// an empty file is not an error - the wizard surfaces an empty state so the user can still create the data source
// fields will be reviewed when data appears
function buildSchemaPreviewFromTranslated(translatedData) {
    if (!Array.isArray(translatedData) || translatedData.length === 0) {
        return { schema: [], sampleData: [], totalRows: 0, isEmpty: true };
    }

    const { valid, error } = validateFormat(translatedData);
    if (!valid) throw new Error(`Invalid data format: ${error}`);

    const schema = generateSchema(translatedData.slice(0, 100));

    // suggest numeric sub-types for any dimensions that look numeric
    for (const column of schema) {
        if (column.category === "dimension") {
            const values = translatedData.slice(0, 100).map(row => row[column.name]);
            const numericType = detectNumericType(values, column.name);
            if (numericType) {
                column.suggestedValueType = numericType;
            }
        }
    }

    return {
        schema,
        sampleData: translatedData.slice(0, 10),
        totalRows: translatedData.length,
        isEmpty: false,
    };
}

// preview the auto-detected schema for uploaded CSV data
// returns the schema with categories (date/value/dimension) and a sample of data
// user can review and adjust field categories before confirming
async function previewSchema(authUserId, payload) {
    const { workspaceId, rawData } = payload;
    await validateWorkspaceId(workspaceId);
    await requirePermission(authUserId, workspaceId, PERMISSIONS.MANAGE_DATASOURCES);

    if (!rawData) {
        throw new Error("No data provided for preview");
    }

    const translatedData = translateData(rawData);
    return buildSchemaPreviewFromTranslated(translatedData);
}

// Preview the auto-detected schema for an already-created remote data source.
// The source must exist (typically created with `pendingSetup: true`) and have
// valid config + secrets. The adapter polls a sample from the live source so
// the wizard can show the same field-review UI used by CSV.
async function previewSchemaForSource(authUserId, dataSourceId, payload) {
    const { workspaceId } = payload;
    await validateWorkspaceId(workspaceId);
    await requirePermission(authUserId, workspaceId, PERMISSIONS.MANAGE_DATASOURCES);

    if (!dataSourceId || typeof dataSourceId !== "string") {
        throw new Error("dataSourceId must be a UUID, 'string'");
    }

    const dataSource = await dataSourceRepo.getDataSourceById(workspaceId, dataSourceId);
    if (!dataSource) throw new Error(`Data source not found: ${dataSourceId}`);
    requireEnabled(dataSource);

    // dashboard file children (micromax-dashboard-file, test-connection-file)
    // don't expose a poll() method - the file is delivered to S3 by an
    // external pipeline and the wizard reads the raw JSON directly for the
    // schema preview
    const { isFileSourceType } = require("./dashboardRawData");
    if (isFileSourceType(dataSource.sourceType)) {
        const { readMicromaxDashboardFileRawData } = require("./dashboardRawData");
        const { normaliseHeterogeneousRows } = require("@etron/data-sources-shared/utils/normaliseRows");
        const { sanitiseMicromaxDashboardData } = require("@etron/data-sources-shared/utils/sanitiseMicromaxDashboardData");
        const rawData = await readMicromaxDashboardFileRawData(workspaceId, dataSource);
        // mirror the transform pipeline:
        // unwrap dashboard envelopes / flatten nested objects, then normalise to the union of keys before schema inference
        const { rows: sanitisedRows, groupHints } = sanitiseMicromaxDashboardData(rawData);
        const translatedData = normaliseHeterogeneousRows(translateData(sanitisedRows));
        const preview = buildSchemaPreviewFromTranslated(translatedData);
        // stamp the original parent key on every column that came from a flattened nested object so the field-review UI can group them
        if (groupHints && Object.keys(groupHints).length > 0 && Array.isArray(preview.schema)) {
            for (const column of preview.schema) {
                if (groupHints[column.name]) column.group = groupHints[column.name];
            }
        }
        return preview;
    }

    const secrets = await dataSourceSecretsRepo.getSecrets(workspaceId, dataSourceId);
    const adapter = resolveAndValidateAdapter(dataSource.sourceType, {
        config: dataSource.config,
        secrets,
    });

    if (typeof adapter.poll !== "function") {
        throw new Error(`Source type "${dataSource.sourceType}" does not support schema preview`);
    }

    const data = await adapter.poll(dataSource.config, secrets);
    const translatedData = translateData(data);
    return buildSchemaPreviewFromTranslated(translatedData);
}

// Resolve a single column's final schema entry given the user-confirmed category.
// Pure function — takes the auto-detected column, the user's override, and a sample of
// the translated data (used for on-demand date-format / numeric-type detection).
function resolveColumnForCategory(col, userCol, translatedData) {
    if (!userCol) return col;
    const toCat = userCol.category || col.category;

    // --- DATE ---
    if (toCat === "date") {
        if (userCol.userDateFormat) {
            return { name: col.name, type: "timestamp", category: "date", userDateFormat: userCol.userDateFormat };
        }
        if (col.type === "timestamp" && col.dateFormat) {
            return col;
        }
        const dateValues = translatedData.slice(0, 100).map(row => row[col.name]);
        const dateFormat = detectDateFormat(dateValues);
        if (dateFormat) {
            return { name: col.name, type: "timestamp", category: "date", dateFormat };
        }
        // Try native JS Date parsing as fallback
        const testValues = dateValues.filter(v => v != null && String(v).trim() !== "").slice(0, 10);
        const canParse = testValues.length > 0 && testValues.every(v => !isNaN(new Date(v).getTime()));
        if (canParse) {
            return { name: col.name, type: "timestamp", category: "date" };
        }
        // cannot convert — keep original type but mark category
        return { ...col, category: "date" };
    }

    // --- VALUE ---
    if (toCat === "value") {
        if (col.category === "value") {
            if (userCol.type && userCol.type !== col.type) {
                return { name: col.name, type: userCol.type, category: "value" };
            }
            return col;
        }
        const numValues = translatedData.slice(0, 100).map(row => row[col.name]);
        const detectedType = detectNumericType(numValues, col.name);
        const newType = userCol.type || detectedType || "double";
        return { name: col.name, type: newType, category: "value" };
    }

    // --- DIMENSION ---
    if (toCat === "dimension") {
        if (col.category === "dimension") return col;
        return { name: col.name, type: "string", category: "dimension" };
    }

    return col;
}

// re-resolve types/dateFormat against fresh data so date columns get cast to timestamp
function buildResolvedSchemaFromConfirmed(translatedData, confirmedSchema) {
    if (!Array.isArray(translatedData) || translatedData.length === 0) {
        return Array.isArray(confirmedSchema) ? confirmedSchema : [];
    }
    const autoSchema = generateSchema(translatedData.slice(0, 100));
    return autoSchema.map(col => {
        const userCol = Array.isArray(confirmedSchema)
            ? confirmedSchema.find(c => c.name === col.name)
            : null;
        const resolved = resolveColumnForCategory(col, userCol, translatedData);
        // carry the field-grouping hint (set by the sanitiser during preview) through to the saved schema
        const group = userCol?.group || col.group;
        if (group && resolved && typeof resolved === "object" && !resolved.group) {
            resolved.group = group;
        }
        return resolved;
    });
}

// Confirm and process the schema after the user has reviewed/adjusted field categories.
// Takes the user's confirmed schema (with category overrides) and processes the upload.
async function confirmSchemaAndProcess(authUserId, dataSourceId, payload) {
    const { workspaceId, confirmedSchema, rawData } = payload;
    await validateWorkspaceId(workspaceId);
    await requirePermission(authUserId, workspaceId, PERMISSIONS.MANAGE_DATASOURCES);

    const dataSource = await dataSourceRepo.getDataSourceById(workspaceId, dataSourceId);
    if (!dataSource) {
        throw new Error(`Data source not found: ${dataSourceId}`);
    }
    requireEnabled(dataSource);

    if (!confirmedSchema || !Array.isArray(confirmedSchema) || confirmedSchema.length === 0) {
        throw new Error("Confirmed schema is required");
    }

    if (!rawData) {
        throw new Error("No data provided");
    }

    try {
        await dataSourceRepo.updateDataSourceStatus(workspaceId, dataSourceId, {
            status: "processing",
            errorMessage: null,
            progressStage: "Translating data",
            progressPercent: 15,
        });
        const translatedData = translateData(rawData);

        if (translatedData.length === 0) {
            await dataSourceRepo.updateDataSourceStatus(workspaceId, dataSourceId, {
                status: "no_data",
                errorMessage: "No data existent",
            });
            return { success: false };
        }

        await dataSourceRepo.updateDataSourceProgress(workspaceId, dataSourceId, { stage: "Validating format", percent: 30 });
        const { valid, error } = validateFormat(translatedData);
        if (!valid) throw new Error(`Invalid data format: ${error}`);

        await dataSourceRepo.updateDataSourceProgress(workspaceId, dataSourceId, { stage: "Generating schema", percent: 45 });
        const finalSchema = buildResolvedSchemaFromConfirmed(translatedData, confirmedSchema);

        await dataSourceRepo.updateDataSourceProgress(workspaceId, dataSourceId, { stage: "Casting rows", percent: 60 });
        const castedData = castDataToSchema(translatedData, finalSchema);

        await dataSourceRepo.updateDataSourceProgress(workspaceId, dataSourceId, { stage: "Writing parquet", percent: 75 });
        const parquetBuffer = await toParquet(castedData, finalSchema);

        await dataSourceRepo.updateDataSourceProgress(workspaceId, dataSourceId, { stage: "Saving data", percent: 85 });
        if (dataSource.method === "extend") {
            await appendToStoredData(workspaceId, dataSourceId, castedData, finalSchema);
        } else {
            await replaceStoredData(workspaceId, dataSourceId, parquetBuffer);
        }

        await dataSourceRepo.updateDataSourceProgress(workspaceId, dataSourceId, { stage: "Finalising", percent: 95 });
        await saveSchemaAndUpdateTable(workspaceId, dataSourceId, finalSchema);

        await dataSourceRepo.updateDataSourceStatus(workspaceId, dataSourceId, {
            status: "active",
            errorMessage: null,
        });

        return { success: true, schema: finalSchema };
    } catch (error) {
        await dataSourceRepo.updateDataSourceStatus(workspaceId, dataSourceId, {
            status: "error",
            errorMessage: error.message,
        });
        throw error;
    }
}

module.exports = {
    previewSchema,
    previewSchemaForSource,
    confirmSchemaAndProcess,
    resolveColumnForCategory,
    buildResolvedSchemaFromConfirmed,
};
