import { useState, useCallback, useMemo } from 'react';

// Owns the metric detail bottom-sheet: which board item is active and whether
// the sheet is shown. Opening (outside edit mode) fetches the full dataset so
// the detail chart can page across all years. The screen reads activeMetricItem
// to render the sheet and derives per-item metric state separately.
export default function useMetricDetailSheet({ board, editingActive, ensureMetricState }) {
    const [activeMetricItemId, setActiveMetricItemId] = useState(null);
    const [showMetricDetails, setShowMetricDetails] = useState(false);

    const activeMetricItem = useMemo(() => {
        if (!board?.items || !activeMetricItemId) return null;
        return board.items.find(item => item.id === activeMetricItemId) || null;
    }, [board?.items, activeMetricItemId]);

    const open = useCallback((itemId) => {
        if (editingActive) return;

        setActiveMetricItemId(itemId);
        setShowMetricDetails(true);

        const item = board?.items?.find(boardItem => boardItem.id === itemId);
        if (item) {
            // Mirror the view-metric screen by pulling the full dataset
            // so the detail chart can page across all years; otherwise
            // the board's default single-year filter leaves the bottom
            // sheet showing only a handful of points.
            ensureMetricState(item, { forceRefresh: true, fetchParams: { year: 'all' } });
        }
    }, [editingActive, board?.items, ensureMetricState]);

    const close = useCallback(() => {
        setShowMetricDetails(false);
        setActiveMetricItemId(null);
    }, []);

    return { activeMetricItemId, showMetricDetails, activeMetricItem, open, close };
}
