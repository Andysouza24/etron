// Canonical transformation of raw data-source rows into the shape GraphTypes render expects.
// Mirrors the pipelines in create-metric/simple.jsx and create-metric/dimensional.jsx so the
// view-metric, edit-metric, and board metric renders produce identical graphs.

import { aggregateData } from "./aggregation";
import { parseNumericOrOriginal } from "./numberParser";

function coerceRows(rows) {
    return rows.map((row) => {
        const newRow = {};
        for (const [key, value] of Object.entries(row)) {
            newRow[key] = parseNumericOrOriginal(value);
        }
        return newRow;
    });
}

function filterSelectedRows(rows, selectedRows, schema) {
    if (!Array.isArray(selectedRows) || selectedRows.length === 0) return rows;
    const idKey = Array.isArray(schema) && schema.length > 0
        ? (typeof schema[0] === "string" ? schema[0] : schema[0]?.name)
        : null;
    if (!idKey) return rows;
    return rows.filter((row) => selectedRows.includes(row[idKey]));
}

// Dimensional: group rows by the independent variable (date), summing the value field
// into a column named after each unique dimension value (e.g. "Electronics", "Furniture").
function buildDimensionalGraphData(rows, config) {
    const { independentVariable, dependentVariables, dimensionField } = config;
    const valueField = Array.isArray(dependentVariables) ? dependentVariables[0] : null;
    if (!independentVariable || !valueField || !dimensionField) {
        return { data: [], yKeys: [] };
    }

    const dimensionValues = [...new Set(rows.map((r) => r[dimensionField]))]
        .filter((v) => v != null)
        .map(String);

    const grouped = {};
    for (const row of rows) {
        const xVal = row[independentVariable];
        const dimVal = row[dimensionField];
        const numVal = parseNumericOrOriginal(row[valueField]);
        if (xVal == null) continue;
        if (!grouped[xVal]) grouped[xVal] = { [independentVariable]: xVal };
        if (dimVal != null && typeof numVal === "number" && !Number.isNaN(numVal)) {
            const key = String(dimVal);
            grouped[xVal][key] = (grouped[xVal][key] ?? 0) + numVal;
        }
    }

    return { data: Object.values(grouped), yKeys: dimensionValues };
}

// Produce { data, yKeys } for a saved metric config and raw rows.
// `schema` is optional; when provided, selectedRows filtering matches the creation flow
// (filter by the first schema field's id column). Without schema, selectedRows is ignored.
export function buildMetricGraphData(rows, config, schema = null) {
    if (!config || !Array.isArray(rows)) {
        return { data: [], yKeys: [] };
    }

    const filteredRows = filterSelectedRows(rows, config.selectedRows, schema);
    const coerced = coerceRows(filteredRows);

    if (config.dimensionField) {
        return buildDimensionalGraphData(coerced, config);
    }

    const dependentVariables = Array.isArray(config.dependentVariables) ? config.dependentVariables : [];

    if (config.aggregation && config.independentVariable && dependentVariables.length > 0) {
        const aggregated = aggregateData(
            coerced,
            config.independentVariable,
            dependentVariables,
            config.aggregation
        );
        return { data: aggregated, yKeys: dependentVariables };
    }

    return { data: coerced, yKeys: dependentVariables };
}
