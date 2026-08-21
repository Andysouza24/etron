// Shared metric chart renderer. Orchestrates three view modes:
//
//   - Display view (daily 7-day window with month picker, chevron paging,
//     and optional gap interpolation for line/area charts).
//   - Aggregation view (weekly / monthly / yearly buckets, chevron paging
//     with the same per-page smooth-pan mechanics as the daily view).
//   - Legacy year filter (segmented-button year selector + wide
//     horizontal scroll), kept as a fallback for non-display modes.
//
// Heavy lifting lives in `usePageableTimeSeries` (which itself wraps
// `useDisplayView`, `useAggregationView`, and `usePagedChartScroll`) and
// in `useYearFilter`. This file wires them up, supplies the user-facing
// controls, and delegates rendering to `GraphPreview` via `ScrollableChart`.

import { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { ActivityIndicator } from "react-native-paper";
import GapsToggleRow from "./GapsToggleRow";
import GraphPreview from "./GraphPreview";
import IndependentVariableChip from "./IndependentVariableChip";
import PagedRangeControls from "./PagedRangeControls";
import ScrollableChart from "./ScrollableChart";
import VariableChipSelector from "./VariableChipSelector";
import YearFilterBar from "./YearFilterBar";
import usePageableTimeSeries from "../../../../hooks/modules/day_book/metrics/usePageableTimeSeries";
import useYearFilter from "../../../../hooks/modules/day_book/metrics/useYearFilter";
import { sortByDateKey, toDate } from "../../../../utils/metricDateUtils";
import {
    buildMonthHeaderLabel,
    buildMonthList,
    formatDateRangeLabel,
} from "../../../../utils/metricDateLabels";
import {
    INTERPOLATABLE_CHART_TYPES,
    TIME_SERIES_TYPES,
} from "../../../../utils/metricChartTypes";

// Flip to swap the legacy year selector for the daily display view.
export const USE_DISPLAY_VIEW = true;
// Flip to enable the aggregation toggle (Daily/Weekly/Monthly/Yearly)
// driven by the `aggregationPeriod` prop. "daily" keeps the display view;
// other periods route through the bucketed scroll view.
export const USE_AGGREGATION_VIEW = true;

const DEFAULT_WINDOW_DAYS = 7;
const DEFAULT_WINDOW_STEP_DAYS = 1;
// Rendered "page" size for the smooth-pan scroll. Sized so the user can
// smooth-scroll within a page, and pages slide far enough that the
// previously-visible window still has room to keep panning in the same
// direction after the transition. Caps the SVG node count and avoids
// blowing past Android's canvas bitmap limit.
const PAGE_DAYS = 28;
const PAGE_STEP_DAYS = Math.max(1, PAGE_DAYS - 2 * DEFAULT_WINDOW_DAYS);

const MIN_PX_PER_POINT = 24;
const COMPACT_MIN_PX_PER_POINT = 14;

const identity = (node) => node;

const MetricGraph = ({
    config,
    data,
    yKeys,
    colours,
    axisColorMode,
    compact = false,
    availableYears: availableYearsProp,
    selectedYear: selectedYearProp,
    onYearChange,
    loading = false,
    hideYearFilter = false,
    compactBottom = false,
    aggregationPeriod = "daily",
    aliases,
    wheelIndex,
    setWheelIndex,
    onRenameVariable,
    onRenameIndependent,
    renderGraphContainer = identity,
}) => {
    const [containerWidth, setContainerWidth] = useState(0);
    const legacyScrollRef = useRef(null);

    const chartType = config?.chartType || config?.type || config?.graphType;
    const xKey = config?.independentVariable;
    const sortedData = useMemo(() => sortByDateKey(data, xKey), [data, xKey]);

    // ------- view mode flags ----------------------------------------------

    const isAggregationView = USE_AGGREGATION_VIEW
        && aggregationPeriod && aggregationPeriod !== "daily"
        && !compact && !hideYearFilter
        && TIME_SERIES_TYPES.has(chartType);
    const isDisplayView = USE_DISPLAY_VIEW
        && !compact && !hideYearFilter
        && TIME_SERIES_TYPES.has(chartType)
        && !isAggregationView;
    const supportsInterpolation = isDisplayView && INTERPOLATABLE_CHART_TYPES.has(chartType);
    const isPagedView = isDisplayView || isAggregationView;

    // Press-and-hold "show gaps" toggle: drops interpolation so the user
    // can see raw points and the gaps between them.
    const [showGaps, setShowGaps] = useState(false);

    // ------- year filter --------------------------------------------------

    const yearFilter = useYearFilter({
        sortedData,
        xKey,
        chartType,
        timeSeriesTypes: TIME_SERIES_TYPES,
        availableYearsProp,
        selectedYearProp,
        onYearChange,
        enabled: !isDisplayView && !isAggregationView,
    });
    const showYearFilter = !isDisplayView && !isAggregationView
        && !compact && !hideYearFilter
        && yearFilter.availableYears.length > 1;

    // In controlled mode the backend has already filtered by year; in the
    // display/aggregation modes the views span the whole dataset. Only
    // legacy uncontrolled tiles need a local year filter.
    const yearFilteredData = useMemo(() => {
        if (isDisplayView || isAggregationView) return sortedData;
        if (yearFilter.isControlled) return sortedData;
        if (yearFilter.selectedYear == null || yearFilter.availableYears.length === 0) return sortedData;
        return sortedData.filter((row) => {
            const date = toDate(row?.[xKey]);
            return date && date.getFullYear() === Number(yearFilter.selectedYear);
        });
    }, [isDisplayView, isAggregationView, yearFilter, sortedData, xKey]);

    // ------- paged time-series orchestration ------------------------------

    const pageable = usePageableTimeSeries({
        isDisplayView,
        isAggregationView,
        sortedData,
        yearFilteredData,
        xKey,
        yKeys,
        aggregationPeriod,
        pageDays: PAGE_DAYS,
        pageStepDays: PAGE_STEP_DAYS,
        visibleSpan: DEFAULT_WINDOW_DAYS,
        stepDays: DEFAULT_WINDOW_STEP_DAYS,
        interpolate: supportsInterpolation && !showGaps,
        containerWidth,
    });
    const { display, aggregation, paging, pagedSourceRows, windowStart, windowEnd } = pageable;

    // ------- month picker (display view) ----------------------------------

    const monthHeaderLabel = useMemo(
        () => (isDisplayView ? buildMonthHeaderLabel(windowStart, windowEnd) : ""),
        [isDisplayView, windowStart, windowEnd]
    );
    const monthOptions = useMemo(
        () => (isDisplayView ? buildMonthList(display.dataRangeMin, display.dataRangeMax) : []),
        [isDisplayView, display.dataRangeMin, display.dataRangeMax]
    );
    // True only when the whole dataset sits in a single calendar month
    // *of the same year*. The picker collapses to plain text in that case.
    const isSingleMonthRange = useMemo(() => {
        if (!isDisplayView || !display.dataRangeMin || !display.dataRangeMax) return false;
        return display.dataRangeMin.getFullYear() === display.dataRangeMax.getFullYear()
            && display.dataRangeMin.getMonth() === display.dataRangeMax.getMonth();
    }, [isDisplayView, display.dataRangeMin, display.dataRangeMax]);
    const selectedMonthKey = useMemo(() => {
        if (!isDisplayView || !windowEnd) return null;
        return String(windowEnd.getMonth());
    }, [isDisplayView, windowEnd]);

    const handleMonthChange = (key) => {
        if (key == null || !windowEnd) return;
        const monthIndex = Number(key);
        if (!Number.isFinite(monthIndex)) return;
        // Jump within the year currently displayed. When the window
        // straddles two years, end's year is the more recent — matching
        // the user's "most recent year between two" rule.
        const targetYear = windowEnd.getFullYear();
        const lastDay = new Date(targetYear, monthIndex + 1, 0);
        pageable.scrollDisplayViewToEndDate(lastDay);
    };

    // ------- legacy wide-chart scroll (non-display time series) -----------

    const filteredData = isPagedView ? pagedSourceRows : yearFilteredData;

    const isLegacyScrollable = !compact && !isPagedView && TIME_SERIES_TYPES.has(chartType);
    const minPxPerPoint = compact ? COMPACT_MIN_PX_PER_POINT : MIN_PX_PER_POINT;
    const legacyDesiredWidth = isLegacyScrollable && containerWidth > 0
        ? Math.max(containerWidth, filteredData.length * minPxPerPoint)
        : 0;
    const shouldLegacyScroll = isLegacyScrollable && legacyDesiredWidth > containerWidth;

    useEffect(() => {
        if (!shouldLegacyScroll || !legacyScrollRef.current) return undefined;
        const id = setTimeout(() => {
            legacyScrollRef.current?.scrollToEnd?.({ animated: false });
        }, 50);
        return () => clearTimeout(id);
    }, [shouldLegacyScroll, legacyDesiredWidth, filteredData.length]);

    // ------- render -------------------------------------------------------

    const rangeLabel = formatDateRangeLabel(windowStart, windowEnd);
    const aggregationHeaderLabel = useMemo(
        () => (isAggregationView ? buildMonthHeaderLabel(windowStart, windowEnd) : ""),
        [isAggregationView, windowStart, windowEnd]
    );
    const showControls = !compact && !hideYearFilter
        && (showYearFilter || isPagedView);

    // The display view forces a two-line weekday/day-of-month tick so
    // the 7-day axis stays legible regardless of saved xAxisDateFormat.
    const effectiveXAxisDateFormat = isDisplayView ? "ddd-DD" : config?.xAxisDateFormat;

    const renderChart = (chartWidth) => {
        const content = (
            <GraphPreview
                graphType={chartType}
                data={filteredData}
                xKey={xKey}
                yKeys={yKeys}
                colours={colours}
                axisColorMode={axisColorMode}
                maxValue={config?.maxValue}
                capPercentAt100={config?.capPercentAt100}
                boxGrouping={config?.boxGrouping}
                boxTimePeriod={config?.boxTimePeriod}
                pieLabelPlacement={config?.pieLabelPlacement}
                rounding={config?.rounding}
                numberFormat={config?.numberFormat}
                percentRounding={config?.percentRounding}
                axisNumberFormat={config?.axisNumberFormat}
                rawGraphData={config?.rawGraphData}
                boxUseRawData={config?.boxUseRawData}
                xAxisDateFormat={effectiveXAxisDateFormat}
                xAxisChronological={isAggregationView ? false : config?.xAxisChronological}
                preFormattedXLabels={isAggregationView}
                secondaryDateTicks={isAggregationView ? aggregation.secondaryTicks : null}
                thresholds={config?.thresholds}
                compactBottom={compactBottom}
            />
        );
        if (chartWidth > 0) {
            return <View style={{ width: chartWidth, height: "100%" }}>{content}</View>;
        }
        return content;
    };

    const loadingOverlay = loading ? (
        <View pointerEvents="none" style={styles.loadingOverlay}>
            <ActivityIndicator size="small" />
        </View>
    ) : null;

    const onContainerLayout = (e) => setContainerWidth(e.nativeEvent.layout.width);

    const independentVariable = config?.independentVariable;
    const independentAlias = independentVariable && aliases?.[independentVariable]
        ? aliases[independentVariable]
        : undefined;

    const chartNode = (
        <ScrollableChart
            containerWidth={containerWidth}
            onContainerLayout={onContainerLayout}
            chartWidth={isPagedView ? paging.chartWidth : legacyDesiredWidth}
            renderChart={renderChart}
            scrollRef={isPagedView ? paging.scrollRef : legacyScrollRef}
            onScroll={isPagedView ? paging.onScroll : undefined}
            onMomentumScrollEnd={isPagedView ? paging.handleMomentumScrollEnd : undefined}
            isScrollable={isPagedView ? paging.shouldScroll : shouldLegacyScroll}
            overlay={loadingOverlay}
        />
    );

    return (
        <View style={styles.root}>
            {showControls && (
                <View style={styles.controls}>
                    {isDisplayView ? (
                        <PagedRangeControls
                            headerLabel={monthHeaderLabel}
                            months={monthOptions}
                            selectedMonthKey={selectedMonthKey}
                            onMonthChange={handleMonthChange}
                            monthReadOnly={isSingleMonthRange}
                            rangeLabel={rangeLabel}
                            onPrev={paging.handlePrev}
                            onNext={paging.handleNext}
                            disablePrev={pageable.disablePrev}
                            disableNext={pageable.disableNext}
                        />
                    ) : isAggregationView ? (
                        <PagedRangeControls
                            // Static context line; chevrons below drive paging.
                            headerLabel={aggregationHeaderLabel}
                            monthReadOnly
                            rangeLabel={rangeLabel}
                            onPrev={paging.handlePrev}
                            onNext={paging.handleNext}
                            disablePrev={pageable.disablePrev}
                            disableNext={pageable.disableNext}
                        />
                    ) : (
                        showYearFilter && (
                            <YearFilterBar
                                years={yearFilter.availableYears}
                                selectedYear={yearFilter.selectedYear}
                                onChange={yearFilter.setSelectedYear}
                            />
                        )
                    )}
                </View>
            )}

            <VariableChipSelector
                dependentVariables={yKeys}
                colours={colours}
                wheelIndex={wheelIndex}
                setWheelIndex={setWheelIndex}
                aliases={aliases ?? {}}
                onRenameVariable={onRenameVariable}
            />

            {renderGraphContainer(chartNode)}

            <IndependentVariableChip
                independentVariable={independentVariable}
                alias={independentAlias}
                onRename={onRenameIndependent}
            />

            {supportsInterpolation && (
                <GapsToggleRow
                    active={showGaps}
                    onPressIn={() => setShowGaps(true)}
                    onPressOut={() => setShowGaps(false)}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    root: {
        flex: 1,
        width: "100%",
    },
    controls: {
        flexDirection: "row",
        alignItems: "center",
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0,0,0,0.04)",
    },
});

export default MetricGraph;
