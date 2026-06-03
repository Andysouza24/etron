// AggregationSegmentedButton
//
// Alternative to AggregationToggleButton. Renders a four-segment
// SegmentedButtons control (Daily / Weekly / Monthly / Yearly) so the
// user can jump directly to any aggregation period instead of cycling
// through them.
//
// Designed to sit below the graph (under the independent variable chip
// and the gaps toggle) rather than in the metric header row.

import { StyleSheet, View } from "react-native";
import { SegmentedButtons } from "react-native-paper";
import { AGGREGATION_PERIODS, AGGREGATION_PERIOD_LABELS } from "../../../../utils/metricAggregationPeriod";

const SEGMENTS = AGGREGATION_PERIODS.map((period) => ({
    value: period,
    label: AGGREGATION_PERIOD_LABELS[period],
}));

const AggregationSegmentedButton = ({ period = "daily", onChange }) => {
    return (
        <View style={styles.container}>
            <SegmentedButtons
                value={period}
                onValueChange={onChange}
                buttons={SEGMENTS}
                density="small"
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 8,
    },
});

export default AggregationSegmentedButton;
