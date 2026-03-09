import { Text } from "react-native-paper";
import Header from "../../../../../../../components/layout/Header";
import { View, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import React, { useState, useCallback, useMemo, useEffect } from "react";
import ResponsiveScreen from "../../../../../../../components/layout/ResponsiveScreen";
import useMetricForm from "../../../../../../../hooks/modules/day_book/metrics/useMetricForm";
import BasicButton from "../../../../../../../components/common/buttons/BasicButton";
import DataSourceSelector from "../../../../../../../components/modules/day-book/metrics/DataSourceSelector";
import GraphPreview from "../../../../../../../components/modules/day-book/metrics/GraphPreview";
import CustomiseMetricStep from "../../../../../../../components/modules/day-book/metrics/CustomiseMetricStep";
import DataPreviewModal from "../../../../../../../components/modules/day-book/metrics/DataPreviewModal";
import useMetricDataSource from "../../../../../../../hooks/modules/day_book/metrics/useMetricDataSource";
import useMetricSubmission from "../../../../../../../hooks/modules/day_book/metrics/useMetricSubmission";
import { useHasPermission } from "../../../../../../../hooks/useHasPermission";
import { simpleStyles } from "../../../../../../../assets/styles/stylesheets/day-book/modules/metrics/simpleMetric";
import ExistingMetricsModal from "../../../../../../../components/modules/day-book/metrics/ExistingMetricsModal";
import ValueSelector from "../../../../../../../components/modules/day-book/metrics/ValueSelector";
import DateSelector from "../../../../../../../components/modules/day-book/metrics/DateSelector";
import GraphTypes from "../graph-types";
import DropDown from "../../../../../../../components/common/input/DropDown";
import MetricSelector from "../../../../../../../components/modules/day-book/MetricSelector";
import DimensionSelector from "../../../../../../../components/modules/day-book/metrics/DimensionSelector";
import metricService from "../../../../../../../services/MetricService";


function parseNumeric(value) {
    if (typeof value === "number") return value;
    if (typeof value === "string") {
        const stripped = value.replace(/,/g, "");
        const num = Number(stripped);
        if (!isNaN(num) && stripped !== "") return num;
    }
    return value;
}

function convertToGraphData(rows) {
    return rows.map((row) => {
        const newRow = {};
        for (const [key, value] of Object.entries(row)) {
            newRow[key] = parseNumeric(value);
        }
        return newRow;
    });
}

const Dimensional = () => {
    const router = useRouter();
    const { allowed: viewDataPermission } = useHasPermission("modules.daybook.datasources.view_data");

    // --- data source ---
    const ds = useMetricDataSource();

    // --- local form state (simple-specific) ---
    const [selectedReadyData, setSelectedReadyData] = useState(null);
    const [selectedMetric, setSelectedMetric] = useState(null); // graph type
    const [selectedRows, setSelectedRows] = useState([]);
    const [dataVisible, setDataVisible] = useState(false);
    const [existingMetricsVisible, setExistingMetricsVisible] = useState(false);
    const [valueSelection, setValueSelection] = useState(null);
    const [dateSelection, setDateSelection] = useState(null);
    const [metricSelection, setMetricSelection] = useState(null);
    const [dimensionSelection, setDimensionSelection] = useState(null);
    const [metricConfig, setMetricConfig] = useState(null);

    // --- fetch selected metric config ---
    useEffect(() => {
        if (!metricSelection) {
            setMetricConfig(null);
            setDimensionSelection(null);
            setDateSelection(null);
            return;
        }
        (async () => {
            try {
                const result = await metricService.getMetric(metricSelection);
                const metric = result.data ?? result;
                const config = metric?.config ?? {};
                setMetricConfig(config);
                // auto-select the date from the metric
                if (config.independentVariable) {
                    setDateSelection(config.independentVariable);
                }
                console.log("[Dimensional] Fetched metric config:", config);
            } catch (err) {
                console.error("[Dimensional] Error fetching metric config:", err);
                setMetricConfig(null);
            }
        })();
    }, [metricSelection]);

    // the value field tracked by the selected metric
    const valueField = useMemo(() => {
        if (!metricConfig?.dependentVariables?.length) return null;
        return metricConfig.dependentVariables[0];
    }, [metricConfig]);

    // unique values present in the chosen dimension column
    const dimensionValues = useMemo(() => {
        if (!dimensionSelection || !ds.dataSourceData.length) return [];
        const unique = [...new Set(ds.dataSourceData.map((row) => row[dimensionSelection]))];
        return unique.filter((v) => v != null).map(String);
    }, [dimensionSelection, ds.dataSourceData]);

    // --- validation ---
    const validate = useCallback(
        (currentStep) => {
            if (currentStep === 0) return !!metricSelection && !!dimensionSelection && !!dateSelection;
            return true;
        },
        [metricSelection, dimensionSelection, dateSelection]
    );

    // --- form hook ---
    const form = useMetricForm({ totalSteps: 2, validate });

    // --- submission ---
    const { submitMetric, viewShotRef } = useMetricSubmission();

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

    // --- continue disabled ---
    const formContinueDisabled =
        (form.step === 0 && (!metricSelection || !dimensionSelection || !dateSelection)) ||
        (form.step === 1 && !form.metricName);

    // --- graph data for preview (pivoted by dimension) ---
    const graphData = useMemo(() => {
        if (!dateSelection || !valueField || !dimensionSelection) return [];

        const rows =
            selectedRows.length > 0
                ? ds.dataSourceData.filter((row) => selectedRows.includes(row[ds.dataSourceVariableNames[0]]))
                : ds.dataSourceData;

        // Pivot: group by date, one column per dimension value
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
                // sum when there are duplicate date+dimension pairs
                grouped[dateVal][key] = (grouped[dateVal][key] ?? 0) + numVal;
            }
        }

        return Object.values(grouped);
    }, [ds.dataSourceData, ds.dataSourceVariableNames, selectedRows, dateSelection, valueField, dimensionSelection]);

    // --- render ---
    const renderConfigStep = () => (
        <ScrollView nestedScrollEnabled>
            <DataSourceSelector
                dropdownItems={ds.dropdownItems}
                selectedValue={selectedReadyData}
                onSelect={(item) => {
                    ds.selectDataSource(item);
                    setSelectedReadyData(item);
                }}
                downloadStatus={ds.downloadStatus}
                viewDataPermission={viewDataPermission}
                onViewData={() => setDataVisible(true)}
                onViewExistingMetrics={() => setExistingMetricsVisible(true)}
                dataSourceId={ds.dataSourceId}
            >
                <View style={simpleStyles.formSection}>
                    <DropDown
                        title="Select Display Type"
                        items={Object.values(GraphTypes).map((g) => ({
                            value: g.value,
                            label: g.label,
                        }))}
                        showRouterButton={false}
                        onSelect={setSelectedMetric}
                        value={selectedMetric}
                    />
                </View>

                <View style={simpleStyles.formSection}>
                    <MetricSelector
                        dataSourceId={ds.dataSourceId}
                        onMetricSelect={setMetricSelection}
                        selectedMetricId={metricSelection}
                    />
                </View>

                {metricSelection && (
                    <>
                        <View style={simpleStyles.formSection}>
                            <DimensionSelector
                                fields={ds.classifiedFields.dimensionFields}
                                selectedDimension={dimensionSelection}
                                onDimensionSelect={setDimensionSelection}
                            />
                        </View>

                        <View style={simpleStyles.formSection}>
                            <DateSelector
                                fields={ds.classifiedFields.dateFields}
                                valueSelection={dateSelection}
                                onValueSelectionChange={setDateSelection}
                                selectionTitle="Select date variable"
                            />
                        </View>
                    </>
                )}

                <DataPreviewModal
                    visible={dataVisible}
                    onDismiss={() => setDataVisible(false)}
                    data={ds.dataSourceData}
                    variableNames={ds.dataSourceVariableNames}
                />

                <ExistingMetricsModal
                    visible={existingMetricsVisible}
                    onDismiss={() => setExistingMetricsVisible(false)}
                    dataSourceId={ds.dataSourceId}
                    onMetricPress={(metric) => {
                        setExistingMetricsVisible(false);
                        router.navigate(`/modules/day-book/metrics/view-metric/${metric.metricId}`);
                    }}
                />
            </DataSourceSelector>
        </ScrollView>
    );

    const renderCustomizeStep = () => (
        <CustomiseMetricStep
            form={form}
            dependentVariables={dimensionValues}
            viewShotRef={viewShotRef}
            graphPreview={({ colours }) => (
                <GraphPreview
                    graphType={selectedMetric}
                    data={graphData}
                    xKey={dateSelection}
                    yKeys={dimensionValues}
                    colours={colours}
                />
            )}
        />
    );

    return (
        <ResponsiveScreen
            header={<Header title="New Dimensional Metric" showBack onBackPress={form.handleBack} />}
            center={false}
            padded
            scroll={true}
            loadingOverlayActive={form.loading}
        >
            <View style={simpleStyles.content}>
                {form.step === 0 ? renderConfigStep() : renderCustomizeStep()}

                <View style={{ alignItems: "flex-end" }}>
                    <BasicButton
                        label={form.isLastStep ? "Finish" : "Continue"}
                        onPress={
                            form.isLastStep
                                ? () => form.handleFinish(handleSubmit)
                                : form.handleNext
                        }
                        disabled={formContinueDisabled}
                        style={simpleStyles.button}
                    />
                </View>
            </View>
        </ResponsiveScreen>
    );
};

export default Dimensional;