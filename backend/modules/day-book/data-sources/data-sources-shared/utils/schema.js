// Author(s): Rhys Cleary
const { getDataSchema, saveSchema } = require("../repositories/dataBucketRepository");
const { createAthenaTable, runDDL } = require("./athenaService");
const { detectDateFormat } = require("./dateParser");
const { sanitiseNumberString, isNumericString, detectCurrencySymbol } = require("./numberSanitiser");

// TODO: figure out a better solution
// Parquet INT64 range: signed 64-bit. Values outside this range cannot be encoded.
const INT64_MAX = 9223372036854775807n; // 2^63 - 1
const INT64_MIN = -9223372036854775808n; // -(2^63)

function fitsInInt64(intStringOrNumber) {
    try {
        const big = typeof intStringOrNumber === 'bigint'
            ? intStringOrNumber
            : BigInt(String(intStringOrNumber).trim());
        return big >= INT64_MIN && big <= INT64_MAX;
    } catch {
        return false;
    }
}

async function saveSchemaAndUpdateTable(workspaceId, dataSourceId, newSchema) {
    const tableName = `ds_${dataSourceId}`;
    const database = process.env.ATHENA_DATABASE;
    const dataLocation = `s3://${process.env.WORKSPACE_BUCKET}/workspaces/${workspaceId}/day-book/dataSources/${dataSourceId}/data/`
    const outputLocation = `s3://${process.env.WORKSPACE_BUCKET}/workspaces/${workspaceId}/day-book/athenaResults/`;

    const existingSchema = await getDataSchema(workspaceId, dataSourceId);

    if (!hasSchemaChanged(existingSchema, newSchema)) {
        console.log("No changes between schemas");
        return;
    }

    // update the athena table
    console.log("Updating Athena table:", tableName);

    await runDDL(`DROP TABLE IF EXISTS \`${sanitiseIdentifier(tableName)}\``, database, outputLocation);

    // create table with the new schema
    console.log("new schema: " + newSchema);
    await createAthenaTable(newSchema, tableName, dataLocation, database, outputLocation);

    // save the new schema
    console.log("Saving schema to S3");
    await saveSchema(workspaceId, dataSourceId, newSchema);
}

function hasSchemaChanged(oldSchema, newSchema) {
    // if theres not an existing schema flag as changed
    if (!oldSchema) return true;
    return JSON.stringify(normaliseSchema(oldSchema)) !== JSON.stringify(normaliseSchema(newSchema));
}

function normaliseSchema(schema) {
    return schema
        .map(column => ({ name: column.name, type: column.type, category: column.category }))
        .sort((a, b) => a.name.localeCompare(b.name));
}

function generateSchema(data) {
    if (!Array.isArray(data) || data.length === 0) {
        throw new Error("Cannot generate a schema from invalid data");
    }

    // for efficently sample a small amount of data
    const sampleData = data.slice(0, 100);

    // for each column, deduce a type from every non-null value in the sample and reconcile mismatches:
    /*  - compatible numeric types (bigint + double / decimal) widen to the broader numeric type rather than collapsing to string
        - genuinely mixed types (number + free text) fall back to string. */
    const schema = {};
    for (const row of sampleData) {
        for (const [column, value] of Object.entries(row)) {
            if (value == null || value === "") continue;
            const deducedType = deduceType(value, column);
            if (!schema[column]) {
                schema[column] = deducedType;
            } else if (schema[column] !== deducedType) {
                schema[column] = unifyTypes(schema[column], deducedType, column);
            }
        }
    }

    // any column that was present but only ever null/empty falls back to string
    for (const row of sampleData) {
        for (const column of Object.keys(row)) {
            if (!schema[column]) schema[column] = "string";
        }
    }

    const result = Object.entries(schema).map(([name, type]) => ({ name, type }));

    // Second pass: check string columns for non-ISO date formats
    for (const column of result) {
        if (column.type === "string") {
            const values = sampleData.map(row => row[column.name]);
            const dateFormat = detectDateFormat(values);
            if (dateFormat) {
                column.type = "timestamp";
                column.dateFormat = dateFormat;
            }
        }
    }

    // Add category to each column
    for (const column of result) {
        column.category = classifyColumn(column.type);
    }

    // For value columns, detect a dominant currency symbol from sample values
    // stored as column.currencySymbol; display-only to exclude from normaliseSchema and avoid triggering Athena table rebuilds
    for (const column of result) {
        if (column.category !== "value") continue;
        const values = sampleData.map(row => row[column.name]);
        const symbol = detectCurrencySymbol(values);
        if (symbol) column.currencySymbol = symbol;
    }

    return result;
}


// Classify a column type into a category: "date", "value", or "dimension".
function classifyColumn(type) {
    const DATE_TYPES = ["timestamp", "date", "datetime", "time"];
    const STRING_TYPES = ["string", "varchar", "char", "text"];
    const t = (type ?? "").toLowerCase();
    if (DATE_TYPES.some(dt => t.includes(dt))) return "date";
    if (STRING_TYPES.some(st => t.includes(st))) return "dimension";
    return "value";
}

function deduceType(value, columnName = "") {
    if (value == null || Number.isNaN(value)) return "string";

    if (typeof value === "number") {
        return Number.isInteger(value) ? "bigint" : "double";
    }

    if (typeof value === "boolean") {
        return "boolean";
    }

    if (typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed === "" || trimmed.toLowerCase() === "nan") return "string";

        // check for ISO timestamps
        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(trimmed)) {
            return "timestamp";
        }

        // check for numeric (including comma-formatted like 1,234 or 1,234.56)
        if (isNumericString(trimmed)) {
            const sanitised = sanitiseNumberString(trimmed);
            if (sanitised.includes(".")) {
                return isMoneyField(columnName) ? "decimal(18,2)" : "double";
            }
            // Integers larger than INT64 (e.g. very large IDs) cannot be stored as bigint;
            // keep them as string to preserve precision and avoid parquet overflow.
            if (!fitsInInt64(sanitised)) return "string";
            return "bigint";
        }

        return "string";
    }

    return "string";
}

function isMoneyField(columnName) {
    const moneyKeywords = ["balance", "price", "amount", "cost", "total"];
    return moneyKeywords.some(keyword => columnName.toLowerCase().includes(keyword));
}

// resolve two deduced types for the same column
// numeric types widen (bigint < double; decimal stays decimal for money fields)
// any mismatch involving a non-numeric type falls back to string
function unifyTypes(a, b, columnName = "") {
    if (a === b) return a;

    const NUMERIC = new Set(["bigint", "double", "decimal(18,2)"]);
    if (NUMERIC.has(a) && NUMERIC.has(b)) {
        // any decimal seen, prefer decimal if the column looks like money,
        // otherwise widen to double - which is the default float type
        if (a === "decimal(18,2)" || b === "decimal(18,2)") {
            return isMoneyField(columnName) ? "decimal(18,2)" : "double";
        }
        // bigint + double -> double (float covers both)
        return "double";
    }

    return "string";
}



// Detect the most likely numeric type for a column of values.
// Returns "bigint", "double", "decimal(18,2)", or null if not convertible.
function detectNumericType(values, columnName = '', numberFormat = 'dot_decimal') {
    const valid = values.filter(v => v != null && String(v).trim() !== '' && String(v).trim().toLowerCase() !== 'nan');
    if (valid.length === 0) return null;

    const numeric = valid.filter(v => isNumericString(v, numberFormat));
    // At least half should be numeric to consider it a numeric column
    if (numeric.length / valid.length < 0.5) return null;

    const hasDecimals = numeric.some(v => {
        const s = sanitiseNumberString(v, numberFormat);
        return s.includes('.');
    });

    if (hasDecimals) {
        return isMoneyField(columnName) ? 'decimal(18,2)' : 'double';
    }
    // If any integer in the sample overflows INT64, fall back to double (precision loss
    // is preferred over a parquet write failure).
    const overflows = numeric.some(v => !fitsInInt64(sanitiseNumberString(v, numberFormat)));
    if (overflows) return 'double';
    return 'bigint';
}

function sanitiseIdentifier(name) {
    return name.replace(/[^A-Za-z0-9_]/g, "_");
}

module.exports = {
    generateSchema,
    saveSchemaAndUpdateTable,
    classifyColumn,
    detectNumericType
};