import React, { useState, useCallback, useMemo, useEffect } from "react";
import useMetricForm from "../../../../../../../hooks/modules/day_book/metrics/useMetricForm";
import useMetricDataSource from "../../../../../../../hooks/modules/day_book/metrics/useMetricDataSource";
import useMetricSubmission from "../../../../../../../hooks/modules/day_book/metrics/useMetricSubmission";
import { useHasPermission } from "../../../../../../../hooks/useHasPermission";
import { aggregateData, hasDuplicateValues } from "../../../../../../../utils/aggregation";
import MetricWizard from "../../../../../../../components/modules/day-book/metrics/MetricWizard";
import SimpleConfig from "../../../../../../../components/modules/day-book/metrics/pages/SimpleConfig";
import MetricDetails from "../../../../../../../components/modules/day-book/metrics/pages/MetricDetails";
import { getWorkspaceId } from "../../../../../../../storage/workspaceStorage";
import { getCurrentUser } from "aws-amplify/auth";
import { apiGet } from "../../../../../../../utils/api/apiClient";
import endpoints from "../../../../../../../utils/api/endpoints";

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

    const [selectedMetric, setSelectedMetric] = useState("line");
    const [selectedRows, setSelectedRows] = useState([]);
    const [valueSelection, setValueSelection] = useState(null);
    const [dateSelection, setDateSelection] = useState(null);
    const [aggregationSelection, setAggregationSelection] = useState("sum");
    const [aggChecked, setAggChecked] = useState(false);
    const [maxValue, setMaxValue] = useState(null);
    const [capPercentAt100, setCapPercentAt100] = useState(false);
    const [boxGrouping, setBoxGrouping] = useState("all");
    const [boxTimePeriod, setBoxTimePeriod] = useState("date");
    const [pieLabelPlacement, setPieLabelPlacement] = useState("outside");
    const [rounding, setRounding] = useState({ mode: "none", decimalPlaces: 2 });
    const [percentRounding, setPercentRounding] = useState({ mode: "none", decimalPlaces: 1 });
    const [axisNumberFormat, setAxisNumberFormat] = useState(null);
    const [boxUseRawData, setBoxUseRawData] = useState(false);
    const [numberFormat, setNumberFormat] = useState({
        currencySymbol: "",
        thousandsSeparator: ",",
        decimalSeparator: ".",
        decimalPlaces: null,
    });

    // alerts state
    const [alerts, setAlerts] = useState([]);
    const [workspaceId, setWorkspaceId] = useState(null);
    const [currentUserId, setCurrentUserId] = useState(null);
    const [workspaceUsers, setWorkspaceUsers] = useState([]);

    useEffect(() => {
        (async () => {
            try {
                const wsId = await getWorkspaceId();
                setWorkspaceId(wsId);
                const { userId } = await getCurrentUser();
                setCurrentUserId(userId);
                if (wsId) {
                    const res = await apiGet(endpoints.workspace.users.getUsers(wsId));
                    setWorkspaceUsers(res?.data ?? res ?? []);
                }
            } catch (err) {
                console.error("[CreateSimpleMetric] Error loading workspace data:", err);
            }
        })();
    }, []);

    const hasDuplicateDates = useMemo(
        () => hasDuplicateValues(ds.dataSourceData, dateSelection),
        [dateSelection, ds.dataSourceData]
    );

    useEffect(() => {
        setAggChecked(hasDuplicateDates);
    }, [hasDuplicateDates]);

    const convertedRows = useMemo(() => {
        const rows =
            selectedRows.length > 0
                ? ds.dataSourceData.filter((row) => selectedRows.includes(row[ds.dataSourceVariableNames[0]]))
                : ds.dataSourceData;
        return convertToGraphData(rows);
    }, [ds.dataSourceData, ds.dataSourceVariableNames, selectedRows]);

    const isAggregated = (aggChecked || hasDuplicateDates) && dateSelection && valueSelection && aggregationSelection;

    const graphData = useMemo(() => {
        if (isAggregated) {
            return aggregateData(convertedRows, dateSelection, [valueSelection], aggregationSelection);
        }
        return convertedRows;
    }, [convertedRows, isAggregated, dateSelection, valueSelection, aggregationSelection]);

    const rawGraphData = isAggregated ? convertedRows : null;

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
                maxValue,
                boxGrouping,
                boxTimePeriod,
                pieLabelPlacement,
                rounding,
                numberFormat,
                percentRounding,
                axisNumberFormat,
                boxUseRawData,
                alerts,
            },
        });
    }, [form, ds.dataSourceId, dateSelection, valueSelection, selectedRows, selectedMetric, aggChecked, aggregationSelection, submitMetric, maxValue, boxGrouping, boxTimePeriod, pieLabelPlacement, rounding, numberFormat]);

    const pages = useMemo(() => [
        {
            component: (
                <SimpleConfig
                    ds={ds}
                    viewDataPermission={viewDataPermission}
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
                    selectedMetric={selectedMetric}
                    setSelectedMetric={setSelectedMetric}
                    maxValue={maxValue}
                    setMaxValue={setMaxValue}
                    capPercentAt100={capPercentAt100}
                    setCapPercentAt100={setCapPercentAt100}
                    boxGrouping={boxGrouping}
                    setBoxGrouping={setBoxGrouping}
                    boxTimePeriod={boxTimePeriod}
                    setBoxTimePeriod={setBoxTimePeriod}
                    pieLabelPlacement={pieLabelPlacement}
                    setPieLabelPlacement={setPieLabelPlacement}
                    rounding={rounding}
                    setRounding={setRounding}
                    numberFormat={numberFormat}
                    setNumberFormat={setNumberFormat}
                    percentRounding={percentRounding}
                    setPercentRounding={setPercentRounding}
                    axisNumberFormat={axisNumberFormat}
                    setAxisNumberFormat={setAxisNumberFormat}
                    rawGraphData={rawGraphData}
                    boxUseRawData={boxUseRawData}
                    setBoxUseRawData={setBoxUseRawData}
                    alerts={alerts}
                    setAlerts={setAlerts}
                    userId={currentUserId}
                    workspaceId={workspaceId}
                    workspaceUsers={workspaceUsers}
                />
            ),
            validate: () => !!form.metricName.trim(),
        },
    ], [ds, viewDataPermission, selectedMetric, valueSelection, dateSelection, aggregationSelection, aggChecked, form, viewShotRef, graphData, rawGraphData]);

    return (
        <MetricWizard
            title="New Metric"
            pages={pages}
            onSubmit={handleSubmit}
        />
    );
};

export default CreateSimpleMetric;

