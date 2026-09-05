// Paged horizontal-scroll machinery shared by the daily (display) view and
// the aggregation view in MetricGraph. Both views render a chart sized so
// `visibleSpan` slots exactly fill the container; the rendered chart is
// `rowCount * pxPerSlot` wide so the user can smoothly pan within the
// current page. When the pan reaches either edge we ask the caller to
// shift to a new page (daily slides the date window; aggregation slides
// the anchor index). After the page slides the caller asks us to snap
// `scrollX` so the previously-visible row stays under the same screen
// position — making the page transition feel like a continuous pan.
//
// What this hook owns:
//   - the ScrollView ref + current scrollX
//   - derived geometry (pxPerSlot, chartWidth, maxScrollX, shouldScroll)
//   - visible-slot index calculation (startIdx / endIdx inside the page)
//   - chevron + momentum edge detection (delegates the actual shift to
//     `onEdgePrev` / `onEdgeNext` callbacks)
//   - initial pin-to-right effect (so the most recent data is visible
//     when the chart first measures)
//   - a generic "pending snap" mechanism: callers call `scheduleSnap`
//     with a resolver that runs on the NEXT render (once the new page's
//     rows have arrived) and returns the target scrollX.
//
// What stays with the caller:
//   - paging the underlying data source (date window vs anchor index)
//   - deciding the row identifier used for snap resolution (date for
//     daily, bucket-start ISO for aggregation)

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const usePagedChartScroll = ({
    enabled,
    containerWidth,
    rows,
    visibleSpan,
    chevronStepSlots = 1,
    edgeStepSlots,
    onEdgePrev,
    onEdgeNext,
}) => {
    const scrollRef = useRef(null);
    const [scrollX, setScrollX] = useState(0);

    const rowCount = Array.isArray(rows) ? rows.length : 0;

    const pxPerSlot = enabled && containerWidth > 0 && visibleSpan > 0
        ? containerWidth / visibleSpan
        : 0;
    const chartWidth = enabled && pxPerSlot > 0 ? rowCount * pxPerSlot : 0;
    const maxScrollX = Math.max(0, chartWidth - containerWidth);
    const shouldScroll = enabled && maxScrollX > 0;

    // Map current scrollX to the inclusive [startIdx, endIdx] of slots
    // visible in the page. Rounds so the labels snap to the nearest slot
    // even mid-gesture.
    const visible = useMemo(() => {
        if (!enabled || pxPerSlot <= 0 || rowCount <= 0) return null;
        const span = Math.min(visibleSpan, rowCount);
        const startIdx = Math.max(
            0,
            Math.min(rowCount - span, Math.round(scrollX / pxPerSlot))
        );
        const endIdx = Math.min(rowCount - 1, startIdx + span - 1);
        return { startIdx, endIdx, span };
    }, [enabled, pxPerSlot, rowCount, scrollX, visibleSpan]);

    // Edge step in pixels — how far to advance the visible viewport when
    // we run off the page and have to bring in a new page. Callers can
    // pass this through to their shift function if they want, but the
    // hook itself only uses it for the chevron stride.
    const edgePx = pxPerSlot > 0 ? pxPerSlot * (edgeStepSlots ?? visibleSpan) : 0;
    const chevronPx = pxPerSlot > 0 ? pxPerSlot * chevronStepSlots : 0;

    const onScroll = useCallback((e) => {
        const x = e?.nativeEvent?.contentOffset?.x;
        if (typeof x === "number") setScrollX(x);
    }, []);

    const handlePrev = useCallback(() => {
        if (!scrollRef.current || pxPerSlot <= 0) return;
        if (scrollX > 0.5) {
            const target = Math.max(0, scrollX - chevronPx);
            scrollRef.current.scrollTo({ x: target, animated: true });
            return;
        }
        onEdgePrev?.();
    }, [scrollX, chevronPx, pxPerSlot, onEdgePrev]);

    const handleNext = useCallback(() => {
        if (!scrollRef.current || pxPerSlot <= 0) return;
        if (scrollX < maxScrollX - 0.5) {
            const target = Math.min(maxScrollX, scrollX + chevronPx);
            scrollRef.current.scrollTo({ x: target, animated: true });
            return;
        }
        onEdgeNext?.();
    }, [scrollX, maxScrollX, chevronPx, pxPerSlot, onEdgeNext]);

    const handleMomentumScrollEnd = useCallback((e) => {
        const x = e?.nativeEvent?.contentOffset?.x ?? 0;
        if (x <= 0.5) onEdgePrev?.();
        else if (x >= maxScrollX - 0.5) onEdgeNext?.();
    }, [maxScrollX, onEdgePrev, onEdgeNext]);

    // Pending-snap mechanism. `scheduleSnap(resolver)` records a resolver
    // that runs once the rows reference changes (i.e. after the caller's
    // shift has produced a new page). The resolver receives the new rows
    // plus the latest geometry and returns the target scrollX (or null/
    // undefined to skip).
    const pendingResolverRef = useRef(null);
    const scheduleSnap = useCallback((resolver) => {
        pendingResolverRef.current = typeof resolver === "function" ? resolver : null;
    }, []);

    useEffect(() => {
        if (!enabled) return undefined;
        const resolver = pendingResolverRef.current;
        if (!resolver) return undefined;
        if (!scrollRef.current || pxPerSlot <= 0) return undefined;
        pendingResolverRef.current = null;
        const target = resolver({ rows, pxPerSlot, maxScrollX });
        if (typeof target !== "number" || !Number.isFinite(target)) return undefined;
        const clamped = Math.max(0, Math.min(maxScrollX, target));
        const id = setTimeout(() => {
            scrollRef.current?.scrollTo?.({ x: clamped, animated: false });
        }, 0);
        return () => clearTimeout(id);
    }, [enabled, rows, pxPerSlot, maxScrollX]);

    // Pin to the right edge on first measurement so the most recent rows
    // are visible. Reset by the caller via `resetInitialPin` when the
    // paged mode toggles (e.g. switching between daily and aggregation).
    const initialPinRef = useRef(false);
    useEffect(() => {
        if (!enabled) {
            initialPinRef.current = false;
            return undefined;
        }
        if (initialPinRef.current) return undefined;
        if (!scrollRef.current || maxScrollX <= 0) return undefined;
        initialPinRef.current = true;
        const id = setTimeout(() => {
            scrollRef.current?.scrollTo?.({ x: maxScrollX, animated: false });
        }, 50);
        return () => clearTimeout(id);
    }, [enabled, maxScrollX]);

    const resetInitialPin = useCallback(() => {
        initialPinRef.current = false;
    }, []);

    return {
        scrollRef,
        scrollX,
        onScroll,
        pxPerSlot,
        chartWidth,
        maxScrollX,
        shouldScroll,
        visible,
        edgePx,
        handlePrev,
        handleNext,
        handleMomentumScrollEnd,
        scheduleSnap,
        resetInitialPin,
    };
};

export default usePagedChartScroll;
