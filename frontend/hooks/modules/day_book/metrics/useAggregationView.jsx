// Aggregation view: bucketed (weekly / monthly / yearly) time series.
//
// Pre-aggregated rows are decorated with axis markers + gap-fill upstream.
// We page them so the chart never renders more than `pageSize` rows at
// once (sparse multi-year datasets can otherwise blow past Android's
// canvas bitmap limit).
//
// `anchorIndex` is the rightmost bucket included on the current page;
// the page covers [anchor - pageSize + 1, anchor]. Short pages are
// left-padded with synthetic empty buckets when anchored at the last
// bucket so the visible window always shows `visibleSpan` slots (keeps
// bar widths consistent across aggregation modes).

import { useEffect, useMemo, useState } from "react";
import { toDate } from "../../../../utils/metricDateUtils";
import {
    buildAggregationTickLabel,
    decorateAggregatedRows,
    getBucketEnd,
    previousBucketStart,
} from "../../../../utils/metricAggregationPeriod";

const useAggregationView = ({
    enabled,
    sortedData,
    xKey,
    aggregationPeriod,
    pageSize,
    visibleSpan,
}) => {
    const decorated = useMemo(() => {
        if (!enabled) return null;
        return decorateAggregatedRows(sortedData, xKey, aggregationPeriod);
    }, [enabled, sortedData, xKey, aggregationPeriod]);

    const rows = decorated?.rows || [];
    const secondaryTicks = decorated?.secondaryTicks || [];

    const [anchorIndex, setAnchorIndex] = useState(null);
    useEffect(() => {
        if (!enabled || rows.length === 0) {
            if (anchorIndex !== null) setAnchorIndex(null);
            return;
        }
        const lastIdx = rows.length - 1;
        const minAnchor = Math.min(pageSize - 1, lastIdx);
        if (
            anchorIndex == null
            || anchorIndex > lastIdx
            || anchorIndex < minAnchor
        ) {
            setAnchorIndex(lastIdx);
        }
    }, [enabled, rows.length, anchorIndex, pageSize]);

    const pageRows = useMemo(() => {
        if (!enabled || rows.length === 0) return [];
        const lastIdx = rows.length - 1;
        const anchor = Math.min(lastIdx, anchorIndex ?? lastIdx);
        const startIdx = Math.max(0, anchor - pageSize + 1);
        return rows.slice(startIdx, anchor + 1);
    }, [enabled, rows, anchorIndex, pageSize]);

    // Left-pad short pages with synthetic empty buckets so the visible
    // window still shows `visibleSpan` slots. Only when anchored at the
    // dataset's last bucket — earlier pages are full-sized slices.
    const paddedPageRows = useMemo(() => {
        if (!enabled) return pageRows;
        if (!Array.isArray(pageRows) || pageRows.length === 0) return pageRows;
        if (pageRows.length >= visibleSpan) return pageRows;
        const lastIdx = rows.length - 1;
        const anchor = Math.min(lastIdx, anchorIndex ?? lastIdx);
        if (anchor !== lastIdx) return pageRows;
        const firstIso = pageRows[0]?.__bucketStartIso;
        if (!firstIso) return pageRows;
        const missing = visibleSpan - pageRows.length;
        const prefix = [];
        let cursor = toDate(firstIso);
        if (!cursor) return pageRows;
        for (let i = 0; i < missing; i++) {
            cursor = previousBucketStart(cursor, aggregationPeriod);
            if (!cursor) break;
            const label = buildAggregationTickLabel({ startDate: cursor, period: aggregationPeriod });
            prefix.unshift({
                [xKey]: label,
                __bucketStartIso: cursor.toISOString(),
                __bucketLabel: label,
                __interpolated: true,
            });
        }
        return [...prefix, ...pageRows];
    }, [enabled, pageRows, rows.length, anchorIndex, aggregationPeriod, visibleSpan, xKey]);

    const canShiftPrev = enabled
        && anchorIndex != null
        && anchorIndex - pageSize + 1 > 0;
    const canShiftNext = enabled
        && anchorIndex != null
        && anchorIndex < rows.length - 1;

    // Shift by `delta` buckets, returning the visible-start ISO that
    // should be snap-restored after the page re-renders (or null if the
    // shift was a no-op).
    const shiftBy = (delta, visibleStartIdx) => {
        if (!enabled || !delta) return null;
        if (delta < 0 && !canShiftPrev) return null;
        if (delta > 0 && !canShiftNext) return null;
        const targetIso = paddedPageRows[visibleStartIdx]?.__bucketStartIso ?? null;
        let shifted = false;
        setAnchorIndex((current) => {
            if (current == null) return current;
            const lastIdx = rows.length - 1;
            const minAnchor = Math.min(pageSize - 1, lastIdx);
            const next = Math.max(minAnchor, Math.min(lastIdx, current + delta));
            if (next === current) return current;
            shifted = true;
            return next;
        });
        return shifted ? targetIso : null;
    };

    // Map the paging hook's visible slot indices into a {start, end} date
    // range. End is the inclusive last day of the visible-end bucket.
    const deriveVisibleRange = (visible) => {
        if (!enabled || !visible) return null;
        if (!Array.isArray(paddedPageRows) || paddedPageRows.length === 0) return null;
        const { startIdx, endIdx } = visible;
        const start = toDate(paddedPageRows[startIdx]?.__bucketStartIso);
        const endStart = toDate(paddedPageRows[endIdx]?.__bucketStartIso);
        if (!start || !endStart) return null;
        const end = getBucketEnd(endStart, aggregationPeriod) || endStart;
        return { start, end, startIdx, endIdx };
    };

    return {
        pageRows: paddedPageRows,
        secondaryTicks,
        canShiftPrev,
        canShiftNext,
        shiftBy,
        deriveVisibleRange,
    };
};

export default useAggregationView;
