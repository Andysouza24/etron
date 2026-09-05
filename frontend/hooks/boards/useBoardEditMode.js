import { useState, useEffect, useCallback } from 'react';

// Consolidates the board's edit-mode UI state: the header menu, the measured
// grid width, the long-press resize target, and the per-item options sheet.
// Closing the other pickers on long-press is delegated via injected callbacks
// so this hook stays free of the editor/picker hooks.
export default function useBoardEditMode({
    editingActive,
    boardItems,
    initialGridWidth,
    gridHorizontalPadding,
    onCloseButtonPicker,
    onCloseMetricPicker,
    onCloseAddItemPicker,
}) {
    const [menuVisible, setMenuVisible] = useState(false);
    const [activeResizeItemId, setActiveResizeItemId] = useState(null);
    const [gridWidth, setGridWidth] = useState(initialGridWidth);
    const [showEditOptions, setShowEditOptions] = useState(false);
    const [editOptionsItem, setEditOptionsItem] = useState(null);

    const isResizeActive = activeResizeItemId !== null;

    useEffect(() => {
        if (!editingActive) {
            setShowEditOptions(false);
            setEditOptionsItem(null);
        }
    }, [editingActive]);

    useEffect(() => {
        if (!editingActive && activeResizeItemId !== null) {
            setActiveResizeItemId(null);
        }
    }, [editingActive, activeResizeItemId]);

    useEffect(() => {
        if (!activeResizeItemId) return;
        const hasItem = boardItems?.some(item => item.id === activeResizeItemId);
        if (!hasItem) {
            setActiveResizeItemId(null);
        }
    }, [activeResizeItemId, boardItems]);

    const handleGridLayout = useCallback((event) => {
        const rawWidth = event?.nativeEvent?.layout?.width ?? 0;
        if (rawWidth > 0) {
            const adjustedWidth = Math.max(0, rawWidth - gridHorizontalPadding * 2);
            setGridWidth(prev => (prev === adjustedWidth ? prev : adjustedWidth));
        }
    }, [gridHorizontalPadding]);

    const handleItemLongPress = useCallback((itemId) => {
        if (!editingActive) return;
        setActiveResizeItemId(prev => {
            const nextId = prev === itemId ? null : itemId;
            if (nextId !== prev) {
                setShowEditOptions(false);
                setEditOptionsItem(null);
                onCloseAddItemPicker?.();
                onCloseMetricPicker?.();
                onCloseButtonPicker?.();
            }
            return nextId;
        });
    }, [editingActive, onCloseAddItemPicker, onCloseMetricPicker, onCloseButtonPicker]);

    const handleExitResizeMode = useCallback(() => {
        setActiveResizeItemId(null);
        setShowEditOptions(false);
        setEditOptionsItem(null);
    }, []);

    const handleOpenItemOptions = useCallback((item) => {
        if (!item || isResizeActive) return;
        setEditOptionsItem(item);
        setShowEditOptions(true);
    }, [isResizeActive]);

    const handleCloseItemOptions = useCallback(() => {
        setShowEditOptions(false);
        setEditOptionsItem(null);
    }, []);

    return {
        menuVisible,
        setMenuVisible,
        activeResizeItemId,
        isResizeActive,
        gridWidth,
        showEditOptions,
        editOptionsItem,
        handleGridLayout,
        handleItemLongPress,
        handleExitResizeMode,
        handleOpenItemOptions,
        handleCloseItemOptions,
    };
}
