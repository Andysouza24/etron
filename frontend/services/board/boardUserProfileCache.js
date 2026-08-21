import apiClient from '../../utils/api/apiClient';
import endpoints from '../../utils/api/endpoints';

// Per-workspace cache of user profiles, keyed by `${workspaceId}:${userId}`.
// Returns a loader that fetches a profile once and caches the result —
// including null misses — so repeated board transforms avoid duplicate calls.
export function createWorkspaceUserProfileCache() {
    const cache = new Map();

    return async function loadWorkspaceUserProfile(workspaceId, userId) {
        if (!workspaceId || !userId) {
            return null;
        }

        const cacheKey = `${workspaceId}:${userId}`;

        if (cache.has(cacheKey)) {
            return cache.get(cacheKey);
        }

        try {
            const response = await apiClient.get(endpoints.workspace.users.getUser(workspaceId, userId));
            const data = response?.data;
            if (data?.userId) {
                const nameParts = [data.given_name, data.family_name].filter(Boolean);
                const fullName = nameParts.length ? nameParts.join(' ') : null;
                const profile = {
                    userId: String(data.userId),
                    name: fullName || data.email || 'Workspace Member',
                    email: data.email || null,
                    picture: data.picture || data.avatarUrl || null
                };
                cache.set(cacheKey, profile);
                return profile;
            }
        } catch (error) {
            console.error('[BoardService] Failed to load workspace user profile:', error);
        }

        cache.set(cacheKey, null);
        return null;
    };
}
