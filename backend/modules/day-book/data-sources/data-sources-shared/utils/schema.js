// Author(s): Rhys Cleary
const { getDataSchema, saveSchema } = require("../repositories/dataBucketRepository");
const { createAthenaTable, runDDL } = require("./athenaService");
const { detectDateFormat } = require("./dateParser");
const { sanitiseNumberString, isNumericString, detectCurrencySymbol } = require("./numberSanitiser");

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

    const schema = {};
    for (const row of sampleData) {
        for (const [column, value] of Object.entries(row)) {
            if (value == null || value === "") continue;

            const deducedType = deduceType(value, column);

            if (!schema[column]) {
                schema[column] = deducedType;
            } else if (schema[column] !== deducedType) {
                // fallback to string
                schema[column] = "string";
            }
        }
    }

    for (const key of Object.keys(schema)) {
        if (!schema[key]) schema[key] = "string";
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
        const sanitised = sanitiseNumberString(trimmed);
        if (/^-?\d+(\.\d+)?$/.test(sanitised)) {
            if (sanitised.includes(".")) {
                return isMoneyField(columnName) ? "decimal(18,2)" : "double";
            }
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