const {
  createBoardInWorkspace,
  updateBoardInWorkspace,
  deleteBoardInWorkspace,
  getBoardInWorkspace,
  getBoardsInWorkspace,
} = require("./boardService");

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
      // CREATE BOARD
      case "POST /workspace/{workspaceId}/boards": {
        if (!pathParams.workspaceId) {
          throw new Error("Missing required path parameters");
        }

        if (typeof pathParams.workspaceId !== "string") {
          throw new Error("workspaceId must be a UUID, 'string'");
        }

        body = await createBoardInWorkspace(
          authUserId,
          pathParams.workspaceId,
          requestJSON
        );
        break;
      }

      // UPDATE BOARD
      case "PATCH /workspace/{workspaceId}/boards/{boardId}": {
        if (!pathParams.workspaceId || !pathParams.boardId) {
          throw new Error("Missing required path parameters");
        }

        if (typeof pathParams.workspaceId !== "string") {
          throw new Error("workspaceId must be a UUID, 'string'");
        }

        if (typeof pathParams.boardId !== "string") {
          throw new Error("boardId must be a UUID, 'string'");
        }

        body = await updateBoardInWorkspace(
          authUserId,
          pathParams.workspaceId,
          pathParams.boardId,
          requestJSON
        );
        break;
      }

      // DELETE BOARD
      case "DELETE /workspace/{workspaceId}/boards/{boardId}": {
        if (!pathParams.workspaceId || !pathParams.boardId) {
          throw new Error("Missing required path parameters");
        }

        if (typeof pathParams.workspaceId !== "string") {
          throw new Error("workspaceId must be a UUID, 'string'");
        }

        if (typeof pathParams.boardId !== "string") {
          throw new Error("boardId must be a UUID, 'string'");
        }

        body = await deleteBoardInWorkspace(
          authUserId,
          pathParams.workspaceId,
          pathParams.boardId
        );
        break;
      }

      // GET BOARD IN WORKSPACE
      case "GET /workspace/{workspaceId}/boards/{boardId}": {
        if (!pathParams.workspaceId || !pathParams.boardId) {
          throw new Error("Missing required path parameters");
        }

        if (typeof pathParams.workspaceId !== "string") {
          throw new Error("workspaceId must be a UUID, 'string'");
        }

        if (typeof pathParams.boardId !== "string") {
          throw new Error("boardId must be a UUID, 'string'");
        }

        body = await getBoardInWorkspace(
          authUserId,
          pathParams.workspaceId,
          pathParams.boardId
        );
        break;
      }

      // GET ALL BOARDS IN WORKSPACE
      case "GET /workspace/{workspaceId}/boards": {
        if (!pathParams.workspaceId) {
          throw new Error("Missing required path parameters");
        }

        if (typeof pathParams.workspaceId !== "string") {
          throw new Error("workspaceId must be a UUID, 'string'");
        }

        body = await getBoardsInWorkspace(authUserId, pathParams.workspaceId);
        break;
      }

      default:
        statusCode = 404;
        body = { message: `Unsupported route: ${event.routeKey}` };
        break;
    }
  } catch (error) {
    console.error(error);
    statusCode = 400;
    body = { error: error.message };
  }

  return {
    statusCode,
    body: JSON.stringify(body),
  };
};
