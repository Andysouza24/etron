// Author(s): Rhys Cleary

import AsyncStorage from "@react-native-async-storage/async-storage"
import AuthService from "../services/AuthService";

// store workspace information: workspaceId, name, location, description, createdAt, UpdatedAt
const workspaceKey = "workspaceInfo"; // legacy single-entry key (pre multi-account)
const workspaceMapKey = "workspaceInfoByUser"; // new multi-account map key

async function getUserStorageKey() {
    try {
        const info = await AuthService.getCurrentUserInfo();
        const userKey = info?.userId || info?.username || info?.email || null;
        return userKey ? String(userKey) : null;
    } catch {
        return null;
    }
}

async function loadWorkspaceMap() {
    try {
        const raw = await AsyncStorage.getItem(workspaceMapKey);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

async function saveWorkspaceMap(map) {
    try {
        await AsyncStorage.setItem(workspaceMapKey, JSON.stringify(map || {}));
    } catch {}
}

// Try a variety of common keys and shapes to extract an ID from server responses
export function extractWorkspaceId(obj) {
    if (!obj || typeof obj !== 'object') return null;
    const candidates = [
        obj.workspaceId,
        obj.id,
        obj.workspace_id,
        obj.WorkspaceId,
        obj.WorkspaceID,
        obj.ID,
        obj._id,
        obj.uuid,
    ].filter(Boolean);
    if (candidates.length) return String(candidates[0]);
    // look into common nesting patterns
    const nested = obj.workspace || obj.data || obj.item || obj.Item || null;
    if (nested && typeof nested === 'object') return extractWorkspaceId(nested);
    return null;
}

function normalizeWorkspaceShape(raw) {
    if (!raw) return null;
    const base = raw.workspace || raw.data || raw; // prefer nested workspace/data when present
    const id = extractWorkspaceId(base);
    const name = base.name || base.workspaceName || base.title || raw.name || null;
    const description = base.description ?? raw.description ?? null;
    const location = base.location ?? raw.location ?? null;
    // Preserve all original fields but ensure id/workspaceId are present at the top level
    const normalized = { ...base };
    if (id && !normalized.id) normalized.id = id;
    if (id && !normalized.workspaceId) normalized.workspaceId = id;
    if (name && !normalized.name) normalized.name = name;
    if (description !== undefined && normalized.description === undefined) normalized.description = description;
    if (location !== undefined && normalized.location === undefined) normalized.location = location;
    return normalized;
}

export async function saveWorkspaceInfo(workspace) {
    try {
        const normalized = normalizeWorkspaceShape(workspace) || workspace;
        const userKey = await getUserStorageKey();
        //console.log('[workspaceStorage] saveWorkspaceInfo.beforeSave', { userKey, receivedId: extractWorkspaceId(workspace), normalizedId: extractWorkspaceId(normalized) });
        if (userKey) {
            const map = await loadWorkspaceMap();
            map[userKey] = normalized;
            await saveWorkspaceMap(map);
            //console.log('[workspaceStorage] saveWorkspaceInfo (per-user)', { hasWorkspace: !!workspace, workspaceId: extractWorkspaceId(normalized) });
        } else {
            // Fallback to legacy single-entry behavior
            const value = JSON.stringify(normalized);
            await AsyncStorage.setItem(workspaceKey, value);
            //console.log('[workspaceStorage] saveWorkspaceInfo (legacy)', { hasWorkspace: !!workspace, workspaceId: extractWorkspaceId(normalized) });
        }
    } catch (error) {
        console.error("Error saving workspace information: ", error);
    }
}

export async function getWorkspaceInfo() {
    try {
        const userKey = await getUserStorageKey();
        if (userKey) {
            const map = await loadWorkspaceMap();
            let parsed = map[userKey] || null;
            // Migrate legacy single-entry to per-user if exists and user has none
            if (!parsed) {
                const legacy = await AsyncStorage.getItem(workspaceKey);
                const legacyParsed = legacy ? JSON.parse(legacy) : null;
                if (legacyParsed) {
                    const healed = normalizeWorkspaceShape(legacyParsed);
                    if (healed) {
                        map[userKey] = healed;
                        await saveWorkspaceMap(map);
                        // Optionally clear legacy key to avoid confusion
                        try { await AsyncStorage.removeItem(workspaceKey); } catch {}
                        parsed = healed;
                    }
                }
            }
            //const id = extractWorkspaceId(parsed);
            //console.log('[workspaceStorage] getWorkspaceInfo', { userKey, exists: !!parsed, workspaceId: id });
            // Auto-heal shape
            /*if (parsed && id && (!parsed.id || !parsed.workspaceId)) {
                try {
                    const healed = normalizeWorkspaceShape(parsed);
                    if (healed) {
                        const map2 = await loadWorkspaceMap();
                        map2[userKey] = healed;
                        await saveWorkspaceMap(map2);
                    }
                } catch {}
            }*/
            return parsed;
        }
        // Fallback legacy behavior when no user context
        const value = await AsyncStorage.getItem(workspaceKey);
        const parsed = value ? JSON.parse(value) : null;
        //const id = extractWorkspaceId(parsed);
        const id = parsed.workspaceId;
        //console.log('[workspaceStorage] getWorkspaceInfo (legacy)', { exists: !!parsed, workspaceId: id });
        return parsed;
    } catch (error) {
        console.error("Error retrieving workspace information: ", error);
        return null;
    }
}

export async function removeWorkspaceInfo() {
    try {
        const userKey = await getUserStorageKey();
        if (userKey) {
            const map = await loadWorkspaceMap();
            if (map[userKey]) delete map[userKey];
            await saveWorkspaceMap(map);
            //console.log('[workspaceStorage] removeWorkspaceInfo (per-user)', { userKey });
        } else {
            await AsyncStorage.removeItem(workspaceKey);
            //console.log('[workspaceStorage] removeWorkspaceInfo (legacy)');
        }
    } catch (error) {
        console.error("Error removing workspace information: ", error);
    }
}

// get values from the information stored
export async function getWorkspaceId() {
    const workspace = await getWorkspaceInfo();
    if (!workspace) {
        return null;
    }

    const id = extractWorkspaceId(workspace);

    if (id && (!workspace.id || !workspace.workspaceId)) {
        try {
            await saveWorkspaceInfo(workspace);
        } catch (error) {
            console.warn('[workspaceStorage] Failed to normalize workspace info:', error);
        }
    }

    return id || null;
}

// TESTING
/*export async function saveTestWorkspaceInfo() {
    const workspaceData = {
        id: "e676164b-7447-4d39-9118-babb5c97fbb3",
        name: "InSync",
        description: "hello this is a workspace",
        location: "Sydney"
    };

    saveWorkspaceInfo(workspaceData);
}*/

