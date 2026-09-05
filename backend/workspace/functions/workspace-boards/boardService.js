const workspaceRepo = require("@etron/shared/repositories/workspaceRepository");
const workspaceUsersRepo = require("@etron/shared/repositories/workspaceUsersRepository");
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
  VIEW_BOARDS: "app.workspace.view_boards",
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

  // workspace membership is always required
  const membership = await workspaceUsersRepo.getUser(workspaceId, authUserId);
  if (!membership) {
    throw new Error("User is not a member of this workspace");
  }

  const board = await workspaceRepo.getBoardById(workspaceId, boardId);
  if (!board) {
    return null;
  }

  // the workspace dashboard is exempt from view_boards — any workspace
  // member can view it (it is the home page for users without board access)
  if (!board.isDashboard) {
    const isAuthorised = await hasPermission(
      authUserId,
      workspaceId,
      PERMISSIONS.VIEW_BOARDS
    );

    if (!isAuthorised) {
      throw new Error("User does not have permission to perform action");
    }
  }

  return board;
}

async function getBoardsInWorkspace(authUserId, workspaceId) {
  await validateWorkspaceId(workspaceId);

  const isAuthorised = await hasPermission(
    authUserId,
    workspaceId,
    PERMISSIONS.VIEW_BOARDS
  );

  if (!isAuthorised) {
    throw new Error("User does not have permission to perform action");
  }

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

// returns the workspace's active dashboard board (isDashboard: true) without
// requiring view_boards permission. Any workspace member can see the dashboard.
// Returns null if no dashboard has been set.
async function getDashboardInWorkspace(authUserId, workspaceId) {
  await validateWorkspaceId(workspaceId);

  // ensure the caller is a member of the workspace
  const membership = await workspaceUsersRepo.getUser(workspaceId, authUserId);
  if (!membership) {
    throw new Error("User is not a member of this workspace");
  }

  const boards = await workspaceRepo.getBoardsByWorkspaceId(workspaceId);

  if (!boards || boards.length === 0) {
    return null;
  }

  const enrichWithThumbnail = async (b) => ({
    ...b,
    thumbnailUrl: b.thumbnailKey ? await getDownloadUrl(b.thumbnailKey) : null,
  });

  // Priority 1: board explicitly assigned to this user
  const userDashboard = boards.find((b) =>
    (b.dashboardAssignments?.userIds || []).includes(authUserId)
  );
  if (userDashboard) return enrichWithThumbnail(userDashboard);

  // Priority 2: board assigned to the user's role
  const userRoleId = membership?.roleId || null;
  if (userRoleId) {
    const roleDashboard = boards.find((b) =>
      (b.dashboardAssignments?.roleIds || []).includes(userRoleId)
    );
    if (roleDashboard) return enrichWithThumbnail(roleDashboard);
  }

  // Priority 3: workspace-wide default
  const workspaceDashboard = boards.find((b) => b.isDashboard);
  if (!workspaceDashboard) return null;

  return enrichWithThumbnail(workspaceDashboard);
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

  const { name, config, isDashboard, isThumbnailUpdated, ownerId, dashboardAssignments } = payload;
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

    // When promoting a board to dashboard, clear the flag from all other boards
    // that currently have it set so getDashboardInWorkspace returns the right one.
    if (isDashboard) {
      const allBoards = await workspaceRepo.getBoardsByWorkspaceId(workspaceId);
      const previousDashboards = allBoards.filter(
        (b) => b.isDashboard && b.boardId !== boardId
      );
      await Promise.all(
        previousDashboards.map((b) =>
          workspaceRepo.updateBoard(workspaceId, b.boardId, {
            isDashboard: false,
            updatedAt: currentDate,
          })
        )
      );
    }
  }

  if (dashboardAssignments) {
    const userIds = Array.isArray(dashboardAssignments.userIds)
      ? dashboardAssignments.userIds.filter(Boolean).map(String)
      : [];
    const roleIds = Array.isArray(dashboardAssignments.roleIds)
      ? dashboardAssignments.roleIds.filter(Boolean).map(String)
      : [];

    boardUpdateItem.dashboardAssignments = { userIds, roleIds };

    // Remove these users/roles from every other board's dashboardAssignments so
    // each user/role can only have one board as their dashboard at a time.
    if (userIds.length || roleIds.length) {
      const allBoards = await workspaceRepo.getBoardsByWorkspaceId(workspaceId);
      await Promise.all(
        allBoards
          .filter((b) => b.boardId !== boardId)
          .map(async (b) => {
            const existing = b.dashboardAssignments || {};
            const prevUserIds = Array.isArray(existing.userIds) ? existing.userIds : [];
            const prevRoleIds = Array.isArray(existing.roleIds) ? existing.roleIds : [];
            const nextUserIds = prevUserIds.filter((uid) => !userIds.includes(uid));
            const nextRoleIds = prevRoleIds.filter((rid) => !roleIds.includes(rid));
            if (
              nextUserIds.length !== prevUserIds.length ||
              nextRoleIds.length !== prevRoleIds.length
            ) {
              await workspaceRepo.updateBoard(workspaceId, b.boardId, {
                dashboardAssignments: { userIds: nextUserIds, roleIds: nextRoleIds },
                updatedAt: currentDate,
              });
            }
          })
      );
    }
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
  getDashboardInWorkspace,
  updateBoardInWorkspace,
};