// Author(s): Rhys Cleary, Holly Wyatt
// Data reads (Athena) and partitioned data updates.

const { v4: uuidv4 } = require("uuid");
const metricRepo = require("@etron/day-book-shared/repositories/metricRepository");
const dataSourceRepo = require("@etron/day-book-shared/repositories/dataSourceRepository");
const { getDataSchema, savePartitionedData, loadPartitionedData } = require("@etron/data-sources-shared/repositories/dataBucketRepository");
const { runQuery } = require("@etron/data-sources-shared/utils/athenaService");
const { castDataToSchema } = require("@etron/data-sources-shared/utils/castDataToSchema");
const { generateSchema } = require("@etron/data-sources-shared/utils/schema");
const { toParquet } = require("@etron/data-sources-shared/utils/typeConversion");
const { validateWorkspaceId } = require("@etron/shared/utils/validation");

const { PERMISSIONS, requirePermission, requireAnyPermission, requireEnabled, sanitiseIdentifier } = require("./helpers");

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

    const columns = scopedSchema.map(col => `"${sanitiseIdentifier(col.name)}"`).join(", ");
    const tableName = sanitiseIdentifier(`ds_${dataSourceId}`);
    const database = process.env.ATHENA_DATABASE;
    const outputLocation = `s3://${process.env.WORKSPACE_BUCKET}/workspaces/${workspaceId}/day-book/athenaResults/`;

    const query = `SELECT ${columns} FROM "${tableName}"`;

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
    const dataSource = await dataSourceRepo.getDataSourceById(workspaceId, dataSourceId);
    requireEnabled(dataSource);
    return queryDataSource(workspaceId, dataSourceId, { options });
}

// ---------------------------------------------------------------------------
// Metric query path
//
// The metric path is intentionally separate from `viewData` because metric
// rendering benefits enormously from pushing aggregation, dimensional pivots,
// and year/range filtering into Athena instead of the device. The shape of
// the response below is also the shape that a future precomputed metric
// snapshot (Option 4) would store in S3, so the frontend can be ported to a
// snapshot source without changes.
// ---------------------------------------------------------------------------

function mapAggregation(agg) {
    switch (agg) {
        case "sum": return "SUM";
        case "avg": return "AVG";
        case "min": return "MIN";
        case "max": return "MAX";
        case "count": return "COUNT";
        default: return "SUM";
    }
}

function escapeSqlString(value) {
    return String(value).replace(/'/g, "''");
}

function buildMetricFilters({ schema, config, params }) {
    const independentName = config.independentVariable;
    const independentSchema = schema.find(c => c.name === independentName);
    const isTimestamp = independentSchema?.type === "timestamp";
    const independentCol = independentName ? sanitiseIdentifier(independentName) : null;

    const where = [];

    if (isTimestamp && independentCol) {
        // Year filter (current UI). Future: replace with a generic range filter.
        if (params.year != null && params.year !== "all") {
            const y = parseInt(params.year, 10);
            if (!Number.isNaN(y)) {
                where.push(`year("${independentCol}") = ${y}`);
            }
        }
        // Forward-compatible date-range filter (not yet wired into UI).
        if (params.from && params.to) {
            const from = escapeSqlString(params.from);
            const to = escapeSqlString(params.to);
            where.push(`"${independentCol}" BETWEEN TIMESTAMP '${from}' AND TIMESTAMP '${to}'`);
        }
    }

    // Selected rows filter (the first schema column is the rowId column).
    const selectedRows = Array.isArray(config.selectedRows) ? config.selectedRows : [];
    if (selectedRows.length > 0 && schema.length > 0) {
        const idColName = typeof schema[0] === "string" ? schema[0] : schema[0].name;
        if (idColName) {
            const idCol = sanitiseIdentifier(idColName);
            const escaped = selectedRows.map(r => `'${escapeSqlString(r)}'`).join(", ");
            where.push(`"${idCol}" IN (${escaped})`);
        }
    }

    return { whereSql: where.length > 0 ? `WHERE ${where.join(" AND ")}` : "", isTimestamp, independentCol };
}

// Builds a Presto/Athena expression that buckets a timestamp column to the
// start of the requested aggregation period. Weeks are Sunday-anchored
// (Sun→Sat) to match the user-facing aggregation view convention.
function buildBucketExpr(colIdent, aggregatePeriod) {
    switch (aggregatePeriod) {
        case "week":
            // day_of_week returns 1 (Mon) … 7 (Sun). Modulo 7 gives Sun=0,
            // Mon=1 … Sat=6 — i.e. days since the most recent Sunday.
            return `date_add('day', -CAST((day_of_week("${colIdent}") % 7) AS BIGINT), date_trunc('day', "${colIdent}"))`;
        case "month":
            return `date_trunc('month', "${colIdent}")`;
        case "year":
            return `date_trunc('year', "${colIdent}")`;
        default:
            return null;
    }
}

function buildMetricSql({ tableName, schema, config, params }) {
    const { aggregation, independentVariable, dependentVariables = [], dimensionField } = config;
    const tableIdent = sanitiseIdentifier(tableName);
    const independentCol = sanitiseIdentifier(independentVariable);
    const dependentCols = dependentVariables.map(d => sanitiseIdentifier(d));

    const { whereSql, isTimestamp } = buildMetricFilters({ schema, config, params });

    // Aggregation view: bucket the timestamp into week/month/year groups
    // and roll up dependent values using the metric's saved aggregation
    // method (defaulting to SUM). Only valid for timestamp independents and
    // non-dimensional metrics.
    const bucketPeriod = params.aggregatePeriod;
    const canBucket = isTimestamp && !dimensionField && dependentCols.length > 0;
    const isBucketed = !!bucketPeriod && canBucket;
    // When the caller hasn't pinned a specific period, return all four
    // (daily/weekly/monthly/yearly) in a single query via GROUPING SETS so
    // the frontend can toggle the aggregation view without another round
    // trip. Daily is the raw-per-timestamp grouping (matches the existing
    // "daily" baseline view); the others use the bucket expressions above.
    const allBuckets = canBucket && !bucketPeriod;

    if (dimensionField) {
        const dimensionCol = sanitiseIdentifier(dimensionField);
        const valueCol = dependentCols[0];
        if (!valueCol) throw new Error("Dimensional metric requires a value field");
        const sql = `SELECT "${independentCol}" AS "${independentCol}", "${dimensionCol}" AS dim, SUM("${valueCol}") AS y `
            + `FROM "${tableIdent}" ${whereSql} `
            + `GROUP BY "${independentCol}", "${dimensionCol}" `
            + `ORDER BY "${independentCol}"`;
        return { sql, mode: "dimensional" };
    }

    if (allBuckets) {
        const aggFn = mapAggregation(aggregation);
        const weekExpr = `date_add('day', -CAST((day_of_week("${independentCol}") % 7) AS BIGINT), date_trunc('day', "${independentCol}"))`;
        const aggCols = dependentCols.map(col => `${aggFn}("${col}") AS "${col}"`).join(", ");
        const passthroughCols = dependentCols.map(c => `"${c}"`).join(", ");
        const sql = `WITH bucketed AS ( `
            + `SELECT "${independentCol}" AS d_raw, `
            + `${weekExpr} AS d_week, `
            + `date_trunc('month', "${independentCol}") AS d_month, `
            + `date_trunc('year', "${independentCol}") AS d_year, `
            + `${passthroughCols} `
            + `FROM "${tableIdent}" ${whereSql} `
            + `) SELECT CASE `
            + `WHEN GROUPING(d_raw) = 0 THEN 'daily' `
            + `WHEN GROUPING(d_week) = 0 THEN 'weekly' `
            + `WHEN GROUPING(d_month) = 0 THEN 'monthly' `
            + `WHEN GROUPING(d_year) = 0 THEN 'yearly' `
            + `END AS __period, `
            + `COALESCE(d_raw, d_week, d_month, d_year) AS "${independentCol}", `
            + `${aggCols} `
            + `FROM bucketed `
            + `GROUP BY GROUPING SETS ((d_raw), (d_week), (d_month), (d_year)) `
            + `ORDER BY __period, "${independentCol}"`;
        return { sql, mode: "all-buckets" };
    }

    if (isBucketed) {
        const aggFn = mapAggregation(aggregation);
        const bucketExpr = buildBucketExpr(independentCol, bucketPeriod);
        const aggCols = dependentCols.map(col => `${aggFn}("${col}") AS "${col}"`).join(", ");
        const sql = `SELECT ${bucketExpr} AS "${independentCol}", ${aggCols} `
            + `FROM "${tableIdent}" ${whereSql} `
            + `GROUP BY ${bucketExpr} `
            + `ORDER BY ${bucketExpr}`;
        return { sql, mode: "aggregated" };
    }

    if (aggregation && dependentCols.length > 0) {
        const aggFn = mapAggregation(aggregation);
        const aggCols = dependentCols.map(col => `${aggFn}("${col}") AS "${col}"`).join(", ");
        const sql = `SELECT "${independentCol}" AS "${independentCol}", ${aggCols} `
            + `FROM "${tableIdent}" ${whereSql} `
            + `GROUP BY "${independentCol}" `
            + `ORDER BY "${independentCol}"`;
        return { sql, mode: "aggregated" };
    }

    // Raw mode (no aggregation, no dimension). Used by scatter and box-raw.
    const allCols = [independentCol, ...dependentCols];
    const colsSql = allCols.map(c => `"${c}"`).join(", ");
    const sql = `SELECT ${colsSql} FROM "${tableIdent}" ${whereSql} ORDER BY "${independentCol}"`;
    return { sql, mode: "raw" };
}

async function getAvailableYears(workspaceId, dataSourceId, independentName) {
    const tableIdent = sanitiseIdentifier(`ds_${dataSourceId}`);
    const independentCol = sanitiseIdentifier(independentName);
    const sql = `SELECT DISTINCT year("${independentCol}") AS y FROM "${tableIdent}" `
        + `WHERE "${independentCol}" IS NOT NULL ORDER BY y`;
    const database = process.env.ATHENA_DATABASE;
    const outputLocation = `s3://${process.env.WORKSPACE_BUCKET}/workspaces/${workspaceId}/day-book/athenaResults/`;
    const { data } = await runQuery(sql, database, outputLocation, { pageSize: 1000, maxPages: 10 });
    return data
        .map(r => Number(r.y))
        .filter(n => Number.isFinite(n))
        .sort((a, b) => a - b);
}

function pivotDimensionalRows(rows, independentName) {
    const pivot = new Map();
    const dimensions = new Set();
    for (const row of rows) {
        const xVal = row[independentName];
        const dimVal = row.dim;
        const yVal = row.y;
        if (xVal == null) continue;
        if (!pivot.has(xVal)) pivot.set(xVal, { [independentName]: xVal });
        if (dimVal != null && yVal != null) {
            const key = String(dimVal);
            pivot.get(xVal)[key] = yVal;
            dimensions.add(key);
        }
    }
    return {
        data: Array.from(pivot.values()),
        yKeys: Array.from(dimensions).sort(),
    };
}

async function viewDataForMetric(authUserId, workspaceId, dataSourceId, metricId, options = {}) {
    // Either data-source viewers or metric viewers may read metric output.
    // Metric viewers don't have raw data-source access, but reading a saved
    // metric only exposes the aggregated chart-ready response, not arbitrary
    // column queries.
    await requireAnyPermission(authUserId, workspaceId, [PERMISSIONS.VIEW_DATA, PERMISSIONS.VIEW_METRICS]);
    const dataSource = await dataSourceRepo.getDataSourceById(workspaceId, dataSourceId);
    requireEnabled(dataSource);

    const metric = await metricRepo.getMetricById(workspaceId, metricId);
    if (!metric || !metric.config) {
        throw new Error("Metric not found");
    }

    return runMetricQuery(workspaceId, dataSourceId, metric.config, options);
}

// Build the same chart-ready response that `viewDataForMetric` produces, but
// from an unsaved `config` (used by the metric creation wizard preview).
async function previewMetricData(authUserId, workspaceId, dataSourceId, config, options = {}) {
    await requirePermission(authUserId, workspaceId, PERMISSIONS.VIEW_DATA);
    const dataSource = await dataSourceRepo.getDataSourceById(workspaceId, dataSourceId);
    requireEnabled(dataSource);

    if (!config || !config.independentVariable) {
        throw new Error("Invalid metric config");
    }

    return runMetricQuery(workspaceId, dataSourceId, config, options);
}

async function runMetricQuery(workspaceId, dataSourceId, config, options = {}) {
    const schema = await getDataSchema(workspaceId, dataSourceId);
    if (!schema || schema.length === 0) {
        throw new Error("Data is still being processed. Please wait a moment and try again.");
    }

    const params = options.params || {};
    const independentSchema = schema.find(c => c.name === config.independentVariable);
    const isTimestamp = independentSchema?.type === "timestamp";

    // Discover available years (cheap distinct query) for timestamp axes.
    // Skip on paginated follow-up calls — the year list was already returned
    // with the first page, so re-querying Athena on every page is wasted work.
    let availableYears = null;
    const isPaginatedFollowUp = !!(options.nextToken || options.queryExecutionId);
    if (isTimestamp && config.independentVariable && !isPaginatedFollowUp) {
        try {
            availableYears = await getAvailableYears(workspaceId, dataSourceId, config.independentVariable);
        } catch (err) {
            console.warn("[runMetricQuery] availableYears probe failed:", err?.message);
        }
    }

    // Default year selection: most recent year for fast first paint.
    // Caller can opt out with `?year=all` to fetch the entire range.
    let appliedYear = null;
    if (params.year != null && params.year !== "" && params.year !== "all") {
        const y = parseInt(params.year, 10);
        if (!Number.isNaN(y)) appliedYear = y;
    } else if (params.year !== "all" && Array.isArray(availableYears) && availableYears.length > 0) {
        appliedYear = availableYears[availableYears.length - 1];
    }

    const queryParams = { ...params, year: appliedYear };

    const { sql, mode } = buildMetricSql({
        tableName: `ds_${dataSourceId}`,
        schema,
        config,
        params: queryParams,
    });

    const database = process.env.ATHENA_DATABASE;
    const outputLocation = `s3://${process.env.WORKSPACE_BUCKET}/workspaces/${workspaceId}/day-book/athenaResults/`;

    const queryOptions = {
        pageSize: options.pageSize || 1000,
        maxPages: options.maxPages || 100,
        nextToken: options.nextToken,
        queryExecutionId: options.queryExecutionId,
    };

    const { data: rawData, nextToken, queryExecutionId } = await runQuery(sql, database, outputLocation, queryOptions);

    // Narrow the returned schema to just the columns this metric actually
    // references (independent + dependents + dimension). This is the only
    // shape information the chart needs, and it prevents callers without
    // raw data-source access (e.g. metric-view-only users) from receiving
    // column metadata for fields outside the metric's display.
    const referencedColumns = new Set([
        config.independentVariable,
        ...(Array.isArray(config.dependentVariables) ? config.dependentVariables : []),
        ...(config.dimensionField ? [config.dimensionField] : []),
    ].filter(Boolean));
    const finalSchema = schema.filter(c => c.name !== "rowId" && referencedColumns.has(c.name));
    let castedData;
    let periods = null;
    let yKeys = Array.isArray(config.dependentVariables) ? config.dependentVariables : [];

    if (mode === "dimensional") {
        // The dimensional SQL projects synthetic `dim` and `y` columns
        // alongside the independent variable. Those aren't in the data
        // source schema, so cast them explicitly before pivoting (otherwise
        // `castDataToSchema` would drop them and the pivot would produce
        // empty series).
        const independentSchema = finalSchema.find(c => c.name === config.independentVariable);
        const dimensionalSchema = [
            ...(independentSchema ? [independentSchema] : []),
            { name: "dim", type: "string" },
            { name: "y", type: "double" },
        ];
        const dimensionalRows = castDataToSchema(rawData, dimensionalSchema);
        const pivoted = pivotDimensionalRows(dimensionalRows, config.independentVariable);
        castedData = pivoted.data;
        yKeys = pivoted.yKeys;
    } else if (mode === "all-buckets") {
        // One query returned daily/weekly/monthly/yearly rows tagged with
        // `__period`. Split them, drop the tag, and cast each subset with
        // the source schema. `data` mirrors the daily slice for backward
        // compatibility with consumers that don't yet read `periods`.
        const buckets = { daily: [], weekly: [], monthly: [], yearly: [] };
        for (const row of rawData) {
            const period = row?.__period;
            if (period && buckets[period]) {
                const { __period, ...rest } = row;
                buckets[period].push(rest);
            }
        }
        periods = {
            daily: castDataToSchema(buckets.daily, finalSchema),
            weekly: castDataToSchema(buckets.weekly, finalSchema),
            monthly: castDataToSchema(buckets.monthly, finalSchema),
            yearly: castDataToSchema(buckets.yearly, finalSchema),
        };
        castedData = periods.daily;
    } else {
        castedData = castDataToSchema(rawData, finalSchema);
    }

    return {
        data: castedData,
        periods,
        yKeys,
        schema: finalSchema,
        availableYears,
        appliedFilter: { year: appliedYear },
        mode,
        // Tells the frontend the data is already chart-ready and the legacy
        // client-side aggregation pipeline can be skipped.
        preShaped: true,
        nextToken,
        queryExecutionId,
    };
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
    previewMetricData,
    updatePartitionedData,
};
