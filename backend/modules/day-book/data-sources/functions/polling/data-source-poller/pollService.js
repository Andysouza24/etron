// Author(s): Rhys Cleary, Holly Wyatt

const dataSourceRepo = require("@etron/day-book-shared/repositories/dataSourceRepository");
const dataSourceSecretsRepo = require("@etron/data-sources-shared/repositories/dataSourceSecretsRepository");
const adapterFactory = require("@etron/data-sources-shared/adapters/adapterFactory");
const { safeProcessIngest } = require("@etron/data-sources-shared/utils/ingestPipeline");

async function pollDataSource(workspace, dataSource) {
    const allowedTypes = adapterFactory.getAllowedPollingTypes();

    // only poll allowed adapter types
    if (!allowedTypes.includes(dataSource.sourceType)) {
        return;
    }
    // active sources keep polling. Errored sources also poll so they can
    // recover automatically when the upstream is fixed, and any drift /
    // processing failure gets tracked in the temp store via safeProcessIngest.
    if (dataSource.status !== "active" && dataSource.status !== "error") {
        return;
    }

    const workspaceId = workspace.workspaceId;
    const dataSourceId = dataSource.dataSourceId;

    // adapter failures are routed straight to error - the data never arrived,
    // so the temp store flow does not apply. Once we have rows, safeProcessIngest
    // handles translate/validate/drift/parquet/store with full error tracking.
    let newData;
    try {
        await dataSourceRepo.updateDataSourceStatus(workspaceId, dataSourceId, {
            status: "processing",
            errorMessage: null,
            errorType: null,
            progressStage: "Polling source",
            progressPercent: 5,
        });

        const secrets = await dataSourceSecretsRepo.getSecrets(workspaceId, dataSourceId);
        const adapter = adapterFactory.getAdapter(dataSource.sourceType);

        await dataSourceRepo.updateDataSourceProgress(workspaceId, dataSourceId, { stage: "Fetching data", percent: 15 });
        newData = await retryPoll(adapter, dataSource.config, secrets);
    } catch (err) {
        console.error(`[Poll] adapter poll failed for ${workspaceId}/${dataSourceId}:`, err.message);
        await dataSourceRepo.updateDataSourceStatus(workspaceId, dataSourceId, {
            status: "error",
            errorMessage: err.message,
            errorType: "poll",
        });
        throw err;
    }

    return safeProcessIngest(workspaceId, dataSource, newData, {
        logPrefix: "[Poll]",
    });
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