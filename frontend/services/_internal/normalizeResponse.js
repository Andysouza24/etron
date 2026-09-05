// Flexible extraction of a list from varied backend response shapes.
// Different endpoints wrap their arrays under different keys (data, items,
// results, …) or nest them one level under `data`; this finds the array
// regardless, falling back to the first array value present in the object.

// Wrapper keys checked across most list endpoints, in priority order.
const DEFAULT_LIST_KEYS = ["data", "items", "results", "list", "value", "records", "rows", "Items"];

// Return the first truthy value, mirroring an `a || b || c` chain.
function firstTruthy(values) {
    for (const value of values) {
        if (value) return value;
    }
    return undefined;
}

// Extract an array from a response body. Order of attempts:
//   1. the body is already an array;
//   2. the first truthy wrapper key whose value is an array;
//   3. (when underDataKeys given) the same search one level under `data`;
//   4. the first array value anywhere in the object.
// Returns null when no array can be found, so callers can decide the default.
export function extractList(raw, { keys = DEFAULT_LIST_KEYS, underDataKeys = null } = {}) {
    if (Array.isArray(raw)) return raw;
    if (!raw || typeof raw !== "object") return null;

    const direct = firstTruthy(keys.map((key) => raw[key]));
    if (Array.isArray(direct)) return direct;

    if (underDataKeys && raw.data && typeof raw.data === "object") {
        const underData = firstTruthy(underDataKeys.map((key) => raw.data[key]));
        if (Array.isArray(underData)) return underData;
    }

    const firstArray = Object.values(raw).find((value) => Array.isArray(value));
    return Array.isArray(firstArray) ? firstArray : null;
}

export { DEFAULT_LIST_KEYS };
