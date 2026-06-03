import React, { useState, useCallback, useMemo, useEffect } from "react";
import useMetricForm from "../../../../../../../hooks/modules/day_book/metrics/useMetricForm";
import useMetricDataSource from "../../../../../../../hooks/modules/day_book/metrics/useMetricDataSource";
import useMetricSubmission from "../../../../../../../hooks/modules/day_book/metrics/useMetricSubmission";
import useCurrencySymbolSeed from "../../../../../../../hooks/modules/day_book/metrics/useCurrencySymbolSeed";
import { useHasPermission } from "../../../../../../../hooks/useHasPermission";
import { hasDuplicateValues } from "../../../../../../../utils/aggregation";
import { parseNumericOrOriginal } from "../../../../../../../utils/numberParser";
import { DEFAULT_NUMBER_FORMAT } from "../../../../../../../utils/constants/modules/day-book/metrics/numberFormat";
import MetricWizard from "../../../../../../../components/modules/day-book/metrics/MetricWizard";
import DimensionalConfig from "../../../../../../../components/modules/day-book/metrics/pages/DimensionalConfig";
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

const CreateDimensionalMetric = () => {
    const { allowed: viewDataPermission } = useHasPermission("modules.daybook.datasources.view_data");
    const ds = useMetricDataSource();
    const form = useMetricForm();
    const { submitMetric, viewShotRef } = useMetricSubmission();

    const [selectedMetric, setSelectedMetric] = useState("line");
    const [selectedRows, setSelectedRows] = useState([]);
    const [valueSelection, setValueSelection] = useState(null);
    const [dateSelection, setDateSelection] = useState(null);
    const [dimensionSelection, setDimensionSelection] = useState(null);
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
                console.error("[CreateDimensionalMetric] Error loading workspace data:", err);
            }
        })();
    }, []);

    useCurrencySymbolSeed(valueSelection, ds.classifiedFields?.valueFields, setNumberFormat);

    const hasDuplicateDates = useMemo(
        () => hasDuplicateValues(ds.dataSourceData, dateSelection),
        [dateSelection, ds.dataSourceData]
    );

    useEffect(() => {
        setAggChecked(hasDuplicateDates);
    }, [hasDuplicateDates]);

    // Distinct dimension values become the y-series in the pivoted chart.
    const dimensionValues = useMemo(() => {
        if (!dimensionSelection || !ds.dataSourceData.length) return [];
        const unique = [...new Set(ds.dataSourceData.map((row) => row[dimensionSelection]))];
        return unique.filter((v) => v != null).map(String);
    }, [dimensionSelection, ds.dataSourceData]);

    const convertedRows = useMemo(() => {
        const rows =
            selectedRows.length > 0
                ? ds.dataSourceData.filter((row) => selectedRows.includes(row[ds.dataSourceVariableNames[0]]))
                : ds.dataSourceData;
        return convertToGraphData(rows);
    }, [ds.dataSourceData, ds.dataSourceVariableNames, selectedRows]);

    const isAggregated =
        (aggChecked || hasDuplicateDates) && dateSelection && valueSelection && aggregationSelection;

    // Local pivot: { [date]: { date, [dimValue]: aggregated } }. Used as a
    // fallback before backend preview data arrives.
    const graphData = useMemo(() => {
        if (!dateSelection || !valueSelection || !dimensionSelection) return [];

        const grouped = {};
        for (const row of convertedRows) {
            const dateVal = row[dateSelection];
            const dimVal = row[dimensionSelection];
            const numVal = row[valueSelection];

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
    }, [convertedRows, dateSelection, valueSelection, dimensionSelection]);

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
                dimensionField: dimensionSelection,
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
                fieldAliases,
            },
        });
    }, [form, ds.dataSourceId, dateSelection, valueSelection, dimensionSelection, selectedRows, selectedMetric, aggChecked, aggregationSelection, submitMetric, maxValue, boxGrouping, boxTimePeriod, pieLabelPlacement, rounding, numberFormat, percentRounding, axisNumberFormat, boxUseRawData, xAxisDateFormat, xAxisChronological, alerts, fieldAliases]);

    const pages = useMemo(() => [
        {
            component: (
                <DimensionalConfig
                    ds={ds}
                    viewDataPermission={viewDataPermission}
                    valueSelection={valueSelection}
                    setValueSelection={setValueSelection}
                    dateSelection={dateSelection}
                    setDateSelection={setDateSelection}
                    dimensionSelection={dimensionSelection}
                    setDimensionSelection={setDimensionSelection}
                    aggregationSelection={aggregationSelection}
                    setAggregationSelection={setAggregationSelection}
                    aggChecked={aggChecked}
                    setAggChecked={setAggChecked}
                />
            ),
            validate: () => !!valueSelection && !!dateSelection && !!dimensionSelection,
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
                    dataSourceId={ds.dataSourceId}
                    aggregation={aggChecked ? aggregationSelection : null}
                    dimensionField={dimensionSelection}
                    valueFields={valueSelection ? [valueSelection] : []}
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
                    userId={currentUserId}
                    workspaceId={workspaceId}
                    workspaceUsers={workspaceUsers}
                    fieldAliases={fieldAliases}
                    setFieldAliases={setFieldAliases}
                />
            ),
            validate: () => !!form.metricName.trim(),
        },
    ], [ds, viewDataPermission, selectedMetric, valueSelection, dateSelection, dimensionSelection, aggregationSelection, aggChecked, dimensionValues, form, viewShotRef, graphData, rawGraphData, fieldAliases]);

    return (
        <MetricWizard
            title="New Dimensional Metric"
            pages={pages}
            onSubmit={handleSubmit}
        />
    );
};

export default CreateDimensionalMetric;
