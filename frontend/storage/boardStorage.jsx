import AsyncStorage from "@react-native-async-storage/async-storage";
import AuthService from "../services/AuthService";

const boardsMapKey = "boardsByUser";
const activeBoardKey = "activeBoardByUser";

async function getUserStorageKey() {
    try {
        const info = await AuthService.getCurrentUserInfo();
        const userKey = info?.userId || info?.username || info?.email || null;
        return userKey ? String(userKey) : null;
    } catch {
        return null;
    }
}

async function loadBoardsMap() {
    try {
        const raw = await AsyncStorage.getItem(boardsMapKey);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

async function saveBoardsMap(map) {
    try {
        await AsyncStorage.setItem(boardsMapKey, JSON.stringify(map || {}));
    } catch (error) {
        console.error('[boardStorage] saveBoardsMap error:', error);
    }
}

export async function saveBoards(boards) {
    try {
        const userKey = await getUserStorageKey();
        if (!userKey) {
            console.warn('[boardStorage] No user key available');
            return false;
        }

        const map = await loadBoardsMap();
        map[userKey] = boards || [];
        await saveBoardsMap(map);
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

        const map = await loadBoardsMap();
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
        const userKey = await getUserStorageKey();
        if (!userKey) return false;

        const raw = await AsyncStorage.getItem(activeBoardKey);
        const map = raw ? JSON.parse(raw) : {};
        map[userKey] = boardId;
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
        const userKey = await getUserStorageKey();
        if (!userKey) return null;

        const raw = await AsyncStorage.getItem(activeBoardKey);
        const map = raw ? JSON.parse(raw) : {};
        return map[userKey] || null;
    } catch (error) {
        console.error('[boardStorage] getActiveBoardId error:', error);
        return null;
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

async function loadDraftsMap() {
    try {
        const raw = await AsyncStorage.getItem(draftsKey);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

async function saveDraftsMap(map) {
    try {
        await AsyncStorage.setItem(draftsKey, JSON.stringify(map || {}));
    } catch (error) {
        console.error('[boardStorage] saveDraftsMap error:', error);
    }
}

export async function saveDraft(draft) {
    try {
        const userKey = await getUserStorageKey();
        if (!userKey) {
            console.warn('[boardStorage] No user key available for draft');
            return false;
        }

        const map = await loadDraftsMap();
        if (!map[userKey]) {
            map[userKey] = {};
        }
        
        map[userKey][draft.boardId] = draft;
        await saveDraftsMap(map);
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

        const map = await loadDraftsMap();
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

        const map = await loadDraftsMap();
        if (map[userKey] && map[userKey][boardId]) {
            delete map[userKey][boardId];
            await saveDraftsMap(map);
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

        const map = await loadDraftsMap();
        const userDrafts = map[userKey] || {};
        return Object.values(userDrafts);
    } catch (error) {
        console.error('[boardStorage] getAllDrafts error:', error);
        return [];
    }
}
