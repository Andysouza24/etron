import React, { useState, useCallback, useMemo } from "react";
import { View, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import Header from "../../../../../../../components/layout/Header";
import ResponsiveScreen from "../../../../../../../components/layout/ResponsiveScreen";
import BasicButton from "../../../../../../../components/common/buttons/BasicButton";
import DataSourceSelector from "../../../../../../../components/modules/day-book/metrics/DataSourceSelector";
import VariableSelector from "../../../../../../../components/modules/day-book/metrics/VariableSelector";
import RowSelector from "../../../../../../../components/modules/day-book/metrics/RowSelector";
import GraphPreview from "../../../../../../../components/modules/day-book/metrics/GraphPreview";
import CustomiseMetricStep from "../../../../../../../components/modules/day-book/metrics/CustomiseMetricStep";
import DataPreviewModal from "../../../../../../../components/modules/day-book/metrics/DataPreviewModal";
import useMetricForm from "../../../../../../../hooks/modules/day_book/metrics/useMetricForm";
import useMetricDataSource from "../../../../../../../hooks/modules/day_book/metrics/useMetricDataSource";
import useMetricSubmission from "../../../../../../../hooks/modules/day_book/metrics/useMetricSubmission";
import { useHasPermission } from "../../../../../../../hooks/useHasPermission";
import { simpleStyles } from "../../../../../../../assets/styles/stylesheets/day-book/modules/metrics/simpleMetric";
import ExistingMetricsModal from "../../../../../../../components/modules/day-book/metrics/ExistingMetricsModal";

function convertToGraphData(rows) {
    return rows.map((row) => {
        const newRow = {};
        for (const [key, value] of Object.entries(row)) {
            const num = Number(value);
            newRow[key] = !isNaN(num) ? num : value;
        }
        return newRow;
    });
}

const CreateSimpleMetric = () => {
    const router = useRouter();
    const { allowed: viewDataPermission } = useHasPermission("modules.daybook.datasources.view_data");

    // --- data source ---
    const ds = useMetricDataSource();

    // --- local form state (simple-specific) ---
    const [selectedReadyData, setSelectedReadyData] = useState(null);
    const [selectedMetric, setSelectedMetric] = useState(null); // graph type
    const [chosenIndependentVariable, setChosenIndependentVariable] = useState([]);
    const [chosenDependentVariables, setChosenDependentVariables] = useState([]);
    const [selectedRows, setSelectedRows] = useState([]);
    const [dataVisible, setDataVisible] = useState(false);
    const [existingMetricsVisible, setExistingMetricsVisible] = useState(false);

    const dependentArray = useMemo(
        () => (Array.isArray(chosenDependentVariables) ? chosenDependentVariables : chosenDependentVariables ? [chosenDependentVariables] : []),
        [chosenDependentVariables]
    );

    // --- validation ---
    const validate = useCallback(
        (currentStep) => {
            if (currentStep === 0) return chosenIndependentVariable.length > 0 && !!selectedMetric;
            return true;
        },
        [chosenIndependentVariable, selectedMetric]
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
                independentVariable: chosenIndependentVariable,
                dependentVariables: chosenDependentVariables,
                colours: form.coloursState,
                selectedRows,
            },
        });
    }, [form, ds.dataSourceId, chosenIndependentVariable, chosenDependentVariables, selectedRows, selectedMetric, submitMetric]);

    // --- continue disabled ---
    const formContinueDisabled =
        (form.step === 0 && (chosenIndependentVariable.length === 0 || !selectedMetric)) ||
        (form.step === 1 && !form.metricName);

    // --- graph data for preview ---
    const graphData = useMemo(() => {
        const rows =
            selectedRows.length > 0
                ? ds.dataSourceData.filter((row) => selectedRows.includes(row[ds.dataSourceVariableNames[0]]))
                : ds.dataSourceData;
        return convertToGraphData(rows);
    }, [ds.dataSourceData, ds.dataSourceVariableNames, selectedRows]);

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
                <VariableSelector
                    variableNames={ds.dataSourceVariableNames}
                    selectedMetric={selectedMetric}
                    onSelectMetric={setSelectedMetric}
                    independentVariable={chosenIndependentVariable}
                    onIndependentChange={setChosenIndependentVariable}
                    dependentVariables={chosenDependentVariables}
                    onDependentChange={setChosenDependentVariables}
                />

                <RowSelector
                    data={ds.dataSourceData}
                    idKey={ds.dataSourceVariableNames[0]}
                    selectedRows={selectedRows}
                    onSelectedRowsChange={setSelectedRows}
                />

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
            dependentVariables={dependentArray}
            viewShotRef={viewShotRef}
            graphPreview={({ colours }) => (
                <GraphPreview
                    graphType={selectedMetric}
                    data={graphData}
                    xKey={chosenIndependentVariable}
                    yKeys={dependentArray}
                    colours={colours}
                />
            )}
        />
    );

    return (
        <ResponsiveScreen
            header={<Header title="New Metric" showBack onBackPress={form.handleBack} />}
            center={false}
            padded
            scroll
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

export default CreateSimpleMetric;

