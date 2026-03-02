// Author(s): Rhys Cleary

const { deleteDataSourceInWorkspace, getDataSourcesInWorkspace, getDataSourceInWorkspace, updateDataSourceInWorkspace, testConnection, createLocalDataSource, createRemoteDataSource, getRemotePreview, viewData, viewDataForMetric, getLocalDataSourceUploadUrl, updatePartitionedData } = require("./dataSourceService");

exports.handler = async (event) => {
    let statusCode = 200;
    let body;
    
    try {
        const requestJSON = event.body ? JSON.parse(event.body) : {};
        const pathParams = event.pathParameters || {};
        const queryParams = event.queryStringParameters || {};
        const authUserId = event.requestContext.authorizer.claims.sub;

        if (!authUserId) {
            throw new Error("User not authenticated");
        }

        const routeKey = `${event.httpMethod} ${event.resource}`;

        switch (routeKey) {

            // GET AVAILABLE SPREADSHEETS
            case "GET /day-book/data-sources/available-spreadsheets": {
                const { sourceType } = queryParams;
                if (!sourceType) throw new Error("Missing sourceType query parameter");
                body = await getAvailableSpreadsheets(authUserId, sourceType);
                break;
            }

            // ADD REMOTE DATA SOURCE
            case "POST /day-book/data-sources/remote": {
                if (!requestJSON.workspaceId) {
                    throw new Error("Please specify a workspaceId");
                }
                body = await createRemoteDataSource(authUserId, requestJSON);
                break;
            }

            // ADD LOCAL DATA SOURCE
            case "POST /day-book/data-sources/local": {
                if (!requestJSON.workspaceId) {
                    throw new Error("Please specify a workspaceId");
                }
                body = await createLocalDataSource(authUserId, requestJSON);
                break;
            }

            // TEST DATA SOURCE CONNECTION
            case "POST /day-book/data-sources/test-connection": {
                console.log('[handler] test-connection', { sourceType: requestJSON.sourceType, authType: requestJSON.config?.authType });
                body = await testConnection(authUserId, requestJSON);
                break;
            }

            // UPDATE DATA SOURCES
            case "PATCH /day-book/data-sources/{dataSourceId}": {
                if (!requestJSON.workspaceId) {
                    throw new Error("Please specify a workspaceId");
                }
                if (!pathParams.dataSourceId) {
                    throw new Error("Missing required path parameters");
                }

                if (typeof pathParams.dataSourceId !== "string") {
                    throw new Error("dataSourceId must be a UUID, 'string'");
                }

                body = await updateDataSourceInWorkspace(authUserId, pathParams.dataSourceId, requestJSON);
                break;
            }

            // UPDATE DATA SOURCE DATA
            case "PUT /day-book/data-sources/{dataSourceId}/update-data": {
                if (!requestJSON.workspaceId) {
                    throw new Error("Please specify a workspaceId");
                }
                if (!pathParams.dataSourceId) {
                    throw new Error("Missing required path parameters");
                }

                if (typeof pathParams.dataSourceId !== "string") {
                    throw new Error("dataSourceId must be a UUID, 'string'");
                }

                body = await updatePartitionedData(authUserId, pathParams.dataSourceId, requestJSON);
                break;
            }

            // PREVIEW REMOTE DATA SOURCE CONNECTION
            case "POST /day-book/data-sources/preview/remote": {
                body = await getRemotePreview(authUserId, requestJSON);
                break;
            }

            // GET DATA SOURCE BY ID
            case "GET /day-book/data-sources/{dataSourceId}": {
                const workspaceId = queryParams.workspaceId;

                if (!pathParams.dataSourceId) {
                    throw new Error("Missing dataSourceId in path parameters");
                }
                if (typeof pathParams.dataSourceId !== "string") {
                    throw new Error("dataSourceId must be a UUID, 'string'");
                }
                if (!workspaceId || typeof workspaceId !== "string") {
                    throw new Error("Missing required query parameters");
                }

                body = await getDataSourceInWorkspace(authUserId, workspaceId, pathParams.dataSourceId);
                break;
            }

            // GET UPLOAD URL FOR LOCAL DATASOURCE
            case "GET /day-book/data-sources/{dataSourceId}/upload": {
                const workspaceId = queryParams.workspaceId;

                if (!pathParams.dataSourceId) {
                    throw new Error("Missing dataSourceId in path parameters");
                }
                if (typeof pathParams.dataSourceId !== "string") {
                    throw new Error("dataSourceId must be a UUID, 'string'");
                }
                if (!workspaceId || typeof workspaceId !== "string") {
                    throw new Error("Missing required query parameters");
                }

                body = await getLocalDataSourceUploadUrl(authUserId, workspaceId, pathParams.dataSourceId);
                break;
            }

            // VIEW DATA SOURCE DATA
            case "GET /day-book/data-sources/{dataSourceId}/view-data": {
                const workspaceId = queryParams.workspaceId;

                if (!pathParams.dataSourceId) {
                    throw new Error("Missing required path parameters");
                }
                if (typeof pathParams.dataSourceId !== "string") {
                    throw new Error("dataSourceId must be a UUID, 'string'");
                }
                if (!workspaceId || typeof workspaceId !== "string") {
                    throw new Error("Missing required query parameters");
                }

                body = await viewData(authUserId, workspaceId, pathParams.dataSourceId);
                break;
            }

            // VIEW DATA SOURCE DATA (EXCLUDING DATA NOT RELEVANT TO METRIC)
            case "GET /day-book/data-sources/{dataSourceId}/view-data-for-metric/{metricId}": {
                const workspaceId = queryParams.workspaceId;

                if (!pathParams.dataSourceId) {
                    throw new Error("Missing dataSourceId in path parameters");
                }
                if (typeof pathParams.dataSourceId !== "string") {
                    throw new Error("dataSourceId must be a UUID, 'string'");
                }
                if (!pathParams.metricId) {
                    throw new Error("Missing metricId in path parameters");
                }
                if (typeof pathParams.metricId !== "string") {
                    throw new Error("metricId must be a UUID, 'string'");
                }
                if (!workspaceId || typeof workspaceId !== "string") {
                    throw new Error("Missing workspaceId from query parameters");
                }

                body = await viewDataForMetric(authUserId, workspaceId, pathParams.dataSourceId, pathParams.metricId);
                break;
            }

            // GET ALL DATA SOURCES
            case "GET /day-book/data-sources": {
                const workspaceId = queryParams.workspaceId;

                if (!workspaceId || typeof workspaceId !== "string") {
                    throw new Error("Missing required query parameters");
                }

                body = await getDataSourcesInWorkspace(authUserId, workspaceId);
                break;
            }

            // REMOVE DATA SOURCE
            case "DELETE /day-book/data-sources/{dataSourceId}": {
                const workspaceId = queryParams.workspaceId;

                if (!pathParams.dataSourceId) {
                    throw new Error("Missing required path parameters");
                }

                if (typeof pathParams.dataSourceId !== "string") {
                    throw new Error("dataSourceId must be a UUID, 'string'");
                }

                if (!workspaceId || typeof workspaceId !== "string") {
                    throw new Error("Missing required query parameters");
                }
                
                body = await deleteDataSourceInWorkspace(authUserId, workspaceId, pathParams.dataSourceId);
                break;
            }

            default:
                statusCode = 404;
                body = {message: `Unsupported route: ${event.routeKey}`}
                break;
        }
    } catch (error) {
        console.error(error);
        statusCode = 400;
        body = {error: error.message};
    }

    return {
        statusCode,
        body: JSON.stringify(body),
    };
};