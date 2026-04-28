// Author(s): Rhys Cleary, Holly Wyatt
// CSV schema preview & confirmation flow.

const dataSourceRepo = require("@etron/day-book-shared/repositories/dataSourceRepository");
const { appendToStoredData, replaceStoredData } = require("@etron/data-sources-shared/repositories/dataBucketRepository");
const { validateFormat } = require("@etron/data-sources-shared/utils/validateFormat");
const { translateData } = require("@etron/data-sources-shared/utils/translateData");
const { toParquet } = require("@etron/data-sources-shared/utils/typeConversion");
const { generateSchema, detectNumericType, saveSchemaAndUpdateTable } = require("@etron/data-sources-shared/utils/schema");
const { castDataToSchema } = require("@etron/data-sources-shared/utils/castDataToSchema");
const { validateWorkspaceId } = require("@etron/shared/utils/validation");
const { detectDateFormat } = require("@etron/data-sources-shared/utils/dateParser");

const { PERMISSIONS, requirePermission } = require("./helpers");

// Preview the auto-detected schema for uploaded CSV data.
// Returns the schema with categories (date/value/dimension) and a sample of data.
// The user can review and adjust field categories before confirming.
async function previewSchema(authUserId, payload) {
    const { workspaceId, rawData } = payload;
    await validateWorkspaceId(workspaceId);
    await requirePermission(authUserId, workspaceId, PERMISSIONS.MANAGE_DATASOURCES);

    if (!rawData) {
        throw new Error("No data provided for preview");
    }

    const translatedData = translateData(rawData);
    if (translatedData.length === 0) {
        throw new Error("The provided data is empty");
    }

    const { valid, error } = validateFormat(translatedData);
    if (!valid) throw new Error(`Invalid data format: ${error}`);

    const schema = generateSchema(translatedData.slice(0, 100));

    // suggest numeric sub-types for any dimensions that look numeric
    for (const column of schema) {
        if (column.category === "dimension") {
            const values = translatedData.slice(0, 100).map(row => row[column.name]);
            const numericType = detectNumericType(values, column.name);
            if (numericType) {
                column.suggestedValueType = numericType;
            }
        }
    }

    return {
        schema,
        sampleData: translatedData.slice(0, 10),
        totalRows: translatedData.length,
    };
}

// Resolve a single column's final schema entry given the user-confirmed category.
// Pure function — takes the auto-detected column, the user's override, and a sample of
// the translated data (used for on-demand date-format / numeric-type detection).
function resolveColumnForCategory(col, userCol, translatedData) {
    if (!userCol) return col;
    const toCat = userCol.category || col.category;

    // --- DATE ---
    if (toCat === "date") {
        if (userCol.userDateFormat) {
            return { name: col.name, type: "timestamp", category: "date", userDateFormat: userCol.userDateFormat };
        }
        if (col.type === "timestamp" && col.dateFormat) {
            return col;
        }
        const dateValues = translatedData.slice(0, 100).map(row => row[col.name]);
        const dateFormat = detectDateFormat(dateValues);
        if (dateFormat) {
            return { name: col.name, type: "timestamp", category: "date", dateFormat };
        }
        // Try native JS Date parsing as fallback
        const testValues = dateValues.filter(v => v != null && String(v).trim() !== "").slice(0, 10);
        const canParse = testValues.length > 0 && testValues.every(v => !isNaN(new Date(v).getTime()));
        if (canParse) {
            return { name: col.name, type: "timestamp", category: "date" };
        }
        // cannot convert — keep original type but mark category
        return { ...col, category: "date" };
    }

    // --- VALUE ---
    if (toCat === "value") {
        if (col.category === "value") {
            if (userCol.type && userCol.type !== col.type) {
                return { name: col.name, type: userCol.type, category: "value" };
            }
            return col;
        }
        const numValues = translatedData.slice(0, 100).map(row => row[col.name]);
        const detectedType = detectNumericType(numValues, col.name);
        const newType = userCol.type || detectedType || "double";
        return { name: col.name, type: newType, category: "value" };
    }

    // --- DIMENSION ---
    if (toCat === "dimension") {
        if (col.category === "dimension") return col;
        return { name: col.name, type: "string", category: "dimension" };
    }

    return col;
}

// Confirm and process the schema after the user has reviewed/adjusted field categories.
// Takes the user's confirmed schema (with category overrides) and processes the upload.
async function confirmSchemaAndProcess(authUserId, dataSourceId, payload) {
    const { workspaceId, confirmedSchema, rawData } = payload;
    await validateWorkspaceId(workspaceId);
    await requirePermission(authUserId, workspaceId, PERMISSIONS.MANAGE_DATASOURCES);

    const dataSource = await dataSourceRepo.getDataSourceById(workspaceId, dataSourceId);
    if (!dataSource) {
        throw new Error(`Data source not found: ${dataSourceId}`);
    }

    if (!confirmedSchema || !Array.isArray(confirmedSchema) || confirmedSchema.length === 0) {
        throw new Error("Confirmed schema is required");
    }

    if (!rawData) {
        throw new Error("No data provided");
    }

    try {
        await dataSourceRepo.updateDataSourceStatus(workspaceId, dataSourceId, {
            status: "processing",
            errorMessage: null,
            progressStage: "Translating data",
            progressPercent: 15,
        });
        const translatedData = translateData(rawData);

        if (translatedData.length === 0) {
            await dataSourceRepo.updateDataSourceStatus(workspaceId, dataSourceId, {
                status: "no_data",
                errorMessage: "No data existent",
            });
            return { success: false };
        }

        await dataSourceRepo.updateDataSourceProgress(workspaceId, dataSourceId, { stage: "Validating format", percent: 30 });
        const { valid, error } = validateFormat(translatedData);
        if (!valid) throw new Error(`Invalid data format: ${error}`);

        await dataSourceRepo.updateDataSourceProgress(workspaceId, dataSourceId, { stage: "Generating schema", percent: 45 });
        const autoSchema = generateSchema(translatedData.slice(0, 100));

        // build final schema from user-confirmed categories
        const finalSchema = autoSchema.map(col => {
            const userCol = confirmedSchema.find(c => c.name === col.name);
            return resolveColumnForCategory(col, userCol, translatedData);
        });

        await dataSourceRepo.updateDataSourceProgress(workspaceId, dataSourceId, { stage: "Casting rows", percent: 60 });
        const castedData = castDataToSchema(translatedData, finalSchema);

        await dataSourceRepo.updateDataSourceProgress(workspaceId, dataSourceId, { stage: "Writing parquet", percent: 75 });
        const parquetBuffer = await toParquet(castedData, finalSchema);

        await dataSourceRepo.updateDataSourceProgress(workspaceId, dataSourceId, { stage: "Saving data", percent: 85 });
        if (dataSource.method === "extend") {
            await appendToStoredData(workspaceId, dataSourceId, castedData, finalSchema);
        } else {
            await replaceStoredData(workspaceId, dataSourceId, parquetBuffer);
        }

        await dataSourceRepo.updateDataSourceProgress(workspaceId, dataSourceId, { stage: "Finalising", percent: 95 });
        await saveSchemaAndUpdateTable(workspaceId, dataSourceId, finalSchema);

        await dataSourceRepo.updateDataSourceStatus(workspaceId, dataSourceId, {
            status: "active",
            errorMessage: null,
        });

        return { success: true, schema: finalSchema };
    } catch (error) {
        await dataSourceRepo.updateDataSourceStatus(workspaceId, dataSourceId, {
            status: "error",
            errorMessage: error.message,
        });
        throw error;
    }
}

module.exports = {
    previewSchema,
    confirmSchemaAndProcess,
    resolveColumnForCategory,
};
