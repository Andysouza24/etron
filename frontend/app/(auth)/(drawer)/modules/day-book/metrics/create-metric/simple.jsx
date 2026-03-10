import React, { useState, useCallback, useMemo, useEffect } from "react";
import useMetricForm from "../../../../../../../hooks/modules/day_book/metrics/useMetricForm";
import useMetricDataSource from "../../../../../../../hooks/modules/day_book/metrics/useMetricDataSource";
import useMetricSubmission from "../../../../../../../hooks/modules/day_book/metrics/useMetricSubmission";
import { useHasPermission } from "../../../../../../../hooks/useHasPermission";
import { aggregateData, hasDuplicateValues } from "../../../../../../../utils/aggregation";
import MetricWizard from "../../../../../../../components/modules/day-book/metrics/MetricWizard";
import SimpleConfig from "../../../../../../../components/modules/day-book/metrics/pages/SimpleConfig";
import MetricDetails from "../../../../../../../components/modules/day-book/metrics/pages/MetricDetails";

function parseNumericValue(value) {
    if (value == null || value === "") return value;
    if (typeof value === "number") return value;
    const cleaned = String(value).replace(/[$,\s]/g, "");
    const num = Number(cleaned);
    return !isNaN(num) && cleaned !== "" ? num : value;
}

function convertToGraphData(rows) {
    return rows.map((row) => {
        const newRow = {};
        for (const [key, value] of Object.entries(row)) {
            newRow[key] = parseNumericValue(value);
        }
        return newRow;
    });
}

const CreateSimpleMetric = () => {
    const { allowed: viewDataPermission } = useHasPermission("modules.daybook.datasources.view_data");
    const ds = useMetricDataSource();
    const form = useMetricForm();
    const { submitMetric, viewShotRef } = useMetricSubmission();

    const [selectedMetric, setSelectedMetric] = useState(null);
    const [selectedRows, setSelectedRows] = useState([]);
    const [valueSelection, setValueSelection] = useState(null);
    const [dateSelection, setDateSelection] = useState(null);
    const [aggregationSelection, setAggregationSelection] = useState("sum");
    const [aggChecked, setAggChecked] = useState(false);

    const hasDuplicateDates = useMemo(
        () => hasDuplicateValues(ds.dataSourceData, dateSelection),
        [dateSelection, ds.dataSourceData]
    );

    useEffect(() => {
        setAggChecked(hasDuplicateDates);
    }, [hasDuplicateDates]);

    const graphData = useMemo(() => {
        const rows =
            selectedRows.length > 0
                ? ds.dataSourceData.filter((row) => selectedRows.includes(row[ds.dataSourceVariableNames[0]]))
                : ds.dataSourceData;
        const converted = convertToGraphData(rows);
        if ((aggChecked || hasDuplicateDates) && dateSelection && valueSelection && aggregationSelection) {
            return aggregateData(converted, dateSelection, [valueSelection], aggregationSelection);
        }
        return converted;
    }, [ds.dataSourceData, ds.dataSourceVariableNames, selectedRows, aggChecked, hasDuplicateDates, dateSelection, valueSelection, aggregationSelection]);

    const handleSubmit = useCallback(async () => {
        await submitMetric({
            metricName: form.metricName,
            metricType: form.metricType,
            dataSourceId: ds.dataSourceId,
            config: {
                type: selectedMetric,
                metricType: form.metricType,
                independentVariable: dateSelection,
                dependentVariables: valueSelection ? [valueSelection] : [],
                aggregation: aggChecked ? aggregationSelection : null,
                colours: form.coloursState,
                selectedRows,
            },
        });
    }, [form, ds.dataSourceId, dateSelection, valueSelection, selectedRows, selectedMetric, aggChecked, aggregationSelection, submitMetric]);

    const pages = useMemo(() => [
        {
            component: (
                <SimpleConfig
                    ds={ds}
                    viewDataPermission={viewDataPermission}
                    selectedMetric={selectedMetric}
                    setSelectedMetric={setSelectedMetric}
                    valueSelection={valueSelection}
                    setValueSelection={setValueSelection}
                    dateSelection={dateSelection}
                    setDateSelection={setDateSelection}
                    aggregationSelection={aggregationSelection}
                    setAggregationSelection={setAggregationSelection}
                    aggChecked={aggChecked}
                    setAggChecked={setAggChecked}
                />
            ),
            validate: () => !!valueSelection && !!dateSelection,
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
                    dependentVariables={valueSelection ? [valueSelection] : []}
                    viewShotRef={viewShotRef}
                    graphType={selectedMetric}
                    graphData={graphData}
                    xKey={dateSelection}
                    yKeys={valueSelection ? [valueSelection] : []}
                />
            ),
            validate: () => !!form.metricName.trim(),
        },
    ], [ds, viewDataPermission, selectedMetric, valueSelection, dateSelection, aggregationSelection, aggChecked, form, viewShotRef, graphData]);

    return (
        <MetricWizard
            title="New Metric"
            pages={pages}
            onSubmit={handleSubmit}
        />
    );
};

export default CreateSimpleMetric;

