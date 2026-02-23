// Author(s): Noah Bradley, Holly Wyatt

import AsyncStorage from "@react-native-async-storage/async-storage"

const KEYS = {
    PERMISSIONS: "cached_permissions",
    VERSION: "cached_permission_version",
    IS_OWNER: "cached_is_owner"
};

// save permissions, version, and ownership status to AsyncStorage
export async function savePermissionsCache({ permissions, isOwner, version }) {
    await AsyncStorage.multiSet([
        [KEYS.PERMISSIONS, JSON.stringify(permissions || [])],
        [KEYS.VERSION, String(version || 0)],
        [KEYS.IS_OWNER, JSON.stringify(isOwner || false)]
    ]);
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
    await AsyncStorage.multiRemove(Object.values(KEYS));
}