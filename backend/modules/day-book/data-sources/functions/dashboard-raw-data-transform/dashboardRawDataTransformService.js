// reuses same transform pipeline as the file upload processor
// kept as a thin wrapper so the SQS handler can call a single function

const { replaceStoredData, appendToStoredData } = require('@etron/data-sources-shared/repositories/dataBucketRepository');
const { generateSchema, saveSchemaAndUpdateTable } = require('@etron/data-sources-shared/utils/schema');
const { translateData } = require('@etron/data-sources-shared/utils/translateData');
const { toParquet } = require('@etron/data-sources-shared/utils/typeConversion');
const { validateFormat } = require('@etron/data-sources-shared/utils/validateFormat');
const { castDataToSchema } = require('@etron/data-sources-shared/utils/castDataToSchema');
const dataSourceRepo = require('@etron/day-book-shared/repositories/dataSourceRepository');

// MongoDB-style exports often produce arrays where individual records have
// different optional fields (e.g. some have `brandId`, others don't).
// `validateFormat` rejects that, so normalise to the union of keys with
// `null` placeholders before validation/schema inference.
function normaliseHeterogeneousRows(rows) {
    if (!Array.isArray(rows) || rows.length === 0) return rows;

    const keySet = new Set();
    for (const row of rows) {
        if (row && typeof row === 'object') {
            for (const k of Object.keys(row)) keySet.add(k);
        }
    }
    const allKeys = Array.from(keySet);

    return rows.map((row) => {
        if (!row || typeof row !== 'object') return row;
        const out = {};
        for (const k of allKeys) {
            out[k] = Object.prototype.hasOwnProperty.call(row, k) ? row[k] : null;
        }
        return out;
    });
}

async function processUploadedFile(workspaceId, dataSourceId, rawData) {
    const dataSource = await dataSourceRepo.getDataSourceById(workspaceId, dataSourceId);
    if (!dataSource) {
        // The data source has been deleted (cascade-delete, user removed the
        // file connection, etc.). Don't throw \u2014 retrying won't help.
        console.warn(
            `[DashboardRawDataTransform] Data source ${dataSourceId} no longer exists in workspace ${workspaceId}; skipping.`
        );
        return { success: false, missing: true };
    }

    try {
        await dataSourceRepo.updateDataSourceProgress(workspaceId, dataSourceId, { stage: "Translating data", percent: 15 });
        const translatedData = normaliseHeterogeneousRows(translateData(rawData));

        if (translatedData.length === 0) {
            console.warn(`Empty file for ${dataSource.dataSourceId}`);
            await dataSourceRepo.updateDataSourceStatus(
                workspaceId,
                dataSourceId,
                { status: 'no_data', errorMessage: 'No data existent' }
            );
            return { success: false };
        }

        await dataSourceRepo.updateDataSourceProgress(workspaceId, dataSourceId, { stage: "Validating format", percent: 30 });
        const { valid, error } = validateFormat(translatedData);
        if (!valid) throw new Error(`Invalid data format: ${error}`);

        await dataSourceRepo.updateDataSourceProgress(workspaceId, dataSourceId, { stage: "Generating schema", percent: 45 });
        const schema = generateSchema(translatedData.slice(0, 100));

        await dataSourceRepo.updateDataSourceProgress(workspaceId, dataSourceId, { stage: "Casting rows", percent: 60 });
        const castedData = castDataToSchema(translatedData, schema);

        await dataSourceRepo.updateDataSourceProgress(workspaceId, dataSourceId, { stage: "Writing parquet", percent: 75 });
        const parquetBuffer = await toParquet(castedData, schema);

        await dataSourceRepo.updateDataSourceProgress(workspaceId, dataSourceId, { stage: "Saving data", percent: 85 });
        if (dataSource.method === 'extend') {
            await appendToStoredData(workspaceId, dataSourceId, castedData, schema);
        } else {
            await replaceStoredData(workspaceId, dataSourceId, parquetBuffer);
        }

        await dataSourceRepo.updateDataSourceProgress(workspaceId, dataSourceId, { stage: "Finalising", percent: 95 });
        await saveSchemaAndUpdateTable(workspaceId, dataSourceId, schema);

        await dataSourceRepo.updateDataSourceStatus(workspaceId, dataSourceId, {
            status: 'active',
            errorMessage: null,
        });

        return { success: true };
    } catch (error) {
        await dataSourceRepo.updateDataSourceStatus(workspaceId, dataSourceId, {
            status: 'error',
            errorMessage: error.message,
        });
        throw error;
    }
}

module.exports = {
    processUploadedFile,
};
