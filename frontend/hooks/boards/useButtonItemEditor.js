import { useState, useEffect, useCallback } from 'react';
import { createButtonItem, mapItemsToLayout, calculateButtonGridWidth } from '../../utils/boards/itemHandlers';

// Owns the board button-editor modal: visibility, create/edit mode, the
// initial config, and the target item id, plus the create/update handler.
// Cross-cutting concerns (closing other pickers) stay in the screen, which
// wraps openCreate/openEdit. Resets itself when edit mode exits.
export default function useButtonItemEditor({ board, addItem, updateItem, editingActive, gridCols }) {
    const [showButtonPicker, setShowButtonPicker] = useState(false);
    const [buttonEditorMode, setButtonEditorMode] = useState('create');
    const [buttonEditorInitialConfig, setButtonEditorInitialConfig] = useState({});
    const [buttonEditorTargetId, setButtonEditorTargetId] = useState(null);

    useEffect(() => {
        if (!editingActive) {
            setShowButtonPicker(false);
            setButtonEditorMode('create');
            setButtonEditorInitialConfig({});
            setButtonEditorTargetId(null);
        }
    }, [editingActive]);

    const close = useCallback(() => {
        setShowButtonPicker(false);
        setButtonEditorTargetId(null);
        setButtonEditorInitialConfig({});
        setButtonEditorMode('create');
    }, []);

    const openCreate = useCallback(() => {
        setButtonEditorMode('create');
        setButtonEditorInitialConfig({});
        setButtonEditorTargetId(null);
        setShowButtonPicker(true);
    }, []);

    const openEdit = useCallback((item) => {
        if (!item) return;
        setButtonEditorMode('edit');
        setButtonEditorInitialConfig({ ...(item.config || {}) });
        setButtonEditorTargetId(item.id);
        setShowButtonPicker(true);
    }, []);

    const handleSelected = useCallback(async (buttonConfig) => {
        if (!board) {
            close();
            return;
        }

        const trimmedLabel = typeof buttonConfig?.label === 'string'
            ? buttonConfig.label.trim()
            : '';

        if (buttonEditorMode === 'edit' && buttonEditorTargetId) {
            const existingItem = board.items?.find(item => item.id === buttonEditorTargetId);

            if (!existingItem) {
                close();
                return;
            }

            const destinationRoute = typeof buttonConfig.destination === 'string'
                ? buttonConfig.destination
                : buttonConfig.destination?.route
                    ?? existingItem.config?.destination
                    ?? null;

            const updatedLabel = trimmedLabel || existingItem.config?.label || 'Button';

            const updatedConfig = {
                ...existingItem.config,
                label: updatedLabel,
                destination: destinationRoute,
                color: buttonConfig.color ?? existingItem.config?.color,
                icon: buttonConfig.icon ?? existingItem.config?.icon,
                buttonProps: {
                    ...(existingItem.config?.buttonProps ?? {}),
                    icon: buttonConfig.icon ?? existingItem.config?.buttonProps?.icon
                }
            };

            const targetWidth = calculateButtonGridWidth(updatedLabel, gridCols);
            let targetX = existingItem.x ?? 0;
            if (targetX + targetWidth > gridCols) {
                targetX = Math.max(0, gridCols - targetWidth);
            }

            const updates = {
                config: updatedConfig
            };

            if (existingItem.w !== targetWidth) {
                updates.w = targetWidth;
            }
            if (existingItem.x !== targetX) {
                updates.x = targetX;
            }

            await updateItem(existingItem.id, updates);
        } else {
            const existingLayout = mapItemsToLayout(board.items, gridCols);
            const newItem = createButtonItem(buttonConfig, existingLayout, gridCols);

            await addItem(newItem);
        }

        close();
    }, [board, buttonEditorMode, buttonEditorTargetId, addItem, updateItem, close, gridCols]);

    return {
        showButtonPicker,
        buttonEditorMode,
        buttonEditorInitialConfig,
        buttonEditorTargetId,
        openCreate,
        openEdit,
        close,
        handleSelected,
    };
}
