// Manages a sliding date window over an already-sorted dataset.
//
// Use this for time-series views that show a fixed-size slice (e.g. 7 days
// for the default view) and let the user shuffle the slice forward/back
// with chevron buttons.
//
// Inputs:
//   sortedData       - rows already sorted ascending by `xKey`.
//   xKey             - the row property holding the date value.
//   windowDays       - number of days inclusive in the visible window.
//   stepDays         - how far `shift` moves per click.
//   enabled          - skip all work and return the original data when false.
//   fillMissingDays  - synthesise one row per day in the window; days with
//                      no source row get a row carrying only `xKey`.
//   yKeys            - dependent-variable keys present on source rows.
//                      Only used by interpolation.
//   interpolate      - when true (and `fillMissingDays` is on), synthetic
//                      rows get linearly-interpolated y-values from the
//                      surrounding real data. Nearest real value is
//                      carried over past the extremes (no extrapolation).
//
// Window is clamped to the dataset's date range; the user cannot scroll
// past either end. If the data range is shorter than `windowDays` the
// full range is shown.

import { useCallback, useEffect, useMemo, useState } from "react";
import { addDays, startOfDay, toDate } from "../../../../utils/metricDateUtils";

const useDateWindow = ({
    sortedData,
    xKey,
    windowDays = 7,
    stepDays = 1,
    enabled = true,
    fillMissingDays = false,
    yKeys = null,
    interpolate = false,
}) => {
    const dataRange = useMemo(() => {
        if (!enabled || !Array.isArray(sortedData) || sortedData.length === 0 || !xKey) {
            return null;
        }
        let min = null;
        let max = null;
        for (const row of sortedData) {
            const date = toDate(row?.[xKey]);
            if (!date) continue;
            if (!min || date < min) min = date;
            if (!max || date > max) max = date;
        }
        if (!min || !max) return null;
        return { min: startOfDay(min), max: startOfDay(max) };
    }, [enabled, sortedData, xKey]);

    // Lowest legal `windowEnd`. Anchoring by windowEnd, the window covers
    // [windowEnd - (windowDays - 1), windowEnd]. To stay inside the data
    // range, windowEnd must be at least `dataRange.min + (windowDays - 1)`.
    // If the data range is shorter, fall back to dataRange.max so the
    // chart simply shows everything it has.
    const minWindowEnd = useMemo(() => {
        if (!dataRange) return null;
        const candidate = startOfDay(addDays(dataRange.min, windowDays - 1));
        return candidate.getTime() > dataRange.max.getTime()
            ? dataRange.max
            : candidate;
    }, [dataRange, windowDays]);

    const [anchorEnd, setAnchorEnd] = useState(null);

    // Re-anchor to the most recent date whenever the dataset's range
    // changes or the current anchor falls outside the allowed range.
    useEffect(() => {
        if (!dataRange || !minWindowEnd) {
            if (anchorEnd !== null) setAnchorEnd(null);
            return;
        }
        if (
            !anchorEnd ||
            anchorEnd.getTime() > dataRange.max.getTime() ||
            anchorEnd.getTime() < minWindowEnd.getTime()
        ) {
            setAnchorEnd(dataRange.max);
        }
    }, [dataRange, minWindowEnd, anchorEnd]);

    const windowEnd = anchorEnd;
    const windowStart = useMemo(() => {
        if (!windowEnd) return null;
        return startOfDay(addDays(windowEnd, -(windowDays - 1)));
    }, [windowEnd, windowDays]);

    // Per-y-key list of real (time, value) points across the dataset.
    // Used to linearly interpolate y-values for synthetic days. Times
    // are start-of-day; if multiple rows share a day the first wins.
    const realPointsByY = useMemo(() => {
        if (!enabled || !interpolate || !Array.isArray(yKeys) || yKeys.length === 0) {
            return null;
        }
        const seenDayByY = {};
        const result = {};
        for (const yKey of yKeys) {
            seenDayByY[yKey] = new Set();
            result[yKey] = [];
        }
        for (const row of sortedData) {
            const date = toDate(row?.[xKey]);
            if (!date) continue;
            const dayTime = startOfDay(date).getTime();
            for (const yKey of yKeys) {
                const value = Number(row?.[yKey]);
                if (!Number.isFinite(value)) continue;
                if (seenDayByY[yKey].has(dayTime)) continue;
                seenDayByY[yKey].add(dayTime);
                result[yKey].push({ time: dayTime, value });
            }
        }
        return result;
    }, [enabled, interpolate, sortedData, xKey, yKeys]);

    const interpolateRow = useCallback((dayTime) => {
        if (!realPointsByY) return null;
        const synthetic = { [xKey]: new Date(dayTime).toISOString(), __interpolated: true };
        let populated = false;
        for (const yKey of Object.keys(realPointsByY)) {
            const points = realPointsByY[yKey];
            if (!points || points.length === 0) continue;
            // Binary search for the largest point.time <= dayTime.
            let lo = 0;
            let hi = points.length - 1;
            let beforeIdx = -1;
            while (lo <= hi) {
                const mid = (lo + hi) >> 1;
                if (points[mid].time <= dayTime) {
                    beforeIdx = mid;
                    lo = mid + 1;
                } else {
                    hi = mid - 1;
                }
            }
            const before = beforeIdx >= 0 ? points[beforeIdx] : null;
            const after = beforeIdx + 1 < points.length ? points[beforeIdx + 1] : null;
            if (before && after) {
                const span = after.time - before.time;
                const t = span > 0 ? (dayTime - before.time) / span : 0;
                synthetic[yKey] = before.value + (after.value - before.value) * t;
                populated = true;
            } else if (before) {
                synthetic[yKey] = before.value;
                populated = true;
            } else if (after) {
                synthetic[yKey] = after.value;
                populated = true;
            }
        }
        return populated ? synthetic : null;
    }, [realPointsByY, xKey]);

    const windowData = useMemo(() => {
        if (!enabled || !windowStart || !windowEnd) return sortedData;

        // Clamp the slice to the actual data range so padding past either
        // extreme never produces empty scroll space.
        let sliceStart = windowStart;
        let sliceEnd = windowEnd;
        if (dataRange) {
            if (sliceStart.getTime() < dataRange.min.getTime()) sliceStart = dataRange.min;
            if (sliceEnd.getTime() > dataRange.max.getTime()) sliceEnd = dataRange.max;
        }

        // Bucket source rows by start-of-day for lookup while walking the
        // window calendar below.
        const rowsByDay = new Map();
        for (const row of sortedData) {
            const date = toDate(row?.[xKey]);
            if (!date) continue;
            const dayKey = startOfDay(date).getTime();
            if (dayKey < sliceStart.getTime() || dayKey > sliceEnd.getTime()) continue;
            if (!rowsByDay.has(dayKey)) rowsByDay.set(dayKey, row);
        }

        if (!fillMissingDays) {
            return [...rowsByDay.values()];
        }

        // Walk one day at a time so every day in the window is represented.
        const result = [];
        const cursor = new Date(sliceStart);
        const endTime = sliceEnd.getTime();
        while (cursor.getTime() <= endTime) {
            const dayKey = cursor.getTime();
            const existing = rowsByDay.get(dayKey);
            if (existing) {
                result.push(existing);
            } else if (xKey) {
                const interpolated = interpolate ? interpolateRow(dayKey) : null;
                if (interpolated) {
                    result.push(interpolated);
                } else {
                    result.push({ [xKey]: new Date(cursor).toISOString(), __interpolated: true });
                }
            }
            cursor.setDate(cursor.getDate() + 1);
        }
        return result;
    }, [enabled, sortedData, xKey, windowStart, windowEnd, fillMissingDays, interpolate, interpolateRow, dataRange]);

    const shift = useCallback((deltaDays) => {
        setAnchorEnd((current) => {
            if (!current || !dataRange || !minWindowEnd) return current;
            const nextDay = startOfDay(addDays(current, deltaDays));
            if (nextDay.getTime() > dataRange.max.getTime()) return dataRange.max;
            if (nextDay.getTime() < minWindowEnd.getTime()) return minWindowEnd;
            return nextDay;
        });
    }, [dataRange, minWindowEnd]);

    // Jump the window so it ends on a specific day, clamped to the
    // allowed range. Used by jump-to-month and similar shortcuts.
    const setWindowEnd = useCallback((nextEnd) => {
        if (!dataRange || !minWindowEnd) return;
        const date = nextEnd instanceof Date ? nextEnd : toDate(nextEnd);
        if (!date) return;
        let clamped = startOfDay(date);
        if (clamped.getTime() > dataRange.max.getTime()) clamped = dataRange.max;
        if (clamped.getTime() < minWindowEnd.getTime()) clamped = minWindowEnd;
        setAnchorEnd(clamped);
    }, [dataRange, minWindowEnd]);

    const canShiftPrev = !!(
        minWindowEnd && windowEnd && windowEnd.getTime() > minWindowEnd.getTime()
    );
    const canShiftNext = !!(
        dataRange && windowEnd && windowEnd.getTime() < dataRange.max.getTime()
    );

    return {
        windowData,
        windowStart,
        windowEnd,
        shift,
        setWindowEnd,
        stepDays,
        canShiftPrev,
        canShiftNext,
        dataRangeMin: dataRange?.min ?? null,
        dataRangeMax: dataRange?.max ?? null,
    };
};

export default useDateWindow;
