// Author(s): Rhys Cleary

const { getWorkspaceByUserId, transferWorkspaceOwnership, createWorkspace, updateWorkspace, getWorkspaceByWorkspaceId, deleteWorkspace, getWorkspacePermissions, getUserPermissionsVersion, getUserEffectivePermissions } = require("./workspaceService");


exports.handler = async (event) => {
    let statusCode = 200;
    let body;
    
    try {
        const requestJSON = event.body ? JSON.parse(event.body) : {};
        const pathParams = event.pathParameters || {};
        const authUserId = event.requestContext.authorizer.claims.sub;

        if (!authUserId) {
            throw new Error("User not authenticated");
        }

        const routeKey = `${event.httpMethod} ${event.resource}`;

        switch (routeKey) {

            // CREATE WORKSPACE
            case "POST /workspace": {
                body = await createWorkspace(authUserId, requestJSON);
                break;
            }

            // UPDATE WORKSPACE
            case "PATCH /workspace/{workspaceId}": {
                if (!pathParams.workspaceId) {
                    throw new Error("Missing required path parameter workspaceId");
                }

                if (typeof pathParams.workspaceId !== "string") {
                    throw new Error("workspaceId must be a UUID, 'string'");
                }

                body = await updateWorkspace(authUserId, pathParams.workspaceId, requestJSON);
                break;
            }

            // GET WORKSPACE BY ID
            case "GET /workspace/{workspaceId}": {
                if (!pathParams.workspaceId) {
                    throw new Error("Missing required path parameter workspaceId");
                }

                if (typeof pathParams.workspaceId !== "string") {
                    throw new Error("workspaceId must be a UUID, 'string'");
                }

                body = await getWorkspaceByWorkspaceId(pathParams.workspaceId);
                break;
            }

            // GET WORKSPACE BY USERID
            case "GET /workspace/users/{userId}": {
                if (!pathParams.userId) {
                    throw new Error("Missing required path parameter workspaceId");
                }

                if (typeof pathParams.userId !== "string") {
                    throw new Error("userId must be a UUID, 'string'");
                }

                body = await getWorkspaceByUserId(pathParams.userId);
                break;
            }

            // TRANSFER OWNERSHIP
            case "PUT /workspace/{workspaceId}/transfer": {
                if (!pathParams.workspaceId) {
                    throw new Error("Missing required path parameter workspaceId");
                }

                if (typeof pathParams.workspaceId !== "string") {
                    throw new Error("workspaceId must be a UUID, 'string'");
                }

                body = await transferWorkspaceOwnership(authUserId, pathParams.workspaceId, requestJSON);
                break;
            }

            // GET DEFAULT WORKSPACE PERMISSIONS
            case "GET /workspace/permissions": {
                body = await getWorkspacePermissions();
                break;
            }

            // GET USER PERMISSIONS VERSION - lightweight check
            case "GET /workspace/{workspaceId}/permissions/version": {
                if (!pathParams.workspaceId) {
                    throw new Error("Missing required path parameter workspaceId");
                }
                if (typeof pathParams.workspaceId !== "string") {
                    throw new Error("workspaceId must be a UUID, 'string'");
                }

                body = await getUserPermissionsVersion(authUserId, pathParams.workspaceId);
                break;
            }

            // GET USER EFFECTIVE PERMISSIONS - full permissions fetch
            case "GET /workspace/{workspaceId}/permissions/effective": {
                if (!pathParams.workspaceId) {
                    throw new Error("Missing required path parameter workspaceId");
                }
                if (typeof pathParams.workspaceId !== "string") {
                    throw new Error("workspaceId must be a UUID, 'string'");
                }

                body = await getUserEffectivePermissions(authUserId, pathParams.workspaceId);
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