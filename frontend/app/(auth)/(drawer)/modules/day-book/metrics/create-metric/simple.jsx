import React, { useState, useCallback, useMemo, useEffect } from "react";
import useMetricForm from "../../../../../../../hooks/modules/day_book/metrics/useMetricForm";
import useMetricDataSource from "../../../../../../../hooks/modules/day_book/metrics/useMetricDataSource";
import useMetricSubmission from "../../../../../../../hooks/modules/day_book/metrics/useMetricSubmission";
import useCurrencySymbolSeed from "../../../../../../../hooks/modules/day_book/metrics/useCurrencySymbolSeed";
import { useHasPermission } from "../../../../../../../hooks/useHasPermission";
import { aggregateData, hasDuplicateValues } from "../../../../../../../utils/aggregation";
import { parseNumericOrOriginal } from "../../../../../../../utils/numberParser";
import { DEFAULT_NUMBER_FORMAT } from "../../../../../../../utils/constants/modules/day-book/metrics/numberFormat";
import MetricWizard from "../../../../../../../components/modules/day-book/metrics/MetricWizard";
import SimpleConfig from "../../../../../../../components/modules/day-book/metrics/pages/SimpleConfig";
import MetricDetails from "../../../../../../../components/modules/day-book/metrics/pages/MetricDetails";
import { getWorkspaceId } from "../../../../../../../storage/workspaceStorage";
import { getCurrentUser } from "aws-amplify/auth";
import { apiGet } from "../../../../../../../utils/api/apiClient";
import endpoints from "../../../../../../../utils/api/endpoints";

function convertToGraphData(rows) {
    return rows.map((row) => {
        const newRow = {};
        for (const [key, value] of Object.entries(row)) {
            newRow[key] = parseNumericOrOriginal(value);
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
    const [valueSelections, setValueSelections] = useState([]);
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
    const [numberFormat, setNumberFormat] = useState({ ...DEFAULT_NUMBER_FORMAT });
    const [xAxisDateFormat, setXAxisDateFormat] = useState("auto");
    const [xAxisChronological, setXAxisChronological] = useState(true);

    // alerts state
    const [alerts, setAlerts] = useState([]);
    const [thresholds, setThresholds] = useState([]);
    const [fieldAliases, setFieldAliases] = useState({});
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

    useEffect(() => {
        setValueSelections([]);
    }, [ds.dataSourceId]);

    useCurrencySymbolSeed(valueSelections[0], ds.classifiedFields?.valueFields, setNumberFormat);

    const convertedRows = useMemo(() => {
        const rows =
            selectedRows.length > 0
                ? ds.dataSourceData.filter((row) => selectedRows.includes(row[ds.dataSourceVariableNames[0]]))
                : ds.dataSourceData;
        return convertToGraphData(rows);
    }, [ds.dataSourceData, ds.dataSourceVariableNames, selectedRows]);

    const isAggregated = (aggChecked || hasDuplicateDates) && dateSelection && valueSelections.length > 0 && aggregationSelection;

    const graphData = useMemo(() => {
        if (isAggregated) {
            return aggregateData(convertedRows, dateSelection, valueSelections, aggregationSelection);
        }
        return convertedRows;
    }, [convertedRows, isAggregated, dateSelection, valueSelections, aggregationSelection]);

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
                dependentVariables: valueSelections,
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
                xAxisDateFormat,
                xAxisChronological,
                alerts,
                thresholds,
                fieldAliases,
            },
        });
    }, [form, ds.dataSourceId, dateSelection, valueSelections, selectedRows, selectedMetric, aggChecked, aggregationSelection, submitMetric, maxValue, boxGrouping, boxTimePeriod, pieLabelPlacement, rounding, numberFormat, xAxisDateFormat, xAxisChronological, alerts, thresholds, fieldAliases]);

    const pages = useMemo(() => [
        {
            component: (
                <SimpleConfig
                    ds={ds}
                    viewDataPermission={viewDataPermission}
                    valueSelections={valueSelections}
                    setValueSelections={setValueSelections}
                    dateSelection={dateSelection}
                    setDateSelection={setDateSelection}
                    aggregationSelection={aggregationSelection}
                    setAggregationSelection={setAggregationSelection}
                    aggChecked={aggChecked}
                    setAggChecked={setAggChecked}
                />
            ),
            validate: () => valueSelections.length > 0 && !!dateSelection,
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
                    dependentVariables={valueSelections}
                    viewShotRef={viewShotRef}
                    graphType={selectedMetric}
                    graphData={graphData}
                    xKey={dateSelection}
                    yKeys={valueSelections}
                    dataSourceId={ds.dataSourceId}
                    aggregation={aggChecked ? aggregationSelection : null}
                    selectedRows={selectedRows}
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
                    xAxisDateFormat={xAxisDateFormat}
                    setXAxisDateFormat={setXAxisDateFormat}
                    xAxisChronological={xAxisChronological}
                    setXAxisChronological={setXAxisChronological}
                    alerts={alerts}
                    setAlerts={setAlerts}
                    thresholds={thresholds}
                    setThresholds={setThresholds}
                    userId={currentUserId}
                    workspaceId={workspaceId}
                    workspaceUsers={workspaceUsers}
                    fieldAliases={fieldAliases}
                    setFieldAliases={setFieldAliases}
                />
            ),
            validate: () => !!form.metricName.trim(),
        },
    ], [ds, viewDataPermission, selectedMetric, valueSelections, dateSelection, aggregationSelection, aggChecked, form, viewShotRef, graphData, rawGraphData, fieldAliases]);

    return (
        <MetricWizard
            title="New Metric"
            pages={pages}
            onSubmit={handleSubmit}
        />
    );
};

export default CreateSimpleMetric;

