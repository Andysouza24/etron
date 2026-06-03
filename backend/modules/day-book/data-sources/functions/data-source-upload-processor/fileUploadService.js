// Author(s): Rhys Cleary

const dataSourceRepo = require("@etron/day-book-shared/repositories/dataSourceRepository");
const { safeProcessIngest } = require("@etron/data-sources-shared/utils/ingestPipeline");

// Process an uploaded CSV file through the shared safe ingest pipeline.
// The pipeline handles:
//   - first-ingest with no schema -> pending_review + auto string schema
//   - schema drift -> temp schema + temp data, status error/schema_drift
//   - any other failure -> temp data store best-effort, status error
async function processUploadedFile(workspaceId, dataSourceId, rawData) {
    const dataSource = await dataSourceRepo.getDataSourceById(workspaceId, dataSourceId);
    if (!dataSource) {
        throw new Error(`Data source not found: ${dataSourceId}`);
    }

    return safeProcessIngest(workspaceId, dataSource, rawData, {
        logPrefix: "[FileUpload]",
    });
}

module.exports = {
    processUploadedFile,
};
