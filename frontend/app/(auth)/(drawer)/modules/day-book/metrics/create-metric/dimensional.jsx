import React, { useState, useCallback, useMemo } from "react";
import useMetricForm from "../../../../../../../hooks/modules/day_book/metrics/useMetricForm";
import useMetricDataSource from "../../../../../../../hooks/modules/day_book/metrics/useMetricDataSource";
import useMetricSubmission from "../../../../../../../hooks/modules/day_book/metrics/useMetricSubmission";
import { useHasPermission } from "../../../../../../../hooks/useHasPermission";
import MetricWizard from "../../../../../../../components/modules/day-book/metrics/MetricWizard";
import DimensionalConfig from "../../../../../../../components/modules/day-book/metrics/pages/DimensionalConfig";
import MetricDetails from "../../../../../../../components/modules/day-book/metrics/pages/MetricDetails";

function parseNumeric(value) {
    if (typeof value === "number") return value;
    if (typeof value === "string") {
        const stripped = value.replace(/,/g, "");
        const num = Number(stripped);
        if (!isNaN(num) && stripped !== "") return num;
    }
    return value;
}

const Dimensional = () => {
    const { allowed: viewDataPermission } = useHasPermission("modules.daybook.datasources.view_data");
    const ds = useMetricDataSource();
    const form = useMetricForm();
    const { submitMetric, viewShotRef } = useMetricSubmission();

    const [selectedMetric, setSelectedMetric] = useState(null);
    const [selectedRows, setSelectedRows] = useState([]);
    const [dateSelection, setDateSelection] = useState(null);
    const [metricSelection, setMetricSelection] = useState(null);
    const [dimensionSelection, setDimensionSelection] = useState(null);
    const [metricConfig, setMetricConfig] = useState(null);

    const valueField = useMemo(() => {
        if (!metricConfig?.dependentVariables?.length) return null;
        return metricConfig.dependentVariables[0];
    }, [metricConfig]);

    const dimensionValues = useMemo(() => {
        if (!dimensionSelection || !ds.dataSourceData.length) return [];
        const unique = [...new Set(ds.dataSourceData.map((row) => row[dimensionSelection]))];
        return unique.filter((v) => v != null).map(String);
    }, [dimensionSelection, ds.dataSourceData]);

    const graphData = useMemo(() => {
        if (!dateSelection || !valueField || !dimensionSelection) return [];

        const rows =
            selectedRows.length > 0
                ? ds.dataSourceData.filter((row) => selectedRows.includes(row[ds.dataSourceVariableNames[0]]))
                : ds.dataSourceData;

        const grouped = {};
        for (const row of rows) {
            const dateVal = row[dateSelection];
            const dimVal = row[dimensionSelection];
            const numVal = parseNumeric(row[valueField]);

            if (dateVal == null) continue;
            if (!grouped[dateVal]) {
                grouped[dateVal] = { [dateSelection]: dateVal };
            }
            if (dimVal != null && typeof numVal === "number" && !isNaN(numVal)) {
                const key = String(dimVal);
                grouped[dateVal][key] = (grouped[dateVal][key] ?? 0) + numVal;
            }
        }

        return Object.values(grouped);
    }, [ds.dataSourceData, ds.dataSourceVariableNames, selectedRows, dateSelection, valueField, dimensionSelection]);

    const handleSubmit = useCallback(async () => {
        await submitMetric({
            metricName: form.metricName,
            metricType: form.metricType,
            dataSourceId: ds.dataSourceId,
            config: {
                type: selectedMetric,
                metricType: form.metricType,
                independentVariable: dateSelection,
                dependentVariables: valueField ? [valueField] : [],
                dimensionField: dimensionSelection,
                sourceMetricId: metricSelection,
                colours: form.coloursState,
                selectedRows,
            },
        });
    }, [form, ds.dataSourceId, dateSelection, valueField, dimensionSelection, metricSelection, selectedRows, selectedMetric, submitMetric]);

    const pages = useMemo(() => [
        {
            component: (
                <DimensionalConfig
                    ds={ds}
                    viewDataPermission={viewDataPermission}
                    selectedMetric={selectedMetric}
                    setSelectedMetric={setSelectedMetric}
                    dateSelection={dateSelection}
                    setDateSelection={setDateSelection}
                    metricSelection={metricSelection}
                    setMetricSelection={setMetricSelection}
                    dimensionSelection={dimensionSelection}
                    setDimensionSelection={setDimensionSelection}
                    metricConfig={metricConfig}
                    setMetricConfig={setMetricConfig}
                />
            ),
            validate: () => !!metricSelection && !!dimensionSelection && !!dateSelection,
        },
        {
            component: (
                <MetricDetails
                    metricName={form.metricName}
                    setMetricName={form.setMetricName}
                    coloursState={form.coloursState}
                    setColoursState={form.setColoursState}
                    wheelIndex={form.wheelIndex}
                    setWheelIndex={form.setWheelIndex}
                    dependentVariables={dimensionValues}
                    viewShotRef={viewShotRef}
                    graphType={selectedMetric}
                    graphData={graphData}
                    xKey={dateSelection}
                    yKeys={dimensionValues}
                />
            ),
            validate: () => !!form.metricName.trim(),
        },
    ], [ds, viewDataPermission, selectedMetric, dateSelection, metricSelection, dimensionSelection, metricConfig, dimensionValues, form, viewShotRef, graphData]);

    return (
        <MetricWizard
            title="New Dimensional Metric"
            pages={pages}
            onSubmit={handleSubmit}
        />
    );
};

export default Dimensional;