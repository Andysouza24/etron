// Author(s): Rhys Cleary
const { getDataSchema, saveSchema } = require("../repositories/dataBucketRepository");
const { createAthenaTable, runDDL } = require("./athenaService");

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
        .map(column => ({ name: column.name, type: column.type }))
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

    return Object.entries(schema).map(([name, type]) => ({ name, type }));
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

        // check for numeric
        if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
            if (trimmed.includes(".")) {
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


function sanitiseIdentifier(name) {
    return name.replace(/[^A-Za-z0-9_]/g, "_");
}

module.exports = {
    generateSchema,
    saveSchemaAndUpdateTable
};