// Author(s): Rhys Cleary, Holly Wyatt
// Data reads (Athena) and partitioned data updates.

const { v4: uuidv4 } = require("uuid");
const metricRepo = require("@etron/day-book-shared/repositories/metricRepository");
const { getDataSchema, savePartitionedData, loadPartitionedData } = require("@etron/data-sources-shared/repositories/dataBucketRepository");
const { runQuery } = require("@etron/data-sources-shared/utils/athenaService");
const { castDataToSchema } = require("@etron/data-sources-shared/utils/castDataToSchema");
const { generateSchema } = require("@etron/data-sources-shared/utils/schema");
const { toParquet } = require("@etron/data-sources-shared/utils/typeConversion");
const { validateWorkspaceId } = require("@etron/shared/utils/validation");

const { PERMISSIONS, requirePermission, sanitiseIdentifier } = require("./helpers");

// Shared query path for `viewData` and `viewDataForMetric`.
// `columnFilter` (optional) narrows the schema to a subset of column names.
async function queryDataSource(workspaceId, dataSourceId, { columnFilter, options = {} } = {}) {
    const schema = await getDataSchema(workspaceId, dataSourceId);
    if (!schema || schema.length === 0) {
        throw new Error("Data is still being processed. Please wait a moment and try again.");
    }

    const scopedSchema = columnFilter
        ? schema.filter(col => columnFilter.includes(col.name))
        : schema;

    const columns = scopedSchema.map(col => sanitiseIdentifier(col.name)).join(", ");
    const tableName = sanitiseIdentifier(`ds_${dataSourceId}`);
    const database = process.env.ATHENA_DATABASE;
    const outputLocation = `s3://${process.env.WORKSPACE_BUCKET}/workspaces/${workspaceId}/day-book/athenaResults/`;

    const query = `SELECT ${columns} FROM ${tableName}`;

    const { data, nextToken, queryExecutionId } = await runQuery(
        query,
        database,
        outputLocation,
        options
    );

    const finalSchema = scopedSchema.filter(col => col.name !== "rowId");
    const castedData = castDataToSchema(data, finalSchema);

    return {
        data: castedData,
        schema: finalSchema,
        tableName,
        nextToken,
        queryExecutionId,
    };
}

async function viewData(authUserId, workspaceId, dataSourceId, options = {}) {
    await requirePermission(authUserId, workspaceId, PERMISSIONS.VIEW_DATA);
    return queryDataSource(workspaceId, dataSourceId, { options });
}

async function viewDataForMetric(authUserId, workspaceId, dataSourceId, metricId, options = {}) {
    await requirePermission(authUserId, workspaceId, PERMISSIONS.VIEW_DATA);
    const metricColumns = await metricRepo.getMetricVariableNames(workspaceId, metricId);
    return queryDataSource(workspaceId, dataSourceId, { columnFilter: metricColumns, options });
}

// Update the data in the parquet files (by parition (timestamp)).
async function updatePartitionedData(authUserId, dataSourceId, payload) {
    const { workspaceId, updates, partitionField } = payload;

    await validateWorkspaceId(workspaceId);
    await requirePermission(authUserId, workspaceId, PERMISSIONS.MANAGE_DATASOURCES);

    if (!updates || updates.length == 0) {
        throw new Error("No updates provided");
    }

    // group by partition
    const partitionsMap = {};

    for (const update of updates) {
        const timestamp = update[partitionField];
        if (!timestamp) throw new Error(`Each update row must have a timestamp`);

        const partitionValue = new Date(timestamp).toISOString().split("T")[0];
        if (!partitionsMap[partitionValue]) partitionsMap[partitionValue] = [];
        partitionsMap[partitionValue].push(update);
    }

    // process each partition
    for (const partitionValue of Object.keys(partitionsMap)) {
        const partitionUpdates = partitionsMap[partitionValue];

        const existingData = await loadPartitionedData(workspaceId, dataSourceId, partitionValue);

        // merge by rowId (updates replace existing rows with the same id)
        const mergedMap = new Map();
        existingData.forEach(row => {
            if (row.rowId) mergedMap.set(row.rowId.trim().toLowerCase(), row);
        });
        partitionUpdates.forEach(update => {
            if (!update.rowId) update.rowId = uuidv4();
            mergedMap.set(update.rowId.trim().toLowerCase(), update);
        });
        const mergedData = Array.from(mergedMap.values());

        // final dedupe (defensive — rowIds should already be unique after the merge above)
        const uniqueMap = new Map();
        for (const row of mergedData) {
            uniqueMap.set(row.rowId.trim().toLowerCase(), row);
        }
        const dedupedData = Array.from(uniqueMap.values());

        const schema = generateSchema(dedupedData);
        const castedData = castDataToSchema(dedupedData, schema);
        const parquetBuffer = await toParquet(castedData, schema);

        await savePartitionedData(workspaceId, dataSourceId, parquetBuffer, partitionValue);
    }

    return { message: "Data sources data successfully updated" };
}

module.exports = {
    viewData,
    viewDataForMetric,
    updatePartitionedData,
};
