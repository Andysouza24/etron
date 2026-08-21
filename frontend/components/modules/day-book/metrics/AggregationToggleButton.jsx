// AggregationToggleButton
//
// Replaces the data source chip in the top-right of the metric graph
// subheading when the aggregation view is enabled. Tapping the button
// cycles through Daily → Weekly → Monthly → Yearly → Daily and reports
// the new period via `onPress`.
//
// The button mirrors the chip's compact styling so swapping between the
// two doesn't shift surrounding layout.

import { StyleSheet } from "react-native";
import { Chip, useTheme } from "react-native-paper";
import { AGGREGATION_PERIOD_LABELS } from "../../../../utils/metricAggregationPeriod";

const AggregationToggleButton = ({
    period = "daily",
    onPress,
    backgroundColor,
    textColor,
}) => {
    const theme = useTheme();
    const resolvedBackground = backgroundColor || theme.colors.secondaryContainer;
    const resolvedTextColor = textColor || theme.colors.onSecondaryContainer;
    const label = AGGREGATION_PERIOD_LABELS[period] || AGGREGATION_PERIOD_LABELS.daily;

    return (
        <Chip
            compact
            icon="cached"
            onPress={onPress}
            accessibilityLabel={`Aggregation: ${label}. Tap to change.`}
            accessibilityHint="Cycles through Daily, Weekly, Monthly, and Yearly aggregation"
            style={[styles.chip, { backgroundColor: resolvedBackground }]}
            textStyle={[styles.chipText, { color: resolvedTextColor }]}
        >
            {label}
        </Chip>
    );
};

const styles = StyleSheet.create({
    chip: {
        alignSelf: "flex-start",
    },
    chipText: {
        fontWeight: "600",
    },
});

export default AggregationToggleButton;
