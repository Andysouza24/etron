// Author(s): Holly Wyatt

// Default time-to-live for cache entries (1 minute)
const DEFAULT_TTS_MS = 60 * 1000; // 1 minute

class PermissionCache {
    // Initialize cache with optional custom TTL
    constructor(ttsMs = DEFAULT_TTS_MS) {
        this.cache = new Map();
        this.ttsMs = ttsMs;
    }

    // Generate cache key from workspace and user IDs
    _key(workspaceId, userId) {
        return `${workspaceId}:${userId}`;
    }

    // Retrieve cached data if it exists and hasn't expired
    get(workspaceId, userId) {
        const key = this._key(workspaceId, userId);
        const entry = this.cache.get(key);
        if (!entry) return null;
        // Delete expired entry
        if (Date.now() - entry.timestamp > this.ttsMs) {
            this.cache.delete(key);
            return null;
        }
        return entry.data;
    }

    // Store data in cache with current timestamp
    set(workspaceId, userId, data) {
        // Evict oldest entries if cache exceeds 500 entries
        if (this.cache.size >= 500) {
            this._evictOldest();
        }
        const key = this._key(workspaceId, userId);
        this.cache.set(key, { data, timestamp: Date.now() });
    }

    // Remove specific user's cached permissions
    invalidate(workspaceId, userId) {
        this.cache.delete(this._key(workspaceId, userId));
    }

    // Remove all cached permissions for a workspace
    invalidateWorkspace(workspaceId) {
        for (const key of this.cache.keys()) {
            if (key.startsWith(`${workspaceId}:`)) {
                this.cache.delete(key);
            }
        }
    }

    // Remove oldest 25% of entries to free space
    _evictOldest() {
        const entries = Array.from(this.cache.entries()).sort((a, b) => a[1].timestamp - b[1].timestamp);
        const removeCount = Math.ceil(this.cache.size * 0.25);
        for (let i = 0; i < removeCount; i++) {
            this.cache.delete(entries[i][0]);
        }
    }
}

// Create singleton instance and export
const permissionCache = new PermissionCache();
module.exports = {
    permissionCache, PermissionCache
};
