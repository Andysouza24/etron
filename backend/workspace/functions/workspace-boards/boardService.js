const workspaceRepo = require("@etron/shared/repositories/workspaceRepository");
const {
  deleteFolder,
  getUploadUrl,
  getDownloadUrl,
} = require("@etron/shared/repositories/workspaceBucketRepository");
const { validateWorkspaceId } = require("@etron/shared/utils/validation");
const { hasPermission } = require("@etron/shared/utils/permissions");
const { v4: uuidv4 } = require("uuid");

const PERMISSIONS = {
  MANAGE_BOARDS: "app.workspace.manage_boards",
};

async function createBoardInWorkspace(authUserId, workspaceId, payload) {
  await validateWorkspaceId(workspaceId);

  const isAuthorised = await hasPermission(
    authUserId,
    workspaceId,
    PERMISSIONS.MANAGE_BOARDS
  );

  if (!isAuthorised) {
    throw new Error("User does not have permission to perform action");
  }

  const { name, config, isDashboard } = payload;

  if (!name || typeof name !== "string") {
    throw new Error("Please specify a name");
  }

  if (!config) {
    throw new Error("Please specify the config");
  }

  const boardId = uuidv4();
  const date = new Date().toISOString();

  // create a new board item
  const boardItem = {
    workspaceId,
    boardId,
    name,
    config,
    isDashboard: isDashboard ? isDashboard : false,
    createdBy: authUserId,
    editedBy: [authUserId],
    createdAt: date,
    updatedAt: date,
  };

  const thumbnailKey = `workspaces/${workspaceId}/boards/${boardId}/thumbnail.jpeg`;

  boardItem.thumbnailKey = thumbnailKey;

  const uploadUrl = await getUploadUrl(thumbnailKey, {
    ContentType: "image/jpeg",
  });

  const downloadUrl = await getDownloadUrl(thumbnailKey);

  await workspaceRepo.addBoard(boardItem);

  return {
    ...boardItem,
    thumbnailUploadUrl: uploadUrl,
    thumbnailUrl: downloadUrl,
  };
}

async function deleteBoardInWorkspace(authUserId, workspaceId, boardId) {
  await validateWorkspaceId(workspaceId);

  const isAuthorised = await hasPermission(
    authUserId,
    workspaceId,
    PERMISSIONS.MANAGE_BOARDS
  );

  if (!isAuthorised) {
    throw new Error("User does not have permission to perform action");
  }

  // get board details
  const board = await workspaceRepo.getBoardById(workspaceId, boardId);

  if (!board) {
    throw new Error("Board not found");
  }

  const folderPrefix = `workspaces/${workspaceId}/boards/${boardId}/`;
  await deleteFolder(folderPrefix);

  await workspaceRepo.removeBoard(workspaceId, boardId);

  return { message: "Board successfully removed" };
}

async function getBoardInWorkspace(authUserId, workspaceId, boardId) {
  await validateWorkspaceId(workspaceId);

  return workspaceRepo.getBoardById(workspaceId, boardId);
}

async function getBoardsInWorkspace(authUserId, workspaceId) {
  await validateWorkspaceId(workspaceId);

  // get all boards in a workspace
  const boards = await workspaceRepo.getBoardsByWorkspaceId(workspaceId);

  if (!boards || boards.length === 0) return [];

  const results = await Promise.all(
    boards.map(async (board) => {
      const thumbnailUrl = board.thumbnailKey
        ? await getDownloadUrl(board.thumbnailKey)
        : null;

      return {
        ...board,
        thumbnailUrl,
      };
    })
  );

  return results;
}

async function updateBoardInWorkspace(
  authUserId,
  workspaceId,
  boardId,
  payload
) {
  await validateWorkspaceId(workspaceId);

  const board = await workspaceRepo.getBoardById(workspaceId, boardId);

  if (!board) {
    throw new Error("Board not found");
  }

  const { name, config, isDashboard, isThumbnailUpdated, ownerId } = payload;
  const currentDate = new Date().toISOString();

  // ensure only unique users are added to editedBy
  const editedBySet = new Set([...(board.editedBy || []), authUserId]);
  if (ownerId) {
    editedBySet.add(ownerId);
  }

  // create board item and update repo
  const boardUpdateItem = {
    updatedAt: currentDate,
    editedBy: Array.from(editedBySet),
  };

  if (ownerId) {
    boardUpdateItem.createdBy = ownerId;
  }

  let thumbnailUploadUrl = null;

  if (name) {
    boardUpdateItem.name = name;
  }

  if (config) {
    boardUpdateItem.config = config;
  }

  if (typeof isDashboard === "boolean") {
    boardUpdateItem.isDashboard = isDashboard;
  }

  if (isThumbnailUpdated) {
    thumbnailUploadUrl = await getUploadUrl(board.thumbnailKey, {
      ContentType: `image/jpeg`,
    });
  }

  const updatedBoard = await workspaceRepo.updateBoard(
    workspaceId,
    boardId,
    boardUpdateItem
  );

  const thumbnailUrl = board.thumbnailKey
    ? await getDownloadUrl(board.thumbnailKey)
    : null;

  return {
    ...updatedBoard,
    thumbnailUrl,
    thumbnailUploadUrl,
  };
}

module.exports = {
  createBoardInWorkspace,
  deleteBoardInWorkspace,
  getBoardInWorkspace,
  getBoardsInWorkspace,
  updateBoardInWorkspace,
};
