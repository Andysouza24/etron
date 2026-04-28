// Author(s): Rhys Cleary

const dataSourceRepo = require("@etron/day-book-shared/repositories/dataSourceRepository");
const dataSourceSecretsRepo = require("@etron/data-sources-shared/repositories/dataSourceSecretsRepository");
const workspaceRepo = require("@etron/shared/repositories/workspaceRepository");
const adapterFactory = require("@etron/data-sources-shared/adapters/adapterFactory");
const { saveStoredData } = require("@etron/data-sources-shared/repositories/dataBucketRepository");
const { validateFormat } = require("@etron/data-sources-shared/utils/validateFormat");
const { translateData } = require("@etron/data-sources-shared/utils/translateData");
const { toParquet } = require("@etron/data-sources-shared/utils/typeConversion");
const { generateSchema } = require("@etron/data-sources-shared/utils/schema");
const { saveSchemaAndUpdateTable } = require("@etron/data-sources-shared/utils/schema");
const { appendToStoredData, replaceStoredData } = require("@etron/data-sources-shared/repositories/dataBucketRepository");
const { castDataToSchema } = require("@etron/data-sources-shared/utils/castDataToSchema");

async function pollDataSource(workspace, dataSource) {
    const allowedTypes = adapterFactory.getAllowedPollingTypes();

    // check if the data source is active and an allowed type
    if (!allowedTypes.includes(dataSource.sourceType)) {
        return;
    }
    if (dataSource.status !== "active" && dataSource.status !== "error") {
        return;
    }

    // mark processing so the UI can render a progress bar while the
    // poll cycle runs. Cleared by the active/error update below.
    await dataSourceRepo.updateDataSourceStatus(workspace.workspaceId, dataSource.dataSourceId, {
        status: "processing",
        errorMessage: null,
        progressStage: "Polling source",
        progressPercent: 5,
    });

    try {
        // get sources secrets
        const secrets = await dataSourceSecretsRepo.getSecrets(workspace.workspaceId, dataSource.dataSourceId);

        // create adapter
        const adapter = adapterFactory.getAdapter(dataSource.sourceType);

        // try polling
        await dataSourceRepo.updateDataSourceProgress(workspace.workspaceId, dataSource.dataSourceId, { stage: "Fetching data", percent: 15 });
        const newData = await retryPoll(adapter, dataSource.config, secrets);

        await dataSourceRepo.updateDataSourceProgress(workspace.workspaceId, dataSource.dataSourceId, { stage: "Translating data", percent: 25 });
        const translatedData = translateData(newData);

        if (translatedData.length === 0) {
            await dataSourceRepo.updateDataSourceStatus(
                workspace.workspaceId, 
                dataSource.dataSourceId, 
                { status: "no_data", errorMessage: "No data existent" }
            );
            return;
        }

        await dataSourceRepo.updateDataSourceProgress(workspace.workspaceId, dataSource.dataSourceId, { stage: "Validating format", percent: 40 });
        const {valid, error } = validateFormat(translatedData);
        if (!valid) throw new Error(`Invalid data format: ${error}`);

        // create the schema
        await dataSourceRepo.updateDataSourceProgress(workspace.workspaceId, dataSource.dataSourceId, { stage: "Generating schema", percent: 55 });
        const schema = generateSchema(translatedData.slice(0, 100));

        // cast rows to the schema
        await dataSourceRepo.updateDataSourceProgress(workspace.workspaceId, dataSource.dataSourceId, { stage: "Casting rows", percent: 70 });
        const castedData = castDataToSchema(translatedData, schema);

        // convert the data to parquet file
        await dataSourceRepo.updateDataSourceProgress(workspace.workspaceId, dataSource.dataSourceId, { stage: "Writing parquet", percent: 80 });
        const parquetBuffer = await toParquet(castedData, schema);

        await dataSourceRepo.updateDataSourceProgress(workspace.workspaceId, dataSource.dataSourceId, { stage: "Saving data", percent: 90 });
        if (dataSource.method === "extend") {
            // extend the data source
            await appendToStoredData(workspace.workspaceId, dataSource.dataSourceId, castedData, schema);
        } else {
            // replace data
            await replaceStoredData(workspace.workspaceId, dataSource.dataSourceId, parquetBuffer);
        }

        // save the schema to S3
        await dataSourceRepo.updateDataSourceProgress(workspace.workspaceId, dataSource.dataSourceId, { stage: "Finalising", percent: 95 });
        await saveSchemaAndUpdateTable(workspace.workspaceId, dataSource.dataSourceId, schema);

        // update status. Always overwrite because we set "processing" above so
        // the progress bar would otherwise stay stuck at 95%.
        await dataSourceRepo.updateDataSourceStatus(workspace.workspaceId, dataSource.dataSourceId, {
            status: "active",
            errorMessage: null
        });
    } catch (err) {
        await dataSourceRepo.updateDataSourceStatus(workspace.workspaceId, dataSource.dataSourceId, {
            status: "error",
            errorMessage: err.message,
        });
        throw err;
    }
}

async function retryPoll(adapter, config, secrets) {
    let error;

    for (let i = 0; i < 3; i++) {
        try {
            return await adapter.poll(config, secrets);
        } catch (err) {
           error = err;  
        }
    }

    throw error;
}

module.exports = {
    pollDataSource
};