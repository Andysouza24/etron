// Author(s): Rhys Cleary

const { saveStoredData, replaceStoredData } = require("@etron/data-sources-shared/repositories/dataBucketRepository");
const { generateSchema } = require("@etron/data-sources-shared/utils/schema");
const { translateData } = require("@etron/data-sources-shared/utils/translateData");
const { toParquet } = require("@etron/data-sources-shared/utils/typeConversion");
const { validateFormat } = require("@etron/data-sources-shared/utils/validateFormat");
const dataSourceRepo = require("@etron/day-book-shared/repositories/dataSourceRepository");
const { saveSchemaAndUpdateTable } = require("@etron/data-sources-shared/utils/schema");
const { appendToStoredData } = require("@etron/data-sources-shared/repositories/dataBucketRepository");
const { castDataToSchema } = require("@etron/data-sources-shared/utils/castDataToSchema");


async function processUploadedFile(workspaceId, dataSourceId, rawData) {
    // get the dataSource
    const dataSource = await dataSourceRepo.getDataSourceById(workspaceId, dataSourceId);
    if (!dataSource) {
        throw new Error(`Data source not found: ${dataSourceId}`);
    }
    // mark processing while transformation running so UI shows accurate status
    // overwritten on completion
    try {
        await dataSourceRepo.updateDataSourceStatus(workspaceId, dataSourceId, {
            status: "processing",
            errorMessage: null,
            progressStage: "Queued",
            progressPercent: 5,
        });
    } catch (err) {
        console.warn(`[FileUpload] Failed to set processing status for ${workspaceId}/${dataSourceId}:`, err);
    }

    try {
        await dataSourceRepo.updateDataSourceProgress(workspaceId, dataSourceId, { stage: "Translating data", percent: 15 });
        const translatedData = translateData(rawData);

        if (translatedData.length === 0) {
            console.warn(`Empty file for ${dataSource.dataSourceId}`);
            await dataSourceRepo.updateDataSourceStatus(
                workspaceId, 
                dataSourceId, 
                { status: "no_data", errorMessage: "No data existent" }
            );
            return { success: false };
        }

        await dataSourceRepo.updateDataSourceProgress(workspaceId, dataSourceId, { stage: "Validating format", percent: 30 });
        const {valid, error } = validateFormat(translatedData);
        if (!valid) throw new Error(`Invalid data format: ${error}`);

        // create the schema 
        await dataSourceRepo.updateDataSourceProgress(workspaceId, dataSourceId, { stage: "Generating schema", percent: 45 });
        const schema = generateSchema(translatedData.slice(0, 100));

        // cast rows to the schema
        await dataSourceRepo.updateDataSourceProgress(workspaceId, dataSourceId, { stage: "Casting rows", percent: 60 });
        const castedData = castDataToSchema(translatedData, schema);

        // convert to parquet
        await dataSourceRepo.updateDataSourceProgress(workspaceId, dataSourceId, { stage: "Writing parquet", percent: 75 });
        const parquetBuffer = await toParquet(castedData, schema);

        // save data depending on method
        await dataSourceRepo.updateDataSourceProgress(workspaceId, dataSourceId, { stage: "Saving data", percent: 85 });
        if (dataSource.method === "extend") {
            await appendToStoredData(workspaceId, dataSourceId, castedData, schema);
        } else {
            await replaceStoredData(workspaceId, dataSourceId, parquetBuffer);
        }

        // save the schema to S3
        await dataSourceRepo.updateDataSourceProgress(workspaceId, dataSourceId, { stage: "Finalising", percent: 95 });
        await saveSchemaAndUpdateTable(workspaceId, dataSourceId, schema);

        // update status
        await dataSourceRepo.updateDataSourceStatus(workspaceId, dataSourceId, {
            status: "active",
            errorMessage: null
        });

        return { success: true };

    } catch (error) {
        // update status to error
        await dataSourceRepo.updateDataSourceStatus(workspaceId, dataSourceId, {
            status: "error",
            errorMessage: error.message
        });
        throw error;
    }
    
}

module.exports = {
    processUploadedFile
};