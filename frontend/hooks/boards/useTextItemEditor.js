import { useState, useEffect, useCallback } from 'react';
import { createTextItem, mapItemsToLayout } from '../../utils/boards/itemHandlers';

const DEFAULT_TEXT_ITEM_CONFIG = {
    text: '',
    alignment: 'left',
    fontSize: 18,
    padding: 16,
    textColor: '',
    backgroundColor: '',
    maxLines: undefined
};

// Owns the board text-editor modal: visibility, create/edit mode, the initial
// config, and the target item id, plus the create/update/save handlers.
// Cross-cutting concerns (closing other pickers) stay in the screen, which
// wraps openCreate/openEdit. Resets itself when edit mode exits.
export default function useTextItemEditor({ board, addItem, updateItem, editingActive, gridCols }) {
    const [showTextEditor, setShowTextEditor] = useState(false);
    const [textEditorMode, setTextEditorMode] = useState('create');
    const [textEditorInitialConfig, setTextEditorInitialConfig] = useState({});
    const [textEditorTargetId, setTextEditorTargetId] = useState(null);

    useEffect(() => {
        if (!editingActive) {
            setShowTextEditor(false);
            setTextEditorTargetId(null);
        }
    }, [editingActive]);

    const close = useCallback(() => {
        setShowTextEditor(false);
        setTextEditorTargetId(null);
        setTextEditorInitialConfig({});
    }, []);

    const openCreate = useCallback(() => {
        setTextEditorMode('create');
        setTextEditorInitialConfig({ ...DEFAULT_TEXT_ITEM_CONFIG });
        setTextEditorTargetId(null);
        setShowTextEditor(true);
    }, []);

    const openEdit = useCallback((item) => {
        if (!item) return;
        setTextEditorMode('edit');
        setTextEditorInitialConfig(item.config || {});
        setTextEditorTargetId(item.id);
        setShowTextEditor(true);
    }, []);

    const normalizeTextConfig = useCallback((config) => {
        return createTextItem(config, [], gridCols).config;
    }, [gridCols]);

    const handleCreateTextItem = useCallback(async (config) => {
        if (!board) return;

        const existingLayout = mapItemsToLayout(board.items, gridCols);
        const newItem = createTextItem(config, existingLayout, gridCols);

        await addItem(newItem);
    }, [board, addItem, gridCols]);

    const handleUpdateTextItem = useCallback(async (itemId, config) => {
        if (!board || !itemId) return;

        const existingItem = board.items?.find(item => item.id === itemId);
        const normalizedConfig = normalizeTextConfig(config);

        await updateItem(itemId, {
            config: {
                ...(existingItem?.config ?? {}),
                ...normalizedConfig
            }
        });
    }, [board, normalizeTextConfig, updateItem]);

    const handleSave = useCallback(async (config) => {
        if (textEditorMode === 'create') {
            await handleCreateTextItem(config);
        } else if (textEditorMode === 'edit' && textEditorTargetId) {
            await handleUpdateTextItem(textEditorTargetId, config);
        }

        setShowTextEditor(false);
        setTextEditorTargetId(null);
        setTextEditorInitialConfig({});
    }, [handleCreateTextItem, handleUpdateTextItem, textEditorMode, textEditorTargetId]);

    return {
        showTextEditor,
        textEditorMode,
        textEditorInitialConfig,
        textEditorTargetId,
        openCreate,
        openEdit,
        close,
        handleSave,
    };
}
