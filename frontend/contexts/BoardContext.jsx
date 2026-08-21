import BoardService from "../services/BoardService";
import { useRef, useCallback, useMemo, createContext, useContext, useState } from "react";
import useBoardSubscription from "../hooks/boards/useBoardSubscription";

const BoardContext = createContext(null);

export function BoardProvider({ children, workspaceId: workspaceIdProp }) {
    const hasFetchedRef = useRef(false);
    const workspaceId = workspaceIdProp || null;

    const [boards, setBoards] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const loadBoards = useCallback(async (showLoading = true) => {
        try {
            if (showLoading) setLoading(true);
            setError(null);
            const allBoards = await BoardService.getAllBoards();
            setBoards(allBoards);
            hasFetchedRef.current = true;
            console.log("[BoardContext] Boards loaded successfully:", allBoards.length, "boards");
            return allBoards;
        } catch (err) {
            console.error("[BoardContext] Error loading boards: ", err);
            setError(err);
            return [];
        } finally {
            setLoading(false);
        }
    }, []);

    const ensureBoards = useCallback(async () => {
        if (!hasFetchedRef.current) {
            return await loadBoards();
        }
        return null;
    }, [loadBoards]);

    const createBoard = useCallback(async (boardData) => {
        try {
            setError(null);
            const result = await BoardService.createBoard(boardData);
            await loadBoards(false);
            console.log("[BoardContext] Board created successfully: ", result);
            return result;
        } catch (err) {
            console.error("[BoardContext] Error creating board: ", err);
            setError(err);
            throw err;
        }
    }, [loadBoards]);

    const deleteBoard = useCallback(async (boardId) => {
        try {
            setError(null);
            await BoardService.deleteBoard(boardId);
            setBoards(prev => prev.filter(b => b.id !== boardId));
            console.log("[BoardContext] Board deleted successfully: ", boardId);
        } catch (err) {
            console.error("[BoardContext] Error deleting board: ", err);
            setError(err);
            await loadBoards(false);
            throw err;
        }
    }, [loadBoards]);

    const updateBoard = useCallback(async (boardId, updates) => {
        try {
            setError(null);
            const result = await BoardService.updateBoard(boardId, updates);
            setBoards(prev => prev.map(b => b.id === boardId ? { ...b, ...result } : b));
            console.log("[BoardContext] Board updated successfully: ", result);
            return result;
        } catch (err) {
            console.error("[BoardContext] Error updating board: ", err);
            setError(err);
            await loadBoards(false);
            throw err;
        }
    }, [loadBoards]);

    const getBoard = useCallback(async (boardId) => {
        return BoardService.getBoard(boardId);
    }, []);

    const duplicateBoard = useCallback(async (boardId) => {
        try {
            setError(null);
            const result = await BoardService.duplicateBoard(boardId);
            await loadBoards(false);
            console.log("[BoardContext] Board duplicated successfully: ", result);
            return result;
        } catch (err) {
            console.error("[BoardContext] Error duplicating board: ", err);
            setError(err);
            throw err;
        }
    }, [loadBoards]);

    useBoardSubscription((boardUpdate) => {
        console.log("[BoardContext] Board subscription fired:", boardUpdate);
        const { action, boardId } = boardUpdate;

        if (action === "DELETE") {
            setBoards(prev => prev.filter(b => b.id !== boardId));
            console.log("[BoardContext] Real-time board deleted:", boardId);
        } else {
            // CREATE or UPDATE — silent refresh to get fully transformed board data
            loadBoards(false);
            console.log("[BoardContext] Real-time board update:", action, boardId);
        }
    }, workspaceId, () => {
        // on subscription reconnect, refetch the board list so the UI
        // catches up on anything that happened while disconnected.
        loadBoards(false);
    });

    const refresh = useCallback(() => loadBoards(true), [loadBoards]);

    const value = useMemo(() => ({
        boards,
        loading,
        error,
        ensureBoards,

        createBoard,
        deleteBoard,
        updateBoard,
        getBoard,
        duplicateBoard,
        refresh,
    }), [boards, loading, error, ensureBoards, createBoard, deleteBoard, updateBoard, getBoard, duplicateBoard, refresh]);

    return (
        <BoardContext.Provider value={value}>
            {children}
        </BoardContext.Provider>
    );
}

export function useBoardContext() {
    const context = useContext(BoardContext);
    if (!context) {
        throw new Error("useBoardContext must be used within a BoardProvider");
    }
    return context;
}

export default BoardContext;