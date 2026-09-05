// MetricViewer
//
// Reusable container that bundles the metric header row with the
// MetricGraph. The header row holds arbitrary left content (e.g. "Last
// updated …") plus an Aggregation toggle (Daily / Weekly / Monthly /
// Yearly) on the right.
//
// The MetricGraph itself now owns the variable chip selector (above the
// chart, below the paged range controls), the chart with chevron paging
// / month picker / data-gaps press-and-hold, and the independent
// variable chip below the chart.
//
// Three aggregation modes:
//
//   1. Controlled — pass `aggregationPeriod` + `onAggregationPeriodChange`.
//      Used by view-metric where each change re-fetches from the backend.
//   2. Uncontrolled — pass nothing and the viewer tracks its own period
//      state, doing client-side bucketing only.
//   3. Hidden — pass `showAggregationToggle={false}`.
//
// The chart can be wrapped (Card / ViewShot / aspect-ratio container)
// via `renderGraphContainer`, which is forwarded to MetricGraph so it
// wraps only the chart node, not the chips.

import { useState } from "react";
import { StyleSheet, View } from "react-native";
import AggregationSegmentedButton from "./AggregationSegmentedButton";
import AggregationToggleButton from "./AggregationToggleButton";
import MetricGraph from "./MetricGraph";
import { NEXT_AGGREGATION_PERIOD } from "../../../../utils/metricAggregationPeriod";
import { isTimeSeriesChartType } from "../../../../utils/metricChartTypes";

// Flip to swap the cycling AggregationToggleButton (in the header row)
// for an AggregationSegmentedButton rendered below the graph (under the
// independent variable chip and the gaps toggle).
export const USE_SEGMENTED_AGGREGATION = true;

const MetricViewer = ({
    // ----- metric data -----
    config,
    data,
    yKeys,
    colours,
    axisColorMode,

    // ----- aggregation toggle -----
    aggregationPeriod: aggregationPeriodProp,
    onAggregationPeriodChange,
    showAggregationToggle = true,
    toggleColors,

    // ----- year filter (forwarded to MetricGraph) -----
    availableYears,
    selectedYear,
    onYearChange,

    // ----- chart state -----
    loading = false,
    compact = false,
    hideYearFilter = false,
    compactBottom = false,

    // ----- chip selector (forwarded to MetricGraph) -----
    aliases,
    wheelIndex,
    setWheelIndex,
    onRenameVariable,
    onRenameIndependent,

    // ----- layout -----
    headerLeft,
    headerRight,
    renderGraphContainer,
    style,
}) => {
    // Internal aggregation state used when the caller is uncontrolled.
    const [internalPeriod, setInternalPeriod] = useState("daily");
    const isAggregationControlled = aggregationPeriodProp != null;
    const aggregationPeriod = isAggregationControlled ? aggregationPeriodProp : internalPeriod;

    const chartType = config?.chartType || config?.type || config?.graphType;
    const isTimeSeries = isTimeSeriesChartType(chartType);
    const canShowToggle = showAggregationToggle && isTimeSeries && !compact && !hideYearFilter;

    const applyPeriod = (next) => {
        if (isAggregationControlled) {
            onAggregationPeriodChange?.(next);
        } else {
            setInternalPeriod(next);
            onAggregationPeriodChange?.(next);
        }
    };

    const handleCyclePeriod = () => {
        applyPeriod(NEXT_AGGREGATION_PERIOD[aggregationPeriod] || "daily");
    };

    const showHeaderToggle = canShowToggle && !USE_SEGMENTED_AGGREGATION;
    const showSegmentedToggle = canShowToggle && USE_SEGMENTED_AGGREGATION;

    const resolvedHeaderRight = headerRight !== undefined
        ? headerRight
        : (showHeaderToggle ? (
            <AggregationToggleButton
                period={aggregationPeriod}
                onPress={handleCyclePeriod}
                backgroundColor={toggleColors?.backgroundColor}
                textColor={toggleColors?.textColor}
            />
        ) : null);

    const showHeader = headerLeft != null || resolvedHeaderRight != null;

    return (
        <View style={style}>
            {showHeader && (
                <View style={styles.headerRow}>
                    <View style={styles.headerLeft}>{headerLeft}</View>
                    {resolvedHeaderRight}
                </View>
            )}

            {showSegmentedToggle && (
                <AggregationSegmentedButton
                    period={aggregationPeriod}
                    onChange={applyPeriod}
                />
            )}

            <MetricGraph
                config={config}
                data={data}
                yKeys={yKeys}
                colours={colours}
                axisColorMode={axisColorMode}
                availableYears={availableYears}
                selectedYear={selectedYear}
                onYearChange={onYearChange}
                loading={loading}
                compact={compact}
                hideYearFilter={hideYearFilter}
                compactBottom={compactBottom}
                aggregationPeriod={aggregationPeriod}
                aliases={aliases}
                wheelIndex={wheelIndex}
                setWheelIndex={setWheelIndex}
                onRenameVariable={onRenameVariable}
                onRenameIndependent={onRenameIndependent}
                renderGraphContainer={renderGraphContainer}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    headerRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 8,
    },
    headerLeft: {
        flex: 1,
        marginRight: 8,
    },
});

export default MetricViewer;
