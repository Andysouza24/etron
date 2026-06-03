// Snap-resolver factories for `usePagedChartScroll.scheduleSnap`.
//
// After a page slide the new rows arrive on the next render. The hook
// invokes the recorded resolver with the new rows + geometry; the
// resolver returns the scrollX that keeps the previously-visible row
// under the same screen position so the transition feels like a
// continuous pan.

import { MS_PER_DAY, startOfDay, toDate } from "./metricDateUtils";

// Daily-view rows are spaced one day apart and keyed by `xKey`, so the
// offset is the day delta from the page's first row.
export const createDateSnapResolver = (xKey, targetDate) => ({ rows, pxPerSlot }) => {
    if (!targetDate || !Array.isArray(rows) || rows.length === 0) return null;
    const firstDate = toDate(rows[0]?.[xKey]);
    if (!firstDate) return null;
    const pageStart = startOfDay(firstDate);
    const dayIdx = Math.round((targetDate.getTime() - pageStart.getTime()) / MS_PER_DAY);
    return dayIdx * pxPerSlot;
};

// Aggregation rows aren't always one calendar unit apart (e.g. yearly),
// so identify the visible-start bucket by its `__bucketStartIso` and
// look up its index directly.
export const createIsoSnapResolver = (targetIso) => ({ rows, pxPerSlot }) => {
    if (!targetIso || !Array.isArray(rows) || rows.length === 0) return null;
    const idx = rows.findIndex((r) => r?.__bucketStartIso === targetIso);
    if (idx < 0) return null;
    return idx * pxPerSlot;
};
