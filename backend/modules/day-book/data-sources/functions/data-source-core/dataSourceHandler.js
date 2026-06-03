// Author(s): Rhys Cleary, Holly Wyatt

const { deleteDataSourceInWorkspace, getDataSourcesInWorkspace, getDataSourceInWorkspace, updateDataSourceInWorkspace, testConnection, createLocalDataSource, createRemoteDataSource, activateDataSource, getRemotePreview, viewData, viewDataForMetric, previewMetricData, getLocalDataSourceUploadUrl, updatePartitionedData, previewSchema, previewSchemaForSource, confirmSchemaAndProcess, refreshMicromaxDashboardFile, backfillMicromaxDashboardParent, discoverMicromaxDashboardChildren, toggleDataSourceEnabled, getErrorContext, resolveError, refreshFromDefaultSchema } = require("./dataSourceService");

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

            // PREVIEW SCHEMA FOR CSV DATA (auto-detect field categories)
            case "POST /day-book/data-sources/preview-schema": {
                if (!requestJSON.workspaceId) {
                    throw new Error("Please specify a workspaceId");
                }
                body = await previewSchema(authUserId, requestJSON);
                break;
            }

            // CONFIRM SCHEMA AND PROCESS DATA SOURCE UPLOAD
            case "POST /day-book/data-sources/{dataSourceId}/confirm-schema": {
                if (!requestJSON.workspaceId) {
                    throw new Error("Please specify a workspaceId");
                }
                if (!pathParams.dataSourceId) {
                    throw new Error("Missing dataSourceId in path parameters");
                }
                if (typeof pathParams.dataSourceId !== "string") {
                    throw new Error("dataSourceId must be a UUID, 'string'");
                }
                body = await confirmSchemaAndProcess(authUserId, pathParams.dataSourceId, requestJSON);
                break;
            }

            // GET ERROR CONTEXT - returns the stored schema, temp schema, suggested revised schema,
            // and a sample of pending rows so the UI can drive the "revise schema" flow.
            case "GET /day-book/data-sources/{dataSourceId}/error-context": {
                if (!queryParams.workspaceId) {
                    throw new Error("Please specify a workspaceId");
                }
                if (!pathParams.dataSourceId || typeof pathParams.dataSourceId !== "string") {
                    throw new Error("dataSourceId must be a UUID, 'string'");
                }
                body = await getErrorContext(authUserId, pathParams.dataSourceId, { workspaceId: queryParams.workspaceId });
                break;
            }

            // RESOLVE ERROR - apply the user-confirmed revised schema and merge
            // any pending temp data back into the main partition.
            case "POST /day-book/data-sources/{dataSourceId}/resolve-error": {
                if (!requestJSON.workspaceId) {
                    throw new Error("Please specify a workspaceId");
                }
                if (!pathParams.dataSourceId || typeof pathParams.dataSourceId !== "string") {
                    throw new Error("dataSourceId must be a UUID, 'string'");
                }
                body = await resolveError(authUserId, pathParams.dataSourceId, requestJSON);
                break;
            }

            // REFRESH FROM DEFAULT SCHEMA - merges the bundled default schema for the data source's
            // file with the currently-stored schema and reuses the resolve-error pipeline to rebuild.
            case "POST /day-book/data-sources/{dataSourceId}/refresh-default-schema": {
                if (!requestJSON.workspaceId) {
                    throw new Error("Please specify a workspaceId");
                }
                if (!pathParams.dataSourceId || typeof pathParams.dataSourceId !== "string") {
                    throw new Error("dataSourceId must be a UUID, 'string'");
                }
                body = await refreshFromDefaultSchema(authUserId, pathParams.dataSourceId, requestJSON);
                break;
            }

            // PREVIEW SCHEMA FOR AN ALREADY-CREATED REMOTE DATA SOURCE
            // (polls the live source via its adapter to produce sample rows)
            case "POST /day-book/data-sources/{dataSourceId}/preview-schema": {
                if (!requestJSON.workspaceId) {
                    throw new Error("Please specify a workspaceId");
                }
                if (!pathParams.dataSourceId) {
                    throw new Error("Missing dataSourceId in path parameters");
                }
                if (typeof pathParams.dataSourceId !== "string") {
                    throw new Error("dataSourceId must be a UUID, 'string'");
                }
                body = await previewSchemaForSource(authUserId, pathParams.dataSourceId, requestJSON);
                break;
            }

            // ACTIVATE A PENDING REMOTE DATA SOURCE
            // Persists confirmedSchema (optional), flips status pending_setup -> active
            case "POST /day-book/data-sources/{dataSourceId}/activate": {
                if (!requestJSON.workspaceId) {
                    throw new Error("Please specify a workspaceId");
                }
                if (!pathParams.dataSourceId) {
                    throw new Error("Missing dataSourceId in path parameters");
                }
                if (typeof pathParams.dataSourceId !== "string") {
                    throw new Error("dataSourceId must be a UUID, 'string'");
                }
                body = await activateDataSource(authUserId, pathParams.dataSourceId, requestJSON);
                break;
            }

            // TOGGLE DATA SOURCE ENABLED/DISABLED
            // Disabling pauses every user-initiated action against the source
            // while leaving background ingest (polling lambda / SQS transforms) alive.
            case "POST /day-book/data-sources/{dataSourceId}/toggle-enabled": {
                if (!requestJSON.workspaceId) {
                    throw new Error("Please specify a workspaceId");
                }
                if (!pathParams.dataSourceId) {
                    throw new Error("Missing dataSourceId in path parameters");
                }
                if (typeof pathParams.dataSourceId !== "string") {
                    throw new Error("dataSourceId must be a UUID, 'string'");
                }
                body = await toggleDataSourceEnabled(authUserId, pathParams.dataSourceId, requestJSON);
                break;
            }

            // MANUAL REFRESH FOR DASHBOARD RAW DATA INGEST
            case "POST /day-book/data-sources/{dataSourceId}/dashboard-raw-data/refresh": {
                if (!requestJSON.workspaceId) {
                    throw new Error("Please specify a workspaceId");
                }
                if (!pathParams.dataSourceId) {
                    throw new Error("Missing dataSourceId in path parameters");
                }
                if (typeof pathParams.dataSourceId !== "string") {
                    throw new Error("dataSourceId must be a UUID, 'string'");
                }
                body = await refreshMicromaxDashboardFile(authUserId, pathParams.dataSourceId, requestJSON);
                break;
            }

            // MANUAL RESCAN OF EVERY FILE FOR A MICROMAX-DASHBOARD CONNECTION
            case "POST /day-book/data-sources/{dataSourceId}/micromax-dashboard/rescan":
            case "POST /day-book/data-sources/{dataSourceId}/test-connection/rescan": {
                if (!requestJSON.workspaceId) {
                    throw new Error("Please specify a workspaceId");
                }
                if (!pathParams.dataSourceId) {
                    throw new Error("Missing dataSourceId in path parameters");
                }
                if (typeof pathParams.dataSourceId !== "string") {
                    throw new Error("dataSourceId must be a UUID, 'string'");
                }
                body = await backfillMicromaxDashboardParent(authUserId, pathParams.dataSourceId, requestJSON);
                break;
            }

            // DISCOVER CHILDREN FOR A PENDING MICROMAX-DASHBOARD PARENT
            // lists files in the parent's S3 prefix and ensures a `pending_setup` child data source exists for each
            // used by the wizard before per-child schema review
            // does NOT enqueue transform jobs
            case "POST /day-book/data-sources/{dataSourceId}/micromax-dashboard/discover":
            case "POST /day-book/data-sources/{dataSourceId}/test-connection/discover": {
                if (!requestJSON.workspaceId) {
                    throw new Error("Please specify a workspaceId");
                }
                if (!pathParams.dataSourceId) {
                    throw new Error("Missing dataSourceId in path parameters");
                }
                if (typeof pathParams.dataSourceId !== "string") {
                    throw new Error("dataSourceId must be a UUID, 'string'");
                }
                body = await discoverMicromaxDashboardChildren(authUserId, pathParams.dataSourceId, requestJSON);
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

                body = await viewDataForMetric(
                    authUserId,
                    workspaceId,
                    pathParams.dataSourceId,
                    pathParams.metricId,
                    {
                        params: {
                            year: queryParams.year,
                            from: queryParams.from,
                            to: queryParams.to,
                            aggregatePeriod: queryParams.aggregatePeriod,
                        },
                        pageSize: queryParams.pageSize ? Number(queryParams.pageSize) : undefined,
                        nextToken: queryParams.nextToken,
                        queryExecutionId: queryParams.queryExecutionId,
                    }
                );
                break;
            }

            // PREVIEW METRIC DATA (UNSAVED CONFIG, USED BY CREATION WIZARD)
            case "POST /day-book/data-sources/{dataSourceId}/preview-metric-data": {
                const workspaceId = queryParams.workspaceId;

                if (!pathParams.dataSourceId || typeof pathParams.dataSourceId !== "string") {
                    throw new Error("Missing or invalid dataSourceId in path parameters");
                }
                if (!workspaceId || typeof workspaceId !== "string") {
                    throw new Error("Missing workspaceId from query parameters");
                }
                if (!requestJSON?.config) {
                    throw new Error("Missing metric config in request body");
                }

                body = await previewMetricData(
                    authUserId,
                    workspaceId,
                    pathParams.dataSourceId,
                    requestJSON.config,
                    {
                        params: {
                            year: requestJSON.year ?? queryParams.year,
                            from: requestJSON.from ?? queryParams.from,
                            to: requestJSON.to ?? queryParams.to,
                            aggregatePeriod: requestJSON.aggregatePeriod ?? queryParams.aggregatePeriod,
                        },
                        pageSize: (requestJSON.pageSize ?? queryParams.pageSize) ? Number(requestJSON.pageSize ?? queryParams.pageSize) : undefined,
                        nextToken: requestJSON.nextToken,
                        queryExecutionId: requestJSON.queryExecutionId,
                    }
                );
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