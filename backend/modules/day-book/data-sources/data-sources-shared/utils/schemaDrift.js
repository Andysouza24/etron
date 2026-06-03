// Helpers for handling data-source schemas when an ingest goes wrong.
//
// Three flows are supported:
//   1. First-ingest (no stored schema) - build a permissive all-string schema
//      and flag the data source for review.
//   2. Schema drift (new columns appear, or existing columns change shape) -
//      build an all-string "temp" schema so the incoming data can still be
//      stored against /temp-data/ while the user reviews the change.
//   3. Resolve flow - given the old schema, the temp schema, and the latest
//      sample data, produce a "revised schema" suggestion that uses the
//      auto-detected types for new fields (not "string") and flags which
//      fields are new vs. existing.

const { generateSchema, classifyColumn } = require("./schema");
const { parseDate, parseWithUserFormat } = require("./dateParser");

// fields the ingest pipeline injects on every row; treated as part of every
// schema and ignored when comparing/suggesting fields.
const RESERVED_FIELDS = new Set(["timestamp", "rowId"]);

function isReservedField(name) {
    return RESERVED_FIELDS.has(name);
}

// Build a schema where every non-reserved column is `string`, classified as a
// dimension. `data` should be an array of translated rows (post translateData).
// Used for "pending review" and "error / schema drift" flows.
function buildStringSchema(data) {
    if (!Array.isArray(data) || data.length === 0) return [];
    // collect every column name seen in the sample
    const names = new Set();
    for (const row of data.slice(0, 100)) {
        if (!row || typeof row !== "object") continue;
        for (const key of Object.keys(row)) {
            if (!isReservedField(key)) names.add(key);
        }
    }
    return [...names].map((name) => ({ name, type: "string", category: "dimension" }));
}

// Decide whether `freshData` looks materially different from `storedSchema`.
// Drift criteria (any one triggers):
//   - a new column appears in freshData that has no entry in storedSchema
//   - a stored column would be cast to null for >50% of fresh values
//     (e.g. stored as bigint but the new data contains free text)
// Returns { drifted, addedFields, changedFields }. `addedFields` is a list of
// new column names. `changedFields` is a list of { name, storedType, sampleValues }.
function detectSchemaDrift(storedSchema, freshData) {
    if (!Array.isArray(storedSchema) || storedSchema.length === 0) {
        return { drifted: false, addedFields: [], changedFields: [] };
    }
    if (!Array.isArray(freshData) || freshData.length === 0) {
        return { drifted: false, addedFields: [], changedFields: [] };
    }

    const sample = freshData.slice(0, 100);
    const seenColumns = new Set();
    for (const row of sample) {
        if (!row || typeof row !== "object") continue;
        for (const key of Object.keys(row)) {
            if (!isReservedField(key)) seenColumns.add(key);
        }
    }

    const storedByName = new Map(
        storedSchema.filter((c) => !isReservedField(c.name)).map((c) => [c.name, c]),
    );

    const addedFields = [...seenColumns].filter((name) => !storedByName.has(name));

    const changedFields = [];
    for (const column of storedByName.values()) {
        if (column.type === "string") continue; // anything casts to string
        const values = sample.map((r) => r?.[column.name]).filter((v) => v != null && v !== "");
        if (values.length === 0) continue; // no fresh data for this column
        const incompatible = values.filter((v) => !valueIsCompatibleWithType(v, column.type, column)).length;
        if (incompatible / values.length > 0.5) {
            changedFields.push({
                name: column.name,
                storedType: column.type,
                sampleValues: values.slice(0, 5).map((v) => String(v)),
            });
        }
    }

    return {
        drifted: addedFields.length > 0 || changedFields.length > 0,
        addedFields,
        changedFields,
    };
}

function valueIsCompatibleWithType(value, type, column = null) {
    if (value == null) return true;
    switch (type) {
        case "bigint":
        case "double":
        case "decimal(18,2)": {
            const num = Number(String(value).replace(/[,\s]/g, ""));
            return Number.isFinite(num);
        }
        case "boolean":
            if (typeof value === "boolean") return true;
            if (typeof value === "string") {
                const v = value.trim().toLowerCase();
                return v === "true" || v === "false" || v === "1" || v === "0";
            }
            return false;
        case "timestamp":
        case "date":
        case "datetime":
        case "time": {
            // honour the column's configured date format(s) first so values
            // like "15/01/2024" don't get incorrectly flagged as drift just
            // because they aren't ISO. Falls back to native Date parsing.
            if (value instanceof Date) return !Number.isNaN(value.getTime());
            const userFmt = column?.userDateFormat;
            const fmt = column?.dateFormat;
            try {
                if (userFmt && parseWithUserFormat(value, userFmt)) return true;
            } catch { /* ignore parser errors, fall through */ }
            try {
                if (fmt && parseDate(value, fmt)) return true;
            } catch { /* ignore parser errors, fall through */ }
            const d = new Date(value);
            return !Number.isNaN(d.getTime());
        }
        case "string":
        case "varchar":
        case "char":
        case "text":
        default:
            return true;
    }
}

// Build a "revised schema suggestion" the UI can show against the old schema.
// Returns columns in this order: all old fields first (preserving their
// stored type), then any new fields with auto-detected types. Each column
// carries an `isNew` flag plus, for new fields, `suggestedType` and the
// detected `category` (so it can be string-dimension if appropriate).
//
//   oldSchema: the schema currently stored (frozen at the moment of error)
//   freshData: a sample of translated rows containing both old + new columns
function suggestRevisedSchema(oldSchema, freshData) {
    const oldByName = new Map(
        Array.isArray(oldSchema)
            ? oldSchema.filter((c) => !isReservedField(c.name)).map((c) => [c.name, c])
            : [],
    );

    let inferred = [];
    try {
        inferred = generateSchema(Array.isArray(freshData) ? freshData.slice(0, 100) : []);
    } catch {
        inferred = [];
    }
    const inferredByName = new Map(
        inferred.filter((c) => !isReservedField(c.name)).map((c) => [c.name, c]),
    );

    const result = [];

    // 1. existing columns, in their original order, marked as not-new
    for (const column of oldByName.values()) {
        result.push({ ...column, isNew: false });
    }

    // 2. brand new columns (only present in fresh data), marked isNew with their
    //    inferred type/category - falls back to string-dimension when inference
    //    yields no result.
    for (const [name, column] of inferredByName.entries()) {
        if (oldByName.has(name)) continue;
        result.push({
            name,
            type: column.type || "string",
            category: column.category || classifyColumn(column.type || "string"),
            suggestedType: column.type || "string",
            isNew: true,
            ...(column.dateFormat ? { dateFormat: column.dateFormat } : {}),
            ...(column.currencySymbol ? { currencySymbol: column.currencySymbol } : {}),
        });
    }

    return result;
}

module.exports = {
    RESERVED_FIELDS,
    isReservedField,
    buildStringSchema,
    detectSchemaDrift,
    suggestRevisedSchema,
};
