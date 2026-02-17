// Author(s): Rhys Cleary

const workspaceRepo = require("@etron/shared/repositories/workspaceRepository");
const workspaceUsersRepository = require ("@etron/shared/repositories/workspaceUsersRepository");
const { getDefaultPermissions } = require("@etron/shared/utils/permissions");
const { validateWorkspaceId } = require("@etron/shared/utils/validation");
const {v4 : uuidv4} = require('uuid');
const { hasPermission } = require("@etron/shared/utils/permissions");
const { logAuditEvent } = require("@etron/shared/utils/auditLogger");
const { permissionCache } = require("@etron/shared/utils/permissionCache");

// Permissions for this service
const PERMISSIONS = {
    MANAGE_ROLES: "app.collaboration.manage_roles",
    VIEW_ROLES: "app.collaboration.view_roles"
};

async function createRoleInWorkspace(authUserId, workspaceId, payload) {
    const isAuthorised = await hasPermission(authUserId, workspaceId, PERMISSIONS.MANAGE_ROLES);

    if (!isAuthorised) {
        throw new Error("User does not have permission to perform action");
    }

    await validateWorkspaceId(workspaceId);

    const { name, permissions } = payload;

    if (!name || typeof name !== "string") {
        throw new Error("Please specify a name");
    }

    let rolePermissions = permissions;

    if (!rolePermissions) {
        // get the default permissions. Permissions with defaultStatus: true
        rolePermissions = await getDefaultPermissions();
    }

    if (!Array.isArray(rolePermissions)) {
        throw new Error("Permissions must be an array of strings");
    }

    for (const perm of rolePermissions) {
        if (typeof perm !== "string") {
            throw new Error("Each permission must be a string key");
        }
    }

    const roleId = uuidv4();
    const date = new Date().toISOString();

    // create a new role item
    const roleItem = {
        workspaceId: workspaceId,
        roleId: roleId,
        name: name,
        permissions: rolePermissions,
        createdAt: date,
        updatedAt: date,
        hasAccess: {}
    };

    await workspaceRepo.addRole(roleItem);

    // log audit
    await logAuditEvent({
        workspaceId,
        userId: authUserId,
        action: "Created",
        filters: ["role", "settings"],
        itemType: "role",
        itemId: roleId,
        itemName: name
    });

    return roleItem;
}

async function deleteRoleInWorkspace(authUserId, workspaceId, roleId) {
    const isAuthorised = await hasPermission(authUserId, workspaceId, PERMISSIONS.MANAGE_ROLES);

    if (!isAuthorised) {
        throw new Error("User does not have permission to perform action");
    }

    await validateWorkspaceId(workspaceId);

    const role = await workspaceRepo.getRoleById(workspaceId, roleId);

    if (!role) {
        throw new Error("Role not found:", roleId);
    }

    // prevent deleting the Owner role
    if (role.owner) {
        throw new Error("You cannot delete the Owner role");
    }

    // TODO: make function to reduce repeated code
    permissionCache.invalidateWorkspace(workspaceId); // invalidate cache for all users in the workspace
    await workspaceUsersRepository.bumpPermissionsVersionForRole(workspaceId, roleId); // bump permissions version for role

    await workspaceRepo.removeRole(workspaceId, roleId);

    // log audit
    await logAuditEvent({
        workspaceId,
        userId: authUserId,
        action: "Removed",
        filters: ["removed", "settings"],
        itemType: "role",
        itemId: roleId,
        itemName: role.name
    });

    return {message: "Role successfully deleted"};
}

async function getRoleInWorkspace(authUserId, workspaceId, roleId) {
    const isAuthorised = await hasPermission(authUserId, workspaceId, PERMISSIONS.VIEW_ROLES);

    if (!isAuthorised) {
        throw new Error("User does not have permission to perform action");
    }

    await validateWorkspaceId(workspaceId);

    const role = await workspaceRepo.getRoleById(workspaceId, roleId);

    if (!role) {
        throw new Error("Role not found:", roleId);
    }

    return role;
}

async function getRoleOfUserInWorkspace(authUserId, workspaceId) {
    await validateWorkspaceId(workspaceId);
    
    const user = await workspaceUsersRepository.getUserByUserId(authUserId);

    const role = await workspaceRepo.getRoleById(workspaceId, user.roleId);

    if (!role) {
        throw new Error("Role not found:", user.roleId);
    }

    return role;
}

async function getRolesInWorkspace(authUserId, workspaceId) {
    const isAuthorised = await hasPermission(authUserId, workspaceId, PERMISSIONS.VIEW_ROLES);

    if (!isAuthorised) {
        throw new Error("User does not have permission to perform action");
    }

    await validateWorkspaceId(workspaceId);

    return await workspaceRepo.getRolesByWorkspaceId(workspaceId);
}

async function updateRoleInWorkspace(authUserId, workspaceId, roleId, payload) {
    const isAuthorised = await hasPermission(authUserId, workspaceId, PERMISSIONS.MANAGE_ROLES);

    if (!isAuthorised) {
        throw new Error("User does not have permission to perform action");
    }

    await validateWorkspaceId(workspaceId);

    const role = await workspaceRepo.getRoleById(workspaceId, roleId);

    if (!role) {
        throw new Error("Role not found:", roleId);
    }

    const { name, permissions, hasAccess } = payload;

    const updatedFields = {};

    if (name) {
        if (typeof name !== "string") {
            throw new Error("'name' must be a string");
        }
        updatedFields.name = name;
    }

    if (permissions) {
        if (!Array.isArray(permissions)) {
            throw new Error("Permissions must be an array of strings");
        }

        for (const perm of permissions) {
            if (typeof perm !== "string") {
                throw new Error("Each permission must be a string key");
            }
        }

        updatedFields.permissions = permissions;
    }

    if (hasAccess) {
        if (typeof hasAccess !== "object" || Array.isArray(hasAccess)) {
            throw new Error("'hasAccess' must be an object");
        }

        // merge and duplicate
        const existingAccess = role.hasAccess || {};
        const mergedAccess = { ...existingAccess };

        for (const [resourceType, ids] of Object.entries(hasAccess)) {
            if (!Array.isArray(ids)) {
                throw new Error(`'hasAccess.${resourceType}' must be an array`);
            }

            const existingIds = Array.isArray(existingAccess[resourceType]) ? existingAccess[resourceType] : [];
            mergedAccess[resourceType] = Array.from(new Set([...existingIds, ...ids]));
        }

        updatedFields.hasAccess = mergedAccess;
    }

    const updatedRole = await workspaceRepo.updateRole(workspaceId, roleId, updatedFields);

    permissionCache.invalidateWorkspace(workspaceId); // invalidate cache for all users in the workspace
    await workspaceUsersRepository.bumpPermissionsVersionForRole(workspaceId, roleId); // bump permissions version for role

    // log audit
    await logAuditEvent({
        workspaceId,
        userId: authUserId,
        action: "Updated",
        filters: ["role", "settings"],
        itemType: "role",
        itemId: roleId,
        itemName: updatedRole.name
    });

    return updatedRole;
}

module.exports = {
    createRoleInWorkspace,
    deleteRoleInWorkspace,
    getRoleInWorkspace,
    getRoleOfUserInWorkspace,
    getRolesInWorkspace,
    updateRoleInWorkspace
};