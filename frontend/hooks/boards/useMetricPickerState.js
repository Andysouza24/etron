import { useState, useCallback } from 'react';
import { createMetricItem, mapItemsToLayout } from '../../utils/boards/itemHandlers';

// Owns the "add metric to board" picker: its visibility and the select handler
// that places a new metric item into the board layout. The screen wraps open()
// to also close the add-item picker.
export default function useMetricPickerState({ board, addItem, gridCols }) {
    const [showMetricPicker, setShowMetricPicker] = useState(false);

    const open = useCallback(() => setShowMetricPicker(true), []);
    const close = useCallback(() => setShowMetricPicker(false), []);

    const handleMetricSelected = useCallback(async (metric) => {
        if (!board) return;

        const existingLayout = mapItemsToLayout(board.items, gridCols);
        const newItem = createMetricItem(metric, existingLayout, gridCols);

        await addItem(newItem);
        setShowMetricPicker(false);
    }, [board, addItem, gridCols]);

    return { showMetricPicker, open, close, handleMetricSelected };
}
