import { useState, useEffect, useCallback, useRef } from "react";
import { Alert } from "react-native";
import { router } from "expo-router";
import BoardService from "../services/BoardService";

export const useBoardData = (boardId) => {
  const [board, setBoard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const hasUnsavedChangesRef = useRef(false);

  const loadBoard = useCallback(async () => {
    if (!boardId) return;

    try {
      setLoading(true);
      const boardData = await BoardService.getBoard(boardId);
      if (boardData) {
        setBoard(boardData);
        await BoardService.markAsViewed(boardId);
      } else {
        Alert.alert("Error", "Board not found", [
          { text: "OK", onPress: () => router.back() },
        ]);
      }
    } catch (error) {
      console.error("Error loading board:", error);
      Alert.alert("Error", "Failed to load board");
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  useEffect(() => {
    return () => {
      if (hasUnsavedChangesRef.current) {
        Alert.alert("Changes Not Saved", "Some changes were kept as a draft.");
      }
    };
  }, []);

  const updateLayout = useCallback(
    async (newLayout) => {
      if (!board || !isEditing) return;

      try {
        const updatedBoard = await BoardService.updateLayout(
          board.id,
          newLayout
        );
        if (updatedBoard) {
          setBoard(updatedBoard);
          hasUnsavedChangesRef.current = false;
        } else {
          hasUnsavedChangesRef.current = true;
        }
      } catch (error) {
        console.error("Error updating layout:", error);
        hasUnsavedChangesRef.current = true;
      }
    },
    [board, isEditing]
  );

  const addItem = useCallback(
    async (item) => {
      if (!board) return;

      try {
        const updatedBoard = await BoardService.addItem(board.id, item);
        if (updatedBoard) {
          setBoard(updatedBoard);
          hasUnsavedChangesRef.current = false;
        } else {
          hasUnsavedChangesRef.current = true;
        }
      } catch (error) {
        console.error("Error adding item:", error);
        hasUnsavedChangesRef.current = true;
      }
    },
    [board]
  );

  const removeItem = useCallback(
    async (itemId) => {
      if (!board) return;

      try {
        const updatedBoard = await BoardService.removeItem(board.id, itemId);
        if (updatedBoard) {
          setBoard(updatedBoard);
          hasUnsavedChangesRef.current = false;
        } else {
          hasUnsavedChangesRef.current = true;
        }
      } catch (error) {
        console.error("Error removing item:", error);
        hasUnsavedChangesRef.current = true;
      }
    },
    [board]
  );

  const updateItem = useCallback(
    async (itemId, updates) => {
      if (!board) return;

      try {
        const updatedBoard = await BoardService.updateItem(
          board.id,
          itemId,
          updates
        );
        if (updatedBoard) {
          setBoard(updatedBoard);
          hasUnsavedChangesRef.current = false;
        } else {
          hasUnsavedChangesRef.current = true;
        }
      } catch (error) {
        console.error("Error updating item:", error);
        hasUnsavedChangesRef.current = true;
      }
    },
    [board]
  );

  return {
    board,
    loading,
    isEditing,
    setIsEditing,
    updateLayout,
    addItem,
    removeItem,
    updateItem,
    refreshBoard: loadBoard,
  };
};
