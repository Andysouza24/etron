// Transforms a backend board payload into the frontend board shape.
// Pure data mapping: owner and collaborator profile lookups are injected
// so this module stays free of API and auth dependencies.

const DEFAULT_BOARD_SETTINGS = {
    cols: 12,
    rowHeight: 100,
    margin: [12, 12],
    backgroundColor: null
};

// Normalize a raw access.collaborators array into [{ userId, permission }].
// Accepts the many shapes the backend may send (role/access/level strings,
// canEdit/canView flags) and drops entries with no user id or permission.
export function normalizeCollaborators(rawCollaborators) {
    if (!Array.isArray(rawCollaborators)) return [];

    return rawCollaborators
        .map((entry) => {
            if (!entry) return null;
            const userId = entry.userId || entry.id || entry.user || entry.memberId;
            if (!userId) return null;

            const rawPermission = entry.permission || entry.role || entry.access || entry.level;
            const canEditFlag = entry.canEdit === true || entry.edit === true;
            const canViewFlag = entry.canView === true || entry.view === true;

            let permission = null;
            if (typeof rawPermission === 'string') {
                const lowered = rawPermission.toLowerCase();
                if (lowered === 'edit' || lowered === 'editor') {
                    permission = 'edit';
                } else if (lowered === 'view' || lowered === 'viewer' || lowered === 'read') {
                    permission = 'view';
                }
            }

            if (!permission) {
                if (canEditFlag) {
                    permission = 'edit';
                } else if (canViewFlag) {
                    permission = 'view';
                }
            }

            if (!permission) {
                return null;
            }

            return {
                userId: String(userId),
                permission: permission === 'edit' ? 'edit' : 'view'
            };
        })
        .filter(Boolean);
}

// Transform a backend board into the frontend shape.
// `loadWorkspaceUserProfile(workspaceId, userId)` and `getCurrentUserProfile()`
// are injected async resolvers used to enrich the owner details.
export async function transformBoardFromBackend(
    backendBoard,
    workspaceId,
    { loadWorkspaceUserProfile, getCurrentUserProfile }
) {
    if (!backendBoard) return null;

    const rawConfig = backendBoard.config ?? {};
    const config = { ...rawConfig };
    const rawAccess = config.access ?? {};

    const normalizedCollaborators = normalizeCollaborators(rawAccess.collaborators);

    const ownerId = rawAccess.ownerId || backendBoard.createdBy || null;
    let ownerProfile = null;

    if (workspaceId && ownerId) {
        ownerProfile = await loadWorkspaceUserProfile(workspaceId, ownerId);
    }

    const currentUserProfile = await getCurrentUserProfile();

    const baseOwner = ownerProfile
        ? { ...ownerProfile, id: ownerProfile.userId }
        : ownerId
            ? { id: String(ownerId), userId: String(ownerId), name: null, email: null, picture: null }
            : null;

    let resolvedOwner = baseOwner;

    if (currentUserProfile) {
        if (!resolvedOwner && backendBoard.isDashboard) {
            resolvedOwner = { ...currentUserProfile };
        } else if (resolvedOwner?.userId === currentUserProfile.userId) {
            resolvedOwner = {
                ...resolvedOwner,
                name: resolvedOwner.name || currentUserProfile.name,
                email: resolvedOwner.email || currentUserProfile.email,
                picture: resolvedOwner.picture || currentUserProfile.picture
            };
        }
    }

    const accessOwnerId = resolvedOwner ? resolvedOwner.userId : ownerId ? String(ownerId) : null;

    if (config.access || accessOwnerId || normalizedCollaborators.length) {
        config.access = {
            ...(config.access || {}),
            ownerId: accessOwnerId,
            collaborators: normalizedCollaborators
        };
    }

    const rawAssignments = backendBoard.dashboardAssignments;
    const dashboardAssignments = {
        userIds: Array.isArray(rawAssignments?.userIds) ? rawAssignments.userIds.map(String) : [],
        roleIds: Array.isArray(rawAssignments?.roleIds) ? rawAssignments.roleIds.map(String) : [],
    };

    return {
        id: backendBoard.boardId,
        name: backendBoard.name,
        description: config.description || '',
        items: config.items || [],
        settings: config.settings || { ...DEFAULT_BOARD_SETTINGS },
        isDashboard: backendBoard.isDashboard || false,
        dashboardAssignments,
        thumbnailUrl: backendBoard.thumbnailUrl,
        thumbnailUploadUrl: backendBoard.thumbnailUploadUrl,
        metadata: {
            createdAt: backendBoard.createdAt,
            updatedAt: backendBoard.updatedAt,
            createdBy: backendBoard.createdBy,
            editedBy: backendBoard.editedBy || [],
            ownerId: accessOwnerId,
            version: 1
        },
        owner: resolvedOwner,
        access: config.access || {
            ownerId: accessOwnerId,
            collaborators: normalizedCollaborators
        },
        config,
        _backend: backendBoard
    };
}
