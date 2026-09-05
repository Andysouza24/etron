// Shared AsyncStorage helpers for per-user keyed maps.
// Used by workspaceStorage and boardStorage to avoid duplicating the
// user-key lookup and the JSON map load/save logic.

import AsyncStorage from "@react-native-async-storage/async-storage";
import AuthService from "../services/AuthService";

// Resolve a stable per-user key for namespacing stored data.
// Returns null when no signed-in user can be determined.
export async function getUserStorageKey() {
    try {
        const info = await AuthService.getCurrentUserInfo();
        const userKey = info?.userId || info?.username || info?.email || null;
        return userKey ? String(userKey) : null;
    } catch {
        return null;
    }
}

// Read and JSON-parse a stored map, returning {} when missing or invalid.
export async function loadMap(storageKey) {
    try {
        const raw = await AsyncStorage.getItem(storageKey);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

// JSON-stringify and persist a map under storageKey.
// Logs with errorLabel when one is provided, otherwise fails silently
// to preserve each caller's original error-handling behaviour.
export async function saveMap(storageKey, map, errorLabel) {
    try {
        await AsyncStorage.setItem(storageKey, JSON.stringify(map || {}));
    } catch (error) {
        if (errorLabel) console.error(errorLabel, error);
    }
}
