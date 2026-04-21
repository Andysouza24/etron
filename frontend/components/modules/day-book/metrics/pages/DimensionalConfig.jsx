import React, { useState, useEffect, useMemo } from "react";
import { View, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import DataSourceSelector from "../Selectors/DataSourceSelector";
import DateSelector from "../Selectors/DateSelector";
import DimensionSelector from "../Selectors/DimensionSelector";
import DataPreviewModal from "../modals/DataPreviewModal";
import ExistingMetricsModal from "../modals/ExistingMetricsModal";
import MetricSelector from "../Selectors/MetricSelector";
import DropDown from "../../../../common/input/DropDown";
import GraphTypes from "../graph-types";
import { simpleStyles } from "../../../../../assets/styles/stylesheets/day-book/modules/metrics/simpleMetric";
import metricService from "../../../../../services/MetricService";

export default function DimensionalConfig({
    ds,
    viewDataPermission,
    selectedMetric,
    setSelectedMetric,
    dateSelection,
    setDateSelection,
    metricSelection,
    setMetricSelection,
    dimensionSelection,
    setDimensionSelection,
    metricConfig,
    setMetricConfig,
}) {
    const router = useRouter();
    const [selectedReadyData, setSelectedReadyData] = useState(null);
    const [dataVisible, setDataVisible] = useState(false);
    const [existingMetricsVisible, setExistingMetricsVisible] = useState(false);

    // fetch selected metric config
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
                if (config.independentVariable) {
                    setDateSelection(config.independentVariable);
                }
            } catch (err) {
                console.error("[DimensionalConfig] Error fetching metric config:", err);
                setMetricConfig(null);
            }
        })();
    }, [metricSelection]);

    return (
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
                    schema={ds.dataSourceSchema}
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
}
