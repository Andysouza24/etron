// Orchestrates the daily display view, the aggregation view, and the
// shared paged-scroll machinery used by MetricGraph. Owns:
//
//   - the underlying data hooks (`useDisplayView`, `useAggregationView`)
//   - the paged-scroll hook (`usePagedChartScroll`)
//   - the dual-mode shift handlers (date window vs anchor index) and
//     the snap-resolver wiring that keeps page transitions seamless
//   - the effective visible-window {start, end} surfaced to the caller
//     for header labels
//
// Forward refs solve the cycle between the paging hook's edge callbacks
// and the shift functions that themselves call `paging.scheduleSnap`.

import { useEffect, useRef } from "react";
import {
    createDateSnapResolver,
    createIsoSnapResolver,
} from "../../../../utils/metricChartSnap";
import useAggregationView from "./useAggregationView";
import useDisplayView from "./useDisplayView";
import usePagedChartScroll from "./usePagedChartScroll";

const usePageableTimeSeries = ({
    isDisplayView,
    isAggregationView,
    sortedData,
    yearFilteredData,
    xKey,
    yKeys,
    aggregationPeriod,
    pageDays,
    pageStepDays,
    visibleSpan,
    stepDays,
    interpolate,
    containerWidth,
}) => {
    const isPagedView = isDisplayView || isAggregationView;

    const display = useDisplayView({
        enabled: isDisplayView,
        sortedData: yearFilteredData,
        xKey,
        yKeys,
        pageDays,
        visibleSpan,
        stepDays,
        interpolate,
    });

    const aggregation = useAggregationView({
        enabled: isAggregationView,
        sortedData,
        xKey,
        aggregationPeriod,
        pageSize: pageDays,
        visibleSpan,
    });

    const shiftDailyRef = useRef(null);
    const shiftAggregationRef = useRef(null);

    const pagedSourceRows = isAggregationView ? aggregation.pageRows : display.paddedRows;

    const paging = usePagedChartScroll({
        enabled: isPagedView,
        containerWidth,
        rows: pagedSourceRows,
        visibleSpan,
        chevronStepSlots: 1,
        onEdgePrev: () => (isAggregationView
            ? shiftAggregationRef.current?.(-pageStepDays)
            : shiftDailyRef.current?.(-pageStepDays)),
        onEdgeNext: () => (isAggregationView
            ? shiftAggregationRef.current?.(pageStepDays)
            : shiftDailyRef.current?.(pageStepDays)),
    });

    // Reset the hook's initial pin guard when switching paged modes so
    // each mode pins to its own right edge on first measurement.
    useEffect(() => {
        paging.resetInitialPin();
    }, [isAggregationView, isDisplayView, paging]);

    const displayVisible = isDisplayView ? display.deriveVisibleRange(paging.visible) : null;
    const aggregationVisible = isAggregationView ? aggregation.deriveVisibleRange(paging.visible) : null;

    // Effective window for labels. Falls back to the hook's window values
    // when the scroll machinery hasn't measured yet.
    const windowStart = isAggregationView
        ? (aggregationVisible?.start ?? null)
        : (displayVisible?.start ?? display.windowStart ?? null);
    const windowEnd = isAggregationView
        ? (aggregationVisible?.end ?? null)
        : (displayVisible?.end ?? display.windowEnd ?? null);

    shiftDailyRef.current = (deltaDays) => {
        if (!deltaDays || !display.shift) return false;
        if (deltaDays < 0 && !display.canShiftPrev) return false;
        if (deltaDays > 0 && !display.canShiftNext) return false;
        const targetDate = displayVisible?.start ?? null;
        if (targetDate) paging.scheduleSnap(createDateSnapResolver(xKey, targetDate));
        display.shift(deltaDays);
        return true;
    };

    shiftAggregationRef.current = (deltaBuckets) => {
        const visStartIdx = aggregationVisible?.startIdx ?? 0;
        const targetIso = aggregation.shiftBy(deltaBuckets, visStartIdx);
        if (targetIso) paging.scheduleSnap(createIsoSnapResolver(targetIso));
        return !!targetIso;
    };

    // Jump the display view to a given window-end date (month picker).
    const scrollDisplayViewToEndDate = (endDate) => {
        if (paging.pxPerSlot <= 0 || !display.setWindowEnd) return;
        const visibleStart = new Date(endDate);
        visibleStart.setHours(0, 0, 0, 0);
        visibleStart.setDate(visibleStart.getDate() - (visibleSpan - 1));
        paging.scheduleSnap(createDateSnapResolver(xKey, visibleStart));
        display.setWindowEnd(endDate);
    };

    const canShiftPrev = isAggregationView ? aggregation.canShiftPrev : display.canShiftPrev;
    const canShiftNext = isAggregationView ? aggregation.canShiftNext : display.canShiftNext;
    const disablePrev = !(paging.scrollX > 0.5) && !canShiftPrev;
    const disableNext = !(paging.scrollX < paging.maxScrollX - 0.5) && !canShiftNext;

    return {
        display,
        aggregation,
        paging,
        pagedSourceRows,
        windowStart,
        windowEnd,
        disablePrev,
        disableNext,
        scrollDisplayViewToEndDate,
    };
};

export default usePageableTimeSeries;
