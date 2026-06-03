const {
  createBoardInWorkspace,
  updateBoardInWorkspace,
  deleteBoardInWorkspace,
  getBoardInWorkspace,
  getBoardsInWorkspace,
  getDashboardInWorkspace,
} = require("./boardService");
const axios = require("axios");

async function notifyBoardUpdate(board, action){
  const mutation = `
    mutation NotifyBoardUpdate(
      $workspaceId: ID!,
      $boardId: ID!,
      $name: String,
      $config: AWSJSON,
      $isDashboard: Boolean,
      $updatedAt: AWSDateTime,
      $action: String
    ) {
      notifyBoardUpdate(
        workspaceId: $workspaceId,
        boardId: $boardId,
        name: $name,
        config: $config,
        isDashboard: $isDashboard,
        updatedAt: $updatedAt,
        action: $action
      ) {
        workspaceId
        boardId
        name
        config
        isDashboard
        updatedAt
        action
      }
    }
  `;

  const variables = {
    workspaceId: board.workspaceId,
    boardId: board.boardId,
    name: board.name,
    config: board.config ? JSON.stringify(board.config) : null,
    isDashboard: board.isDashboard,
    updatedAt: board.updatedAt,
    action,
  };

  try {
    await axios.post( process.env.APPSYNC_URL,
      { query: mutation, variables },
      {
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.APPSYNC_API_KEY,
        },
      }
    );
  } catch (error) {
    console.error("Unable to send board update notification: ", error.message);
  }
}


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
        await notifyBoardUpdate(body, "CREATE");
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
        await notifyBoardUpdate(body, "UPDATE");
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
        await notifyBoardUpdate(body, "DELETE");
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

      // GET ACTIVE DASHBOARD (no view_boards permission required)
      case "GET /workspace/{workspaceId}/dashboard": {
        if (!pathParams.workspaceId) {
          throw new Error("Missing required path parameters");
        }

        if (typeof pathParams.workspaceId !== "string") {
          throw new Error("workspaceId must be a UUID, 'string'");
        }

        body = await getDashboardInWorkspace(
          authUserId,
          pathParams.workspaceId
        );
        break;
      }

      default:
        statusCode = 404;
        body = { message: `Unsupported route: ${routeKey}` };
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