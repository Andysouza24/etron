// sanitises raw JSON payloads from the micromax dashboard export pipeline before translateData runs
// unwrap `{ rows: [...] }` / `{ data: [...], ...metadata }`
// flattens one-level nested objects and records which flat columns came from the same parent so the UI can group them later

const ENVELOPE_ROW_KEYS = ["rows", "data"];

function isPlainObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

// returns { rows, metadata } when `payload` looks like a known envelope, otherwise null
// `metadata` is an object of envelope-level keys to fold onto every row. Scalar values
// pass through; one-level nested objects (eg. `stockTotals: { active, dormant }`) are
// flattened into underscored keys via `flattenRow`, and the parent key is recorded on
// the supplied `groupHints` map so the schema reviewer can group them in the UI.
// Deeper nests / arrays are dropped (no schema column to land on).
function extractEnvelope(payload, groupHints) {
    if (!isPlainObject(payload)) return null;

    for (const key of ENVELOPE_ROW_KEYS) {
        if (Array.isArray(payload[key])) {
            let metadata = {};
            for (const [k, v] of Object.entries(payload)) {
                if (k === key) continue;
                if (v === null || ["string", "number", "boolean"].includes(typeof v)) {
                    metadata[k] = v;
                } else if (isPlainObject(v)) {
                    // flatten one level so eg. `stockTotals: { active, dormant }` becomes
                    // `stockTotals_active`, `stockTotals_dormant` with groupHints set so
                    // the UI can group them under "stockTotals".
                    const flatWrapper = flattenRow({ [k]: v }, groupHints);
                    if (isPlainObject(flatWrapper)) {
                        metadata = { ...metadata, ...flatWrapper };
                    }
                }
                // arrays and deeper nests are dropped
            }
            return { rows: payload[key], metadata };
        }
    }

    return null;
}

// flattens one level of nested objects into underscored keys; deeper nests / arrays are JSON-stringified for schema inference
// any flat key that was derived from a nested object is recorded in `groupHints` against its original parent key
function flattenRow(row, groupHints) {
    if (!isPlainObject(row)) return row;

    const out = {};
    for (const [key, value] of Object.entries(row)) {
        if (isPlainObject(value)) {
            for (const [innerKey, innerValue] of Object.entries(value)) {
                const flatKey = `${key}_${innerKey}`;
                if (isPlainObject(innerValue) || Array.isArray(innerValue)) {
                    out[flatKey] = JSON.stringify(innerValue);
                } else {
                    out[flatKey] = innerValue;
                }
                if (groupHints) groupHints[flatKey] = key;
            }
        } else if (Array.isArray(value)) {
            out[key] = JSON.stringify(value);
        } else {
            out[key] = value;
        }
    }
    return out;
}

// accepts a JSON string/array/object; returns { rows, groupHints } where rows mirrors the input shape when no envelope is detected
// groupHints maps flat column name -> original parent key, empty when nothing was flattened
function sanitiseMicromaxDashboardData(rawData) {
    let parsed = rawData;

    if (typeof rawData === "string") {
        const trimmed = rawData.trim();
        if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
            return { rows: rawData, groupHints: {} };
        }
        try {
            parsed = JSON.parse(trimmed);
        } catch {
            return { rows: rawData, groupHints: {} };
        }
    }

    const groupHints = {};

    const envelope = extractEnvelope(parsed, groupHints);
    if (envelope) {
        const { rows, metadata } = envelope;
        const hasMetadata = Object.keys(metadata).length > 0;
        const flatRows = rows.map((row) => {
            const flat = flattenRow(row, groupHints);
            if (!isPlainObject(flat)) return flat;
            return hasMetadata ? { ...metadata, ...flat } : flat;
        });
        return { rows: flatRows, groupHints };
    }

    if (Array.isArray(parsed)) {
        return { rows: parsed.map((row) => flattenRow(row, groupHints)), groupHints };
    }

    if (isPlainObject(parsed)) {
        return { rows: [flattenRow(parsed, groupHints)], groupHints };
    }

    return { rows: rawData, groupHints: {} };
}

module.exports = {
    sanitiseMicromaxDashboardData,
};
