// Author(s): Rhys Cleary

const workspaceInvitesRepo = require("@etron/shared/repositories/workspaceInvitesRepository");
const workspaceUsersRepo = require("@etron/shared/repositories/workspaceUsersRepository");
const workspaceRepo = require("@etron/shared/repositories/workspaceRepository");
const { validateWorkspaceId } = require("@etron/shared/utils/validation");
const { getUserByEmail } = require("@etron/shared/utils/auth");
const { hasPermission } = require("@etron/shared/utils/permissions");
const { logAuditEvent } = require("@etron/shared/utils/auditLogger");
const { permissionCache } = require("@etron/shared/utils/permissionCache");

// Permissions for this service
const PERMISSIONS = {
    MANAGE_USERS: "app.collaboration.manage_users",
    VIEW_USERS: "app.collaboration.view_users"
};

async function addUserToWorkspace(workspaceId, payload) {
    await validateWorkspaceId(workspaceId);

    const { inviteId } = payload;

    if (!inviteId || typeof inviteId !== "string") {
        throw new Error("Please specify a inviteId");
    }

    // get invite
    const invite = await workspaceInvitesRepo.getInviteById(workspaceId, inviteId);

    if (!invite) {
        throw new Error("Invite not found");
    }

    // get cognito user by email
    const userProfile = await getUserByEmail(invite.email);

    const date = new Date().toISOString();
    
    // create a new user item
    const userItem = {
        workspaceId: workspaceId,
        userId: userProfile.userId,
        email: userProfile.email,
        given_name: userProfile.given_name,
        family_name: userProfile.family_name,
        roleId: invite.roleId,
        joinedAt: date,
        updatedAt: date
    };

    await workspaceUsersRepo.addUser(userItem);

    // now user is added to workspace remove all other invites
    const userInvites = await workspaceInvitesRepo.getInvitesByEmail(userProfile.email);

    if (userInvites.length === 0) {
        throw new Error("No workspace invitations found to remove");
    }
    
    // delete invites
    for (let item of userInvites) {
        await workspaceInvitesRepo.removeInviteById(item.workspaceId, item.inviteId);
    }

    // log audit
    await logAuditEvent({
        workspaceId,
        userId: authUserId,
        action: "Added",
        filters: ["user", "joined"],
        itemType: "user",
        itemId: userProfile.userId,
        itemName: `${userProfile.given_name} ${userProfile.family_name}`
    });

    return userItem;
}

async function updateUserInWorkspace(authUserId, workspaceId, userId, payload) {
    const isAuthorised = await hasPermission(authUserId, workspaceId, PERMISSIONS.MANAGE_USERS);

    if (!isAuthorised) {
        throw new Error("User does not have permission to perform action");
    }

    await validateWorkspaceId(workspaceId);

    const { roleId } = payload;

    // check if the user exists
    const user = await workspaceUsersRepo.getUser(workspaceId, userId);

    if (!user) {
        throw new Error("User not found");
    }

    // check if the role exists
    const role = await workspaceRepo.getRoleById(workspaceId, roleId);

    if (!role) {
        throw new Error("Role not found:", roleId);
    }

    // prevent assigning the Owner role to another user
    if (role.owner) {
        throw new Error("A workspace is limited to one owner");
    }

    const updatedUserItem = {
        roleId 
    };

    // log audit
    await logAuditEvent({
        workspaceId,
        userId: authUserId,
        action: "Updated",
        filters: ["user", "settings", "updated"],
        itemType: "user",
        itemId: userId,
        itemName: `${user.given_name} ${user.family_name}`
    });

    const result = await workspaceUsersRepo.updateUser(workspaceId, userId, updatedUserItem);

    // TODO: make function to reduce repeated code
    permissionCache.invalidate(workspaceId, userId); // invalidate cache for the user
    await workspaceUsersRepo.bumpPermissionsVersion(workspaceId, userId); // bump permissions version for the user

    return result;
}

async function getUserInWorkspace(authUserId, workspaceId, userId) {
    await validateWorkspaceId(workspaceId);

    return workspaceUsersRepo.getUser(workspaceId, userId);
}

async function getUsersInWorkspace(authUserId, workspaceId) {
    const isAuthorised = await hasPermission(authUserId, workspaceId, PERMISSIONS.VIEW_USERS);

    if (!isAuthorised) {
        throw new Error("User does not have permission to perform action");
    }

    await validateWorkspaceId(workspaceId);

    return workspaceUsersRepo.getUsersByWorkspaceId(workspaceId);
}

async function removeUserFromWorkspace(authUserId, workspaceId, userId) {
    let isAuthorised;
    console.log("authUserId:", authUserId);
    console.log("userId:", userId);
    if (authUserId == userId) isAuthorised = true;
    else isAuthorised = await hasPermission(authUserId, workspaceId, PERMISSIONS.MANAGE_USERS);

    if (!isAuthorised) {
        throw new Error("User does not have permission to perform action");
    }

    await validateWorkspaceId(workspaceId);

    permissionCache.invalidate(workspaceId, userId); // invalidate cache for the user

    await workspaceUsersRepo.removeUser(workspaceId, userId);

    return {message: "User successfully removed"};
}

module.exports = {
    addUserToWorkspace,
    updateUserInWorkspace,
    getUserInWorkspace,
    getUsersInWorkspace,
    removeUserFromWorkspace
};