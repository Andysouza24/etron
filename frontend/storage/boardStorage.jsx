import AsyncStorage from "@react-native-async-storage/async-storage";
import { getWorkspaceId } from "./workspaceStorage";
import { getUserStorageKey, loadMap, saveMap } from "./storageHelpers";

const boardsMapKey = "boardsByUser";
const activeBoardKey = "activeBoardByUser";

async function getActiveBoardScopeKey() {
    const userKey = await getUserStorageKey();
    if (!userKey) return null;
    let workspaceId = null;
    try {
        workspaceId = await getWorkspaceId();
    } catch {
        workspaceId = null;
    }
    return workspaceId ? `${userKey}::${workspaceId}` : userKey;
}

export async function saveBoards(boards) {
    try {
        const userKey = await getUserStorageKey();
        if (!userKey) {
            console.warn('[boardStorage] No user key available');
            return false;
        }

        const map = await loadMap(boardsMapKey);
        map[userKey] = boards || [];
        await saveMap(boardsMapKey, map, '[boardStorage] saveBoardsMap error:');
        console.log('[boardStorage] saveBoards success', { boardCount: boards?.length });
        return true;
    } catch (error) {
        console.error('[boardStorage] saveBoards error:', error);
        return false;
    }
}

export async function loadBoards() {
    try {
        const userKey = await getUserStorageKey();
        if (!userKey) {
            console.warn('[boardStorage] No user key available');
            return [];
        }

        const map = await loadMap(boardsMapKey);
        const boards = map[userKey] || [];
        console.log('[boardStorage] loadBoards success', { boardCount: boards.length });
        return boards;
    } catch (error) {
        console.error('[boardStorage] loadBoards error:', error);
        return [];
    }
}

export async function saveBoard(board) {
    try {
        const boards = await loadBoards();
        const existingIndex = boards.findIndex(b => b.id === board.id);
        
        if (existingIndex >= 0) {
            boards[existingIndex] = { ...board, updatedAt: new Date().toISOString() };
        } else {
            boards.push({ ...board, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
        }

        await saveBoards(boards);
        console.log('[boardStorage] saveBoard success', { boardId: board.id });
        return true;
    } catch (error) {
        console.error('[boardStorage] saveBoard error:', error);
        return false;
    }
}

export async function deleteBoard(boardId) {
    try {
        const boards = await loadBoards();
        const filtered = boards.filter(b => b.id !== boardId);
        await saveBoards(filtered);
        console.log('[boardStorage] deleteBoard success', { boardId });
        return true;
    } catch (error) {
        console.error('[boardStorage] deleteBoard error:', error);
        return false;
    }
}

export async function getBoard(boardId) {
    try {
        const boards = await loadBoards();
        return boards.find(b => b.id === boardId) || null;
    } catch (error) {
        console.error('[boardStorage] getBoard error:', error);
        return null;
    }
}

export async function setActiveBoard(boardId) {
    try {
        const scopeKey = await getActiveBoardScopeKey();
        if (!scopeKey) return false;

        const raw = await AsyncStorage.getItem(activeBoardKey);
        const map = raw ? JSON.parse(raw) : {};
        map[scopeKey] = boardId;
        await AsyncStorage.setItem(activeBoardKey, JSON.stringify(map));
        console.log('[boardStorage] setActiveBoard success', { boardId });
        return true;
    } catch (error) {
        console.error('[boardStorage] setActiveBoard error:', error);
        return false;
    }
}

export async function getActiveBoardId() {
    try {
        const scopeKey = await getActiveBoardScopeKey();
        if (!scopeKey) return null;

        const raw = await AsyncStorage.getItem(activeBoardKey);
        const map = raw ? JSON.parse(raw) : {};
        return map[scopeKey] || null;
    } catch (error) {
        console.error('[boardStorage] getActiveBoardId error:', error);
        return null;
    }
}

export async function clearActiveBoard() {
    try {
        const scopeKey = await getActiveBoardScopeKey();
        if (!scopeKey) return false;

        const raw = await AsyncStorage.getItem(activeBoardKey);
        const map = raw ? JSON.parse(raw) : {};
        if (scopeKey in map) {
            delete map[scopeKey];
            await AsyncStorage.setItem(activeBoardKey, JSON.stringify(map));
        }
        return true;
    } catch (error) {
        console.error('[boardStorage] clearActiveBoard error:', error);
        return false;
    }
}

export async function getActiveBoard() {
    try {
        const boardId = await getActiveBoardId();
        if (!boardId) return null;
        return await getBoard(boardId);
    } catch (error) {
        console.error('[boardStorage] getActiveBoard error:', error);
        return null;
    }
}

export async function duplicateBoard(boardId) {
    try {
        const board = await getBoard(boardId);
        if (!board) return null;

        const newBoard = {
            ...board,
            id: `board_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: `${board.name} (Copy)`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        await saveBoard(newBoard);
        return newBoard;
    } catch (error) {
        console.error('[boardStorage] duplicateBoard error:', error);
        return null;
    }
}

const draftsKey = "boardDraftsByUser";

export async function saveDraft(draft) {
    try {
        const userKey = await getUserStorageKey();
        if (!userKey) {
            console.warn('[boardStorage] No user key available for draft');
            return false;
        }

        const map = await loadMap(draftsKey);
        if (!map[userKey]) {
            map[userKey] = {};
        }
        
        map[userKey][draft.boardId] = draft;
        await saveMap(draftsKey, map, '[boardStorage] saveDraftsMap error:');
        console.log('[boardStorage] saveDraft success', { boardId: draft.boardId });
        return true;
    } catch (error) {
        console.error('[boardStorage] saveDraft error:', error);
        return false;
    }
}

export async function loadDraft(boardId) {
    try {
        const userKey = await getUserStorageKey();
        if (!userKey) {
            console.warn('[boardStorage] No user key available for draft');
            return null;
        }

        const map = await loadMap(draftsKey);
        const draft = map[userKey]?.[boardId] || null;
        console.log('[boardStorage] loadDraft', { boardId, hasDraft: !!draft });
        return draft;
    } catch (error) {
        console.error('[boardStorage] loadDraft error:', error);
        return null;
    }
}

export async function clearDraft(boardId) {
    try {
        const userKey = await getUserStorageKey();
        if (!userKey) return false;

        const map = await loadMap(draftsKey);
        if (map[userKey] && map[userKey][boardId]) {
            delete map[userKey][boardId];
            await saveMap(draftsKey, map, '[boardStorage] saveDraftsMap error:');
            console.log('[boardStorage] clearDraft success', { boardId });
        }
        return true;
    } catch (error) {
        console.error('[boardStorage] clearDraft error:', error);
        return false;
    }
}

export async function getAllDrafts() {
    try {
        const userKey = await getUserStorageKey();
        if (!userKey) return [];

        const map = await loadMap(draftsKey);
        const userDrafts = map[userKey] || {};
        return Object.values(userDrafts);
    } catch (error) {
        console.error('[boardStorage] getAllDrafts error:', error);
        return [];
    }
}
