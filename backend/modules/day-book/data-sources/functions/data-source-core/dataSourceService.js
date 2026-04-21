// Author(s): Rhys Cleary, Holly Wyatt
// Facade over the split data-source service modules.
// dataSourceHandler.js imports from here; implementations live under ./service/*.

const crud = require("./service/crud");
const update = require("./service/update");
const schema = require("./service/schema");
const query = require("./service/query");
const remote = require("./service/remote");

module.exports = {
    // crud
    createRemoteDataSource: crud.createRemoteDataSource,
    createLocalDataSource: crud.createLocalDataSource,
    getLocalDataSourceUploadUrl: crud.getLocalDataSourceUploadUrl,
    getDataSourceInWorkspace: crud.getDataSourceInWorkspace,
    getDataSourcesInWorkspace: crud.getDataSourcesInWorkspace,
    deleteDataSourceInWorkspace: crud.deleteDataSourceInWorkspace,

    // update
    updateDataSourceInWorkspace: update.updateDataSourceInWorkspace,

    // schema
    previewSchema: schema.previewSchema,
    confirmSchemaAndProcess: schema.confirmSchemaAndProcess,

    // data queries
    viewData: query.viewData,
    viewDataForMetric: query.viewDataForMetric,
    updatePartitionedData: query.updatePartitionedData,

    // remote diagnostics / previews
    testConnection: remote.testConnection,
    getRemotePreview: remote.getRemotePreview,
    getAvailableSpreadsheets: remote.getAvailableSpreadsheets,
};