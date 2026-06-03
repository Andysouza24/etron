import React, { useState } from "react";
import { View, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import DataSourceSelector from "../Selectors/DataSourceSelector";
import ValueSelector from "../Selectors/ValueSelector";
import DateSelector from "../Selectors/DateSelector";
import AggregationSelector from "../Selectors/AggregationSelector";
import DataPreviewModal from "../modals/DataPreviewModal";
import ExistingMetricsModal from "../modals/ExistingMetricsModal";
import { simpleStyles } from "../../../../../assets/styles/stylesheets/day-book/modules/metrics/simpleMetric";
import ChipValueSelector from "../Selectors/ChipValueSelector";

export default function SimpleConfig({
    ds,
    viewDataPermission,
    valueSelections,
    setValueSelections,
    dateSelection,
    setDateSelection,
    aggregationSelection,
    setAggregationSelection,
    aggChecked,
    setAggChecked,
}) {
    const router = useRouter();
    const [selectedReadyData, setSelectedReadyData] = useState(null);
    const [dataVisible, setDataVisible] = useState(false);
    const [existingMetricsVisible, setExistingMetricsVisible] = useState(false);

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
                    <ChipValueSelector
                        fields={ds.classifiedFields.valueFields}
                        valueSelections={valueSelections}
                        onValueSelectionChange={setValueSelections}
                        selectionTitle="Select value to track"
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

                <View style={simpleStyles.formSection}>
                    <AggregationSelector
                        selectedAggregation={aggregationSelection}
                        onAggregationSelect={setAggregationSelection}
                        checked={aggChecked}
                        onCheckedChange={setAggChecked}
                    />
                </View>

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
