// reuses same transform pipeline as the file upload processor
// kept as a thin wrapper so the SQS handler can call a single function

const { getDataSchema } = require('@etron/data-sources-shared/repositories/dataBucketRepository');
const { saveSchemaAndUpdateTable } = require('@etron/data-sources-shared/utils/schema');
const dataSourceRepo = require('@etron/day-book-shared/repositories/dataSourceRepository');
const { normaliseHeterogeneousRows } = require('@etron/data-sources-shared/utils/normaliseRows');
const { sanitiseMicromaxDashboardData } = require('@etron/data-sources-shared/utils/sanitiseMicromaxDashboardData');
const { safeProcessIngest } = require('@etron/data-sources-shared/utils/ingestPipeline');

// locates the 1-based line number of the rowIndex-th element of the first JSON array in rawText.
// Handles top-level arrays and `{ "rows": [...] }` / `{ "data": [...] }` envelopes (first '[' is the data array in both cases).
// Returns null when rawText is not a string, no array is found, or the index is out of bounds.
function findJsonRowLine(rawText, rowIndex) {
    if (typeof rawText !== 'string' || rowIndex == null || rowIndex < 0) return null;

    const arrayStart = locateFirstArrayBracket(rawText);
    if (arrayStart < 0) return null;

    let depth = 0;
    let inString = false;
    let escape = false;
    let elementsSeen = 0;

    for (let i = arrayStart + 1; i < rawText.length; i++) {
        const ch = rawText[i];

        if (inString) {
            if (escape) escape = false;
            else if (ch === '\\') escape = true;
            else if (ch === '"') inString = false;
            continue;
        }

        if (ch === '"') { inString = true; continue; }

        if (depth === 0) {
            if (ch === ']') return null;
            if (ch === '{' || ch === '[') {
                if (elementsSeen === rowIndex) return getLineNumber(rawText, i);
                elementsSeen++;
                depth++;
            }
            continue;
        }

        if (ch === '{' || ch === '[') depth++;
        else if (ch === '}' || ch === ']') depth--;
    }
    return null;
}

function locateFirstArrayBracket(text) {
    let inString = false;
    let escape = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (inString) {
            if (escape) escape = false;
            else if (ch === '\\') escape = true;
            else if (ch === '"') inString = false;
            continue;
        }
        if (ch === '"') { inString = true; continue; }
        if (ch === '[') return i;
    }
    return -1;
}

function getLineNumber(text, index) {
    let line = 1;
    for (let i = 0; i < index && i < text.length; i++) {
        if (text[i] === '\n') line++;
    }
    return line;
}

// builds an error message when the underlying error carries `rowIndex` / `columnName` context attached by toParquet
// falls back to the raw error message when no context is available
function buildDashboardErrorMessage(error, rawText) {
    const baseMessage = (error && error.message) ? error.message : String(error);
    if (!error || error.rowIndex == null) return baseMessage;

    const line = findJsonRowLine(rawText, error.rowIndex);
    const rowPart = line != null
        ? `line ${line}`
        : `row ${error.rowIndex + 1}`;
    const columnPart = error.columnName ? ` (column "${error.columnName}")` : '';
    return `Could not process ${rowPart}${columnPart}: ${baseMessage}`;
}

// options:
//  defaultSchema - optional bundled schema to apply when no schema is stored yet (used during dashboard setup)
//  parentDataSourceId - optional parent connection id - completion bumps an aggregate counter on the parent
//  silent - when true, per-child status/progress updates are not broadcast to AppSync; only the aggregate parent broadcast is sent
async function processUploadedFile(workspaceId, dataSourceId, rawData, options = {}) {
    const { defaultSchema, parentDataSourceId, silent = false } = options;

    const dataSource = await dataSourceRepo.getDataSourceById(workspaceId, dataSourceId);
    if (!dataSource) {
        // The data source has been deleted (cascade-delete, user removed the
        // file connection, etc.). Don't throw - retrying won't help.
        console.warn(
            `[DashboardRawDataTransform] Data source ${dataSourceId} no longer exists in workspace ${workspaceId}; skipping.`
        );
        return { success: false, missing: true };
    }

    // apply the bundled default schema before we look at the data so the rest of the flow honours it like any other stored schema
    // a known-empty schema (`[]`) is intentionally not persisted - the file is expected to be empty and the auto-infer path handles drift later
    if (Array.isArray(defaultSchema) && defaultSchema.length > 0) {
        try {
            const existing = await getDataSchema(workspaceId, dataSourceId);
            if (!Array.isArray(existing) || existing.length === 0) {
                await saveSchemaAndUpdateTable(workspaceId, dataSourceId, defaultSchema);
            }
        } catch (err) {
            console.warn(
                `[DashboardRawDataTransform] Failed to persist default schema for ${workspaceId}/${dataSourceId}:`,
                err.message
            );
        }
    }

    // unwrap any json formatting, flatten one-level nested objects the generic translator runs
    const { rows: sanitisedRows, groupHints } = sanitiseMicromaxDashboardData(rawData);
    const preparedRows = normaliseHeterogeneousRows(Array.isArray(sanitisedRows) ? sanitisedRows : []);

    const rawText = typeof rawData === 'string' ? rawData : null;

    // dashboard files use the shared safe-ingest pipeline. group hints get
    // stamped on the auto-generated schema during first-ingest (the previous
    // behaviour generated a typed schema with hints; the new pipeline builds
    // an all-string schema so the user is forced to review fields - we still
    // carry the group hint through so the review UI can group them).
    const result = await safeProcessIngest(workspaceId, dataSource, preparedRows, {
        silent,
        logPrefix: "[DashboardRawDataTransform]",
        buildErrorMessage: (err) => buildDashboardErrorMessage(err, rawText),
        applyColumnHints: (schema) => {
            if (!groupHints || Object.keys(groupHints).length === 0) return;
            for (const column of schema) {
                if (groupHints[column.name]) column.group = groupHints[column.name];
            }
        },
        onSuccess: async () => {
            if (silent && parentDataSourceId) {
                await dataSourceRepo.bumpDashboardSetupProgress(workspaceId, parentDataSourceId);
            }
        },
        onFailure: async () => {
            if (silent && parentDataSourceId) {
                // count failed files toward the setup total so the aggregate
                // progress finishes even if some files fail
                await dataSourceRepo.bumpDashboardSetupProgress(workspaceId, parentDataSourceId);
            }
        },
    });

    return result;
}

module.exports = {
    processUploadedFile,
};
