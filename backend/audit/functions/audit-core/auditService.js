// Author(s): Rhys Cleary

const auditRepo = require("@etron/shared/repositories/auditRepository");
const { validateWorkspaceId } = require("@etron/shared/utils/validation");
const { hasPermission } = require("@etron/shared/utils/permissions");

// Permissions for this service
const PERMISSIONS = {
    VIEW_USER_AUDIT_LOG: "app.audit.view_user_audit_log",
    VIEW_WORKSPACE_AUDIT_LOG: "app.audit.view_workspace_audit_log",
};

async function getWorkspaceLog(authUserId, workspaceId, limit, lastKey) {
    await validateWorkspaceId(workspaceId);

    const isAuthorised = await hasPermission(authUserId, workspaceId, PERMISSIONS.VIEW_WORKSPACE_AUDIT_LOG);

    if (!isAuthorised) {
        throw new Error("User does not have permission to perform action");
    }

    // get workspace logs by workspaceId
    const { items, lastEvaluatedKey } = await auditRepo.getLogsByWorkspaceId(workspaceId, limit, lastKey);

    return {
        items,
        lastKey: lastEvaluatedKey || null
    };
}

async function getUserLog(authUserId, workspaceId, userId, limit, lastKey) {
    await validateWorkspaceId(workspaceId);

    const isAuthorised = await hasPermission(authUserId, workspaceId, PERMISSIONS.VIEW_USER_AUDIT_LOG);

    if (!isAuthorised) {
        throw new Error("User does not have permission to perform action");
    }

    // get user logs by userId
    const { items, lastEvaluatedKey } = await auditRepo.getLogsByUserId(workspaceId, userId, limit, lastKey);

    return {
        items,
        lastKey: lastEvaluatedKey || null
    }
}

// get presigned download URL for the workspace logs archived
async function getWorkspaceLogDownloadUrl(authUserId, workspaceId) {
    await validateWorkspaceId(workspaceId);
    
    const isAuthorised = await hasPermission(authUserId, workspaceId, PERMISSIONS.VIEW_WORKSPACE_AUDIT_LOG);

    if (!isAuthorised) {
        throw new Error("User does not have permission to perform action");
    }

    const key = `workspaces/${workspaceId}/audits/workspace/${workspaceId}.json`
    const fileUrl = await getDownloadUrl(key);

    return {fileUrl};
}

// get presigned download URL for the user logs archived
async function getUserLogDownloadUrl(authUserId, workspaceId, userId) {
    await validateWorkspaceId(workspaceId);
    
    const isAuthorised = await hasPermission(authUserId, workspaceId, PERMISSIONS.VIEW_USER_AUDIT_LOG);

    if (!isAuthorised) {
        throw new Error("User does not have permission to perform action");
    }

    const key = `workspaces/${workspaceId}/audits/users/${userId}.json`
    const fileUrl = await getDownloadUrl(key);
    
    return {fileUrl};
}


module.exports = {
    getWorkspaceLog,
    getUserLog,
    getWorkspaceLogDownloadUrl,
    getUserLogDownloadUrl
};