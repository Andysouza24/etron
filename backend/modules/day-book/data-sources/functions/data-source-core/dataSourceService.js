// Author(s): Rhys Cleary, Holly Wyatt
// Facade over the split data-source service modules.
// dataSourceHandler.js imports from here; implementations live under ./service/*.

const crud = require("./service/crud");
const update = require("./service/update");
const schema = require("./service/schema");
const query = require("./service/query");
const remote = require("./service/remote");
const dashboardRawData = require("./service/dashboardRawData");
const errorReview = require("./service/errorReview");

module.exports = {
    // crud
    createRemoteDataSource: crud.createRemoteDataSource,
    createLocalDataSource: crud.createLocalDataSource,
    activateDataSource: crud.activateDataSource,
    getLocalDataSourceUploadUrl: crud.getLocalDataSourceUploadUrl,
    getDataSourceInWorkspace: crud.getDataSourceInWorkspace,
    getDataSourcesInWorkspace: crud.getDataSourcesInWorkspace,
    deleteDataSourceInWorkspace: crud.deleteDataSourceInWorkspace,
    toggleDataSourceEnabled: crud.toggleDataSourceEnabled,

    // update
    updateDataSourceInWorkspace: update.updateDataSourceInWorkspace,

    // schema
    previewSchema: schema.previewSchema,
    previewSchemaForSource: schema.previewSchemaForSource,
    confirmSchemaAndProcess: schema.confirmSchemaAndProcess,

    // error review
    getErrorContext: errorReview.getErrorContext,
    resolveError: errorReview.resolveError,
    refreshFromDefaultSchema: errorReview.refreshFromDefaultSchema,

    // data queries
    viewData: query.viewData,
    viewDataForMetric: query.viewDataForMetric,
    previewMetricData: query.previewMetricData,
    updatePartitionedData: query.updatePartitionedData,

    // remote diagnostics / previews
    testConnection: remote.testConnection,
    getRemotePreview: remote.getRemotePreview,
    getAvailableSpreadsheets: remote.getAvailableSpreadsheets,

    // micromax-dashboard manual triggers
    refreshMicromaxDashboardFile: dashboardRawData.refreshMicromaxDashboardFile,
    backfillMicromaxDashboardParent: dashboardRawData.backfillMicromaxDashboardParent,
    discoverMicromaxDashboardChildren: dashboardRawData.discoverMicromaxDashboardChildren,
    cascadeDeleteMicromaxDashboardChildren: dashboardRawData.cascadeDeleteMicromaxDashboardChildren,
};