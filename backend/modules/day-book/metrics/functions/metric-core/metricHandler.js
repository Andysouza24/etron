// Author(s): Rhys Cleary

const { createMetricInWorkspace, updateMetricInWorkspace, getMetricInWorkspace, getMetricsInWorkspace, deleteMetricInWorkspace } = require("./metricService");

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
            // ADD METRIC
            case "POST /day-book/metrics": {
                if (!requestJSON.workspaceId) {
                    throw new Error("Please specify a workspaceId");
                }
                body = await createMetricInWorkspace(authUserId, requestJSON);
                break;
            }

            // UPDATE METRIC
            case "PATCH /day-book/metrics/{metricId}": {
                if (!requestJSON.workspaceId) {
                    throw new Error("Please specify a workspaceId");
                }

                if (!pathParams.metricId) {
                    throw new Error("Missing required path parameters");
                }

                if (typeof pathParams.metricId !== "string") {
                    throw new Error("metricId must be a UUID, 'string'");
                }

                body = await updateMetricInWorkspace(authUserId, pathParams.metricId, requestJSON);
                break;
            }

            // GET METRIC
            case "GET /day-book/metrics/{metricId}": {
                const workspaceId = queryParams.workspaceId;

                if (!pathParams.metricId) {
                    throw new Error("Missing required path parameters");
                }

                if (typeof pathParams.metricId !== "string") {
                    throw new Error("metricId must be a UUID, 'string'");
                }

                if (!workspaceId || typeof workspaceId !== "string") {
                    throw new Error("Missing required query parameters");
                }

                body = await getMetricInWorkspace(authUserId, workspaceId, pathParams.metricId);
                break;
            }

            // GET ALL METRICS
            case "GET /day-book/metrics": {
                const workspaceId = queryParams.workspaceId;

                if (!workspaceId || typeof workspaceId !== "string") {
                    throw new Error("Missing required query parameters");
                }

                body = await getMetricsInWorkspace(authUserId, workspaceId);
                break;
            }

            // REMOVE METRIC
            case "DELETE /day-book/metrics/{metricId}": {
                const workspaceId = queryParams.workspaceId;

                if (!pathParams.metricId) {
                    throw new Error("Missing required path parameters");
                }

                if (typeof pathParams.metricId !== "string") {
                    throw new Error("metricId must be a UUID, 'string'");
                }

                if (!workspaceId || typeof workspaceId !== "string") {
                    throw new Error("Missing required query parameters");
                }
                
                body = await deleteMetricInWorkspace(authUserId, workspaceId, pathParams.metricId);
                break;
            }

            case "GET /day-book/metrics/by-data-source/{dataSourceId}": {
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

                const { getMetricsByDataSourceInWorkspace } = require("./metricService");
                body = await getMetricsByDataSourceInWorkspace(authUserId, workspaceId, pathParams.dataSourceId);
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