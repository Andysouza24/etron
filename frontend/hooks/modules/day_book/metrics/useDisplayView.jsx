// Display view: the 7-day daily window with chevron paging and a month
// picker. Wraps `useDateWindow` and layers on:
//   - left-padding short data ranges so the chart always shows at least
//     `visibleSpan` days (last data point pinned to the right edge).
//   - a `visibleRange` derivation that maps the paging hook's slot
//     indices into a {start, end} date range used for header labels.

import { useMemo } from "react";
import useDateWindow from "./useDateWindow";
import { addDays, startOfDay, toDate } from "../../../../utils/metricDateUtils";

const useDisplayView = ({
    enabled,
    sortedData,
    xKey,
    yKeys,
    pageDays,
    visibleSpan,
    stepDays,
    interpolate,
}) => {
    const dateWindow = useDateWindow({
        sortedData,
        xKey,
        windowDays: pageDays,
        stepDays,
        enabled,
        fillMissingDays: true,
        yKeys,
        interpolate,
    });

    // For short data ranges (< visibleSpan) the chart would otherwise
    // render only a few days wide with the last point jammed against the
    // right edge. Prepend synthetic empty days so the rendered window
    // always spans at least `visibleSpan`, only when anchored at the
    // dataset's last day.
    const paddedRows = useMemo(() => {
        const { windowData, windowEnd, dataRangeMax } = dateWindow;
        if (!enabled || !Array.isArray(windowData) || windowData.length === 0) return windowData;
        if (windowData.length >= visibleSpan) return windowData;
        if (!windowEnd || !dataRangeMax) return windowData;
        if (windowEnd.getTime() !== dataRangeMax.getTime()) return windowData;
        const firstDate = toDate(windowData[0]?.[xKey]);
        if (!firstDate) return windowData;
        const cursor = startOfDay(firstDate);
        const missing = visibleSpan - windowData.length;
        const prefix = [];
        for (let i = missing; i >= 1; i--) {
            prefix.push({
                [xKey]: addDays(cursor, -i).toISOString(),
                __interpolated: true,
            });
        }
        return [...prefix, ...windowData];
    }, [enabled, dateWindow, visibleSpan, xKey]);

    // Map the paging hook's visible slot indices into a date range.
    const deriveVisibleRange = (visible) => {
        if (!enabled || !visible) return null;
        if (!Array.isArray(paddedRows) || paddedRows.length === 0) return null;
        const firstDate = toDate(paddedRows[0]?.[xKey]);
        if (!firstDate) return null;
        const { startIdx, endIdx } = visible;
        const pageStart = startOfDay(firstDate);
        return {
            start: addDays(pageStart, startIdx),
            end: addDays(pageStart, endIdx),
            startIdx,
            endIdx,
        };
    };

    return {
        ...dateWindow,
        paddedRows,
        deriveVisibleRange,
    };
};

export default useDisplayView;
