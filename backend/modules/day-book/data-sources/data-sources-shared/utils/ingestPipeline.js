// Author: shared ingest pipeline used by the file-upload processor, the
// dashboard transform Lambda, and the scheduled polling Lambda.
//
// The pipeline takes raw data destined for a data source and walks it through
// translate -> validate -> generate/load schema -> cast -> store. Around the
// happy path it adds the following safety nets:
//
//   1. First-ingest with no stored schema:
//        - all fields are saved as string-dimension columns
//        - the data is stored normally (main schema + /data/ prefix)
//        - status becomes "pending_review" so the UI nags the user to
//          confirm a real schema later.
//
//   2. Stored schema exists, fresh data drifts (new columns, or values stop
//      casting cleanly to stored types):
//        - the main schema + /data/ prefix stay frozen so existing metrics
//          keep working against the last good shape
//        - a permissive all-string "temp schema" is saved at /temp-schema.json
//        - the fresh rows are appended (or overwritten) under /temp-data/ as
//          strings, preserving timestamp + rowId
//        - status becomes "error" with errorType: "schema_drift". lastUpdate
//          still ticks so dashboards see the source is alive.
//
//   3. Stored schema exists but processing fails for any other reason
//      (JSON parse, validation, parquet write, etc.):
//        - main schema + /data/ stay frozen
//        - the original raw payload is best-effort stored under /temp-data/
//          (as a single column "rawJson") so the timestamp stays fresh
//        - status becomes "error" with errorType: "json" (JSON parse failure)
//          or "processing" (anything else).
//
//   4. Happy path:
//        - any /temp-data/ + /temp-schema.json from a previous error are
//          cleared
//        - status becomes "active", errorType + errorMessage cleared.

const { v4: uuidv4 } = require("uuid");

const {
    appendToStoredData,
    appendNewToStoredData,
    replaceStoredData,
    appendToTempStoredData,
    replaceTempStoredData,
    clearTempStoredData,
    clearTempSchema,
    saveTempSchema,
    getDataSchema,
    saveSchema,
} = require("../repositories/dataBucketRepository");
const dataSourceRepo = require("@etron/day-book-shared/repositories/dataSourceRepository");
const { generateSchema, saveSchemaAndUpdateTable } = require("./schema");
const { translateData } = require("./translateData");
const { validateFormat } = require("./validateFormat");
const { toParquet } = require("./typeConversion");
const { castDataToSchema } = require("./castDataToSchema");
const { buildStringSchema, detectSchemaDrift } = require("./schemaDrift");

// classification of the error so the UI can surface a useful banner.
const ERROR_TYPES = {
    JSON: "json",
    SCHEMA_DRIFT: "schema_drift",
    PROCESSING: "processing",
};

// run the storage step using the data source's configured method.
async function storeData(dataSource, workspaceId, dataSourceId, castedData, schema, parquetBuffer) {
    if (dataSource.method === "append-new") {
        await appendNewToStoredData(workspaceId, dataSourceId, castedData, schema);
    } else if (dataSource.method === "extend") {
        await appendToStoredData(workspaceId, dataSourceId, castedData, schema);
    } else {
        await replaceStoredData(workspaceId, dataSourceId, parquetBuffer);
    }
}

// Save fresh data to the temp prefix using a string schema. Falls back to a
// single rawJson column if the rows are not object-shaped.
async function storeTempData(dataSource, workspaceId, dataSourceId, rows, schema) {
    if (!Array.isArray(rows) || rows.length === 0) return;
    // when called from the error path the rows may already include timestamp /
    // rowId from translateData; if not, stamp them now so the temp store stays
    // consistent with the main store.
    const stamped = rows.map((row) => {
        if (row && typeof row === "object" && !Array.isArray(row)) {
            return {
                ...row,
                timestamp: row.timestamp || new Date().toISOString(),
                rowId: row.rowId || uuidv4(),
            };
        }
        return {
            rawJson: typeof row === "string" ? row : JSON.stringify(row),
            timestamp: new Date().toISOString(),
            rowId: uuidv4(),
        };
    });

    // cast every value to string against the temp schema so parquet
    // serialisation never throws while we're already in an error state.
    const stringRows = stamped.map((row) => {
        const out = {};
        for (const col of schema) {
            const v = row[col.name];
            out[col.name] = v == null ? null : String(v);
        }
        return out;
    });

    if (dataSource.method === "extend" || dataSource.method === "append-new") {
        await appendToTempStoredData(workspaceId, dataSourceId, stringRows, schema);
    } else {
        await replaceTempStoredData(workspaceId, dataSourceId, stringRows, schema);
    }
}

async function recordError(workspaceId, dataSourceId, errorType, message, broadcastOpts) {
    try {
        await dataSourceRepo.updateDataSourceStatus(
            workspaceId,
            dataSourceId,
            { status: "error", errorMessage: message, errorType },
            broadcastOpts,
        );
    } catch (err) {
        console.warn(
            `[ingestPipeline] failed to record error for ${workspaceId}/${dataSourceId}:`,
            err.message,
        );
    }
}

// rawData: anything translateData understands (string, array, object)
// options:
//   buildErrorMessage(error, rawData) - optional custom error formatter
//   silent - skip per-step AppSync broadcasts (used by dashboard bulk setup)
//   logPrefix - log tag, e.g. "[FileUpload]"
//   applyColumnHints(schema) - optional, called after the first-ingest string
//      schema is built; may decorate columns with group hints, etc.
//   onSuccess(result) - optional, called after a successful ingest (used by
//      dashboard bulk setup to bump aggregate progress on the parent)
//   onFailure(result) - optional, called after an unsuccessful ingest
async function safeProcessIngest(workspaceId, dataSource, rawData, options = {}) {
    const dataSourceId = dataSource.dataSourceId;
    const { silent = false, logPrefix = "[ingestPipeline]" } = options;
    const broadcastOpts = { silent };
    const buildErrorMessage = options.buildErrorMessage
        || ((error) => (error && error.message) ? error.message : String(error));

    await dataSourceRepo.updateDataSourceStatus(workspaceId, dataSourceId, {
        status: "processing",
        errorMessage: null,
        errorType: null,
        progressStage: "Queued",
        progressPercent: 5,
    }, broadcastOpts).catch((err) => {
        console.warn(`${logPrefix} could not mark processing for ${workspaceId}/${dataSourceId}:`, err.message);
    });

    // --- translate ---
    let translatedData;
    try {
        await dataSourceRepo.updateDataSourceProgress(workspaceId, dataSourceId, { stage: "Translating data", percent: 15 }, broadcastOpts);
        translatedData = translateData(rawData);
    } catch (error) {
        // translation failure is almost always a JSON / format problem.
        const message = buildErrorMessage(error, rawData);
        console.error(`${logPrefix} translate failed for ${workspaceId}/${dataSourceId}:`, message);
        await handleErrorWithTempStore({
            workspaceId,
            dataSource,
            errorType: ERROR_TYPES.JSON,
            errorMessage: message,
            // best-effort - if we got partial rows out, store them; otherwise stamp the raw payload.
            rowsForTempStore: Array.isArray(translatedData) ? translatedData : [{ rawJson: typeof rawData === "string" ? rawData : safeStringify(rawData) }],
            broadcastOpts,
            logPrefix,
        });
        const result = { success: false, errorType: ERROR_TYPES.JSON };
        if (typeof options.onFailure === "function") {
            try { await options.onFailure(result); } catch (err) { console.warn(`${logPrefix} onFailure hook failed:`, err.message); }
        }
        return result;
    }

    if (!Array.isArray(translatedData) || translatedData.length === 0) {
        await dataSourceRepo.updateDataSourceStatus(workspaceId, dataSourceId, {
            status: "no_data",
            errorMessage: "No data existent",
            errorType: null,
        }, broadcastOpts);
        const result = { success: false, empty: true };
        if (typeof options.onFailure === "function") {
            try { await options.onFailure(result); } catch (err) { console.warn(`${logPrefix} onFailure hook failed:`, err.message); }
        }
        return result;
    }

    // --- validate ---
    const { valid, error: validationError } = validateFormat(translatedData);
    if (!valid) {
        const message = `Invalid data format: ${validationError}`;
        console.error(`${logPrefix} validate failed for ${workspaceId}/${dataSourceId}:`, message);
        await handleErrorWithTempStore({
            workspaceId,
            dataSource,
            errorType: ERROR_TYPES.PROCESSING,
            errorMessage: message,
            rowsForTempStore: translatedData,
            broadcastOpts,
            logPrefix,
        });
        const result = { success: false, errorType: ERROR_TYPES.PROCESSING };
        if (typeof options.onFailure === "function") {
            try { await options.onFailure(result); } catch (err) { console.warn(`${logPrefix} onFailure hook failed:`, err.message); }
        }
        return result;
    }

    // --- determine schema ---
    const existingSchema = await getDataSchema(workspaceId, dataSourceId);
    const hadStoredSchema = Array.isArray(existingSchema) && existingSchema.length > 0;

    if (!hadStoredSchema) {
        // first ingest - persist an all-string schema so every column is
        // captured. Status goes to "pending_review" so the UI can prompt the
        // user to refine the schema later.
        const result = await runFirstIngest({
            workspaceId,
            dataSource,
            translatedData,
            broadcastOpts,
            logPrefix,
            applyColumnHints: options.applyColumnHints,
        });
        if (result.success && typeof options.onSuccess === "function") {
            try { await options.onSuccess(result); } catch (err) { console.warn(`${logPrefix} onSuccess hook failed:`, err.message); }
        } else if (!result.success && typeof options.onFailure === "function") {
            try { await options.onFailure(result); } catch (err) { console.warn(`${logPrefix} onFailure hook failed:`, err.message); }
        }
        return result;
    }

    // existing schema - check for drift
    const drift = detectSchemaDrift(existingSchema, translatedData);
    if (drift.drifted) {
        const reason = describeDrift(drift);
        const message = `Schema drift detected: ${reason}`;
        console.warn(`${logPrefix} schema drift for ${workspaceId}/${dataSourceId}: ${reason}`);
        await handleErrorWithTempStore({
            workspaceId,
            dataSource,
            errorType: ERROR_TYPES.SCHEMA_DRIFT,
            errorMessage: message,
            rowsForTempStore: translatedData,
            broadcastOpts,
            logPrefix,
            drift,
        });
        const result = { success: false, errorType: ERROR_TYPES.SCHEMA_DRIFT, drift };
        if (typeof options.onFailure === "function") {
            try { await options.onFailure(result); } catch (err) { console.warn(`${logPrefix} onFailure hook failed:`, err.message); }
        }
        return result;
    }

    // --- happy path: cast + store under existing schema ---
    try {
        await dataSourceRepo.updateDataSourceProgress(workspaceId, dataSourceId, { stage: "Casting rows", percent: 60 }, broadcastOpts);
        const castedData = castDataToSchema(translatedData, existingSchema);

        await dataSourceRepo.updateDataSourceProgress(workspaceId, dataSourceId, { stage: "Writing parquet", percent: 75 }, broadcastOpts);
        const parquetBuffer = await toParquet(castedData, existingSchema);

        await dataSourceRepo.updateDataSourceProgress(workspaceId, dataSourceId, { stage: "Saving data", percent: 85 }, broadcastOpts);
        await storeData(dataSource, workspaceId, dataSourceId, castedData, existingSchema, parquetBuffer);

        await dataSourceRepo.updateDataSourceProgress(workspaceId, dataSourceId, { stage: "Finalising", percent: 95 }, broadcastOpts);
        await saveSchemaAndUpdateTable(workspaceId, dataSourceId, existingSchema);

        // success - flush any stale temp store / schema from a prior error.
        await clearTempStoredData(workspaceId, dataSourceId).catch(() => {});
        await clearTempSchema(workspaceId, dataSourceId).catch(() => {});

        await dataSourceRepo.updateDataSourceStatus(workspaceId, dataSourceId, {
            status: "active",
            errorMessage: null,
            errorType: null,
            // a successful ingest against the stored schema means the data
            // matches what we expect - clear any lingering "needs review"
            // flag from a previous auto-inferred / first-ingest schema so
            // the source drops out of the Schema Review UI bucket.
            requiresReview: false,
        }, broadcastOpts);

        const result = { success: true };
        if (typeof options.onSuccess === "function") {
            try { await options.onSuccess(result); } catch (err) { console.warn(`${logPrefix} onSuccess hook failed:`, err.message); }
        }
        return result;
    } catch (error) {
        const message = buildErrorMessage(error, rawData);
        console.error(`${logPrefix} processing failed for ${workspaceId}/${dataSourceId}:`, message);
        await handleErrorWithTempStore({
            workspaceId,
            dataSource,
            errorType: ERROR_TYPES.PROCESSING,
            errorMessage: message,
            rowsForTempStore: translatedData,
            broadcastOpts,
            logPrefix,
        });
        const result = { success: false, errorType: ERROR_TYPES.PROCESSING };
        if (typeof options.onFailure === "function") {
            try { await options.onFailure(result); } catch (err) { console.warn(`${logPrefix} onFailure hook failed:`, err.message); }
        }
        return result;
    }
}

// First-ingest path - no stored schema yet. We save the data with an all-string
// schema and mark the source pending_review so the user can refine field types
// without losing any data in the meantime.
async function runFirstIngest({ workspaceId, dataSource, translatedData, broadcastOpts, logPrefix, applyColumnHints }) {
    const dataSourceId = dataSource.dataSourceId;
    const schema = buildStringSchema(translatedData);
    // include reserved columns so parquet stores timestamp/rowId
    const schemaWithReserved = [
        ...schema,
        { name: "timestamp", type: "timestamp", category: "date" },
        { name: "rowId", type: "string", category: "dimension" },
    ];
    if (typeof applyColumnHints === "function") {
        try { applyColumnHints(schemaWithReserved); } catch (err) {
            console.warn(`${logPrefix} applyColumnHints failed:`, err.message);
        }
    }

    try {
        await dataSourceRepo.updateDataSourceProgress(workspaceId, dataSourceId, { stage: "Casting rows", percent: 60 }, broadcastOpts);
        const casted = castDataToSchema(translatedData, schemaWithReserved);

        await dataSourceRepo.updateDataSourceProgress(workspaceId, dataSourceId, { stage: "Writing parquet", percent: 75 }, broadcastOpts);
        const parquetBuffer = await toParquet(casted, schemaWithReserved);

        await dataSourceRepo.updateDataSourceProgress(workspaceId, dataSourceId, { stage: "Saving data", percent: 85 }, broadcastOpts);
        await storeData(dataSource, workspaceId, dataSourceId, casted, schemaWithReserved, parquetBuffer);

        await dataSourceRepo.updateDataSourceProgress(workspaceId, dataSourceId, { stage: "Finalising", percent: 95 }, broadcastOpts);
        await saveSchemaAndUpdateTable(workspaceId, dataSourceId, schemaWithReserved);

        await dataSourceRepo.updateDataSourceStatus(workspaceId, dataSourceId, {
            status: "pending_review",
            errorMessage: null,
            errorType: null,
            requiresReview: true,
        }, broadcastOpts);

        return { success: true, firstIngest: true };
    } catch (error) {
        const message = `First-ingest failure: ${error.message || error}`;
        console.error(`${logPrefix} first-ingest failed for ${workspaceId}/${dataSourceId}:`, message);
        // no stored schema yet, so just record the error - nothing to protect.
        await recordError(workspaceId, dataSourceId, ERROR_TYPES.PROCESSING, message, broadcastOpts);
        return { success: false, errorType: ERROR_TYPES.PROCESSING };
    }
}

// Error path. Persists a string-schema "temp schema", stores the fresh rows
// against /temp-data/, and updates status to error.
async function handleErrorWithTempStore({
    workspaceId,
    dataSource,
    errorType,
    errorMessage,
    rowsForTempStore,
    broadcastOpts,
    logPrefix,
}) {
    const dataSourceId = dataSource.dataSourceId;
    try {
        const tempSchema = buildStringSchema(rowsForTempStore || []);
        const tempSchemaWithReserved = [
            ...tempSchema,
            { name: "timestamp", type: "timestamp", category: "date" },
            { name: "rowId", type: "string", category: "dimension" },
        ];
        if (tempSchemaWithReserved.length > 2) {
            await saveTempSchema(workspaceId, dataSourceId, tempSchemaWithReserved);
            await storeTempData(dataSource, workspaceId, dataSourceId, rowsForTempStore, tempSchemaWithReserved);
        }
    } catch (err) {
        console.warn(`${logPrefix} failed to write temp store for ${workspaceId}/${dataSourceId}:`, err.message);
    }
    await recordError(workspaceId, dataSourceId, errorType, errorMessage, broadcastOpts);
}

function describeDrift(drift) {
    const parts = [];
    if (drift.addedFields && drift.addedFields.length > 0) {
        parts.push(`new field${drift.addedFields.length === 1 ? "" : "s"}: ${drift.addedFields.join(", ")}`);
    }
    if (drift.changedFields && drift.changedFields.length > 0) {
        const names = drift.changedFields.map((f) => f.name).join(", ");
        parts.push(`incompatible values for ${names}`);
    }
    return parts.join("; ") || "schema changed";
}

function safeStringify(value) {
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

module.exports = {
    safeProcessIngest,
    ERROR_TYPES,
};
