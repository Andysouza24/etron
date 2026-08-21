// Shared date helpers used by the metric chart code paths.
//
// Kept tiny and dependency-free so both UI components and hooks can pull
// them in without dragging the rest of the metric utils.

export const MS_PER_DAY = 86400000;

// Parse anything that resembles a date into a Date, or null when invalid.
export function toDate(value) {
    if (value == null) return null;
    const date = value instanceof Date ? new Date(value) : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

// Return a new Date snapped to local-midnight of the same day.
export function startOfDay(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}

// Return a new Date `days` calendar days after `date`.
export function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

// Sort `data` ascending by the date stored at `xKey`. Returns the original
// array unchanged when the key doesn't hold parseable dates so non-time-
// series data (categorical x values) passes through untouched.
export function sortByDateKey(data, xKey) {
    if (!Array.isArray(data) || data.length === 0 || !xKey) return data;
    if (toDate(data[0]?.[xKey]) == null) return data;
    return [...data].sort((a, b) => {
        const da = toDate(a[xKey]);
        const db = toDate(b[xKey]);
        if (da == null && db == null) return 0;
        if (da == null) return 1;
        if (db == null) return -1;
        return da - db;
    });
}

// Collect the unique years present in `data`, ascending.
export function deriveYears(data, xKey) {
    if (!Array.isArray(data) || !xKey) return [];
    const years = new Set();
    for (const row of data) {
        const date = toDate(row?.[xKey]);
        if (date) years.add(date.getFullYear());
    }
    return [...years].sort((a, b) => a - b);
}
