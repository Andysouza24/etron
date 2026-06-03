// Author(s): Noah Bradley, Holly Wyatt

import AsyncStorage from "@react-native-async-storage/async-storage"

const KEYS = {
    PERMISSIONS: "cached_permissions",
    VERSION: "cached_permission_version",
    IS_OWNER: "cached_is_owner",
    HIDE_GATED: "cached_hide_gated_components"
};

// lightweight in-memory pub/sub so hooks can react to cache writes
// without polling AsyncStorage. fires after every successful save and
// after clearPermissionsCache().
const listeners = new Set();

function notifyPermissionCacheChanged() {
    for (const listener of listeners) {
        try { listener(); } catch { /* ignore listener errors */ }
    }
}

export function subscribePermissionCache(listener) {
    if (typeof listener !== "function") return () => {};
    listeners.add(listener);
    return () => listeners.delete(listener);
}

// in-memory mirror of HIDE_GATED so hooks can read it synchronously on
// first render (AsyncStorage is async, which otherwise causes a one-frame
// flash of disabled-but-visible components before the cache resolves).
let hideGatedSync = false;

export function getHideGatedSync() {
    return hideGatedSync;
}

// hydrate the synchronous mirror from AsyncStorage. called once at app
// boot so the first render of any PermissionGate sees the persisted value.
export async function hydrateHideGatedSync() {
    try {
        const raw = await AsyncStorage.getItem(KEYS.HIDE_GATED);
        hideGatedSync = raw ? JSON.parse(raw) === true : false;
        notifyPermissionCacheChanged();
    } catch {
        hideGatedSync = false;
    }
}

// save permissions, version, and ownership status to AsyncStorage
export async function savePermissionsCache({ permissions, isOwner, version, hideGatedComponents }) {
    hideGatedSync = hideGatedComponents === true;
    await AsyncStorage.multiSet([
        [KEYS.PERMISSIONS, JSON.stringify(permissions || [])],
        [KEYS.VERSION, String(version || 0)],
        [KEYS.IS_OWNER, JSON.stringify(isOwner || false)],
        [KEYS.HIDE_GATED, JSON.stringify(hideGatedComponents === true)]
    ]);
    notifyPermissionCacheChanged();
}

// get cached hide-gated-components flag from AsyncStorage. When true,
// permission-denied components should be hidden rather than disabled.
export async function getCachedHideGatedComponents() {
    const raw = await AsyncStorage.getItem(KEYS.HIDE_GATED);
    return raw ? JSON.parse(raw) === true : false;
}

// get cached permissions from AsyncStorage
export async function getCachedPermissions() {
    const raw = await AsyncStorage.getItem(KEYS.PERMISSIONS);
    return raw ? JSON.parse(raw) : null;
}

// get cached version from AsyncStorage
export async function getCachedVersion() {
    const raw = await AsyncStorage.getItem(KEYS.VERSION);
    return parseInt(raw || "0", 10);
}

// get cached is owner from AsyncStorage
export async function getCachedIsOwner() {
    const raw = await AsyncStorage.getItem(KEYS.IS_OWNER);
    console.log("[PermissionsStorage] getCachedIsOwner raw value:", raw, "type:", typeof raw);
    return raw ? JSON.parse(raw) : false;
}

// clear all cached permissions data from AsyncStorage
export async function clearPermissionsCache() {
    hideGatedSync = false;
    await AsyncStorage.multiRemove(Object.values(KEYS));
    notifyPermissionCacheChanged();
}