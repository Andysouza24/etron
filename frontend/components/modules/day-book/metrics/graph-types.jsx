import React, { useState } from "react";
import { VictoryContainer, VictoryAxis, VictoryTheme, VictoryChart, VictoryLine, VictoryBar, VictoryGroup, VictoryPie, VictoryArea, VictoryScatter, VictoryBoxPlot, VictoryHistogram, VictoryLabel } from "victory-native";
import { Text, View } from "react-native";
import { useTheme } from "react-native-paper";
import { parseNumericOrNull as parseNumericValue } from "../../../../utils/numberParser";
import { stripPreFormattedLabelDetail } from "../../../../utils/metricAggregationPeriod";

//TODO: move formatting functions into a separate utils file
//TODO: consider moving graphs into separate files for better organization and maintainability
//TODO: fix box plot grouping logic
//TODO: consider moving to a shared folder

function formatTickValue(t, numberFormat) {
    if (typeof t === "string") return t;
    if (typeof t !== "number" || !Number.isFinite(t)) return t;
    const prefix = numberFormat?.currencySymbol ?? "";
    const abs = Math.abs(t);
    if (abs >= 1e9) {
        const val = t / 1e9;
        return `${prefix}${parseFloat(val.toPrecision(3))}B`;
    }
    if (abs >= 1e6) {
        const val = t / 1e6;
        return `${prefix}${parseFloat(val.toPrecision(3))}M`;
    }
    if (abs >= 1e4) {
        const val = t / 1e3;
        return `${prefix}${parseFloat(val.toPrecision(3))}K`;
    }
    if (abs >= 1e3) {
        return prefix + parseFloat(t.toPrecision(4)).toLocaleString();
    }
    if (Number.isInteger(t)) return prefix + t;
    return prefix + parseFloat(t.toPrecision(3));
}

function formatValueWithRounding(value, rounding, numberFormat) {
    const num = typeof value === "number" ? value : parseNumericValue(value);
    if (num == null || !Number.isFinite(num)) return String(value ?? "");
    const mode = rounding?.mode ?? "none";
    if (mode === "bestFit") {
        return formatTickValue(num, numberFormat);
    }
    const dp = mode === "round" ? (rounding?.decimalPlaces ?? 2) : null;
    if (numberFormat) {
        return formatNumberDisplay(num, { ...numberFormat, decimalPlaces: dp });
    }
    if (mode === "round") {
        return num.toFixed(dp);
    }
    // "none" — full value
    return String(num);
}

function formatTimestamp(value) {
    if (value == null) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

// Split a continuous chart series into colored runs so segments that touch
// a synthetic/interpolated point can be rendered in a neutral colour while
// real-to-real segments keep the metric's colour. A segment between two
// adjacent points is "neutral" if either endpoint is flagged as
// interpolated. Adjacent runs share their boundary point so the resulting
// lines connect visually.
function buildSeriesRuns(seriesData, normalColor, neutralColor) {
    if (!Array.isArray(seriesData) || seriesData.length === 0) return [];
    if (seriesData.length === 1) {
        return [{ data: seriesData, color: seriesData[0]?.interpolated ? neutralColor : normalColor }];
    }
    const colorFor = (i) =>
        (seriesData[i]?.interpolated || seriesData[i + 1]?.interpolated)
            ? neutralColor
            : normalColor;
    const runs = [];
    let runStart = 0;
    let currentColor = colorFor(0);
    for (let i = 1; i < seriesData.length - 1; i++) {
        const nextColor = colorFor(i);
        if (nextColor !== currentColor) {
            runs.push({ data: seriesData.slice(runStart, i + 1), color: currentColor });
            runStart = i;
            currentColor = nextColor;
        }
    }
    runs.push({ data: seriesData.slice(runStart), color: currentColor });
    return runs;
}

// Stable, module-scope chart bodies. These exist so the line/area chart
// components keep a single React identity across re-renders of the parent
// GraphPreview. Defining them inline inside `render` produced a brand-new
// component type every render, which forced React to unmount/remount the
// internal layout state and caused a one-frame flicker on scroll/shift.
function LineChartBody({ data, xKey, yKeys, colours, axisColorMode = "light", numberFormat, axisNumberFormat, xAxisDateFormat, xAxisChronological, preFormattedXLabels, secondaryDateTicks, thresholds, compactBottom = false }) {
    const theme = useTheme();
    const neutralColor = theme?.colors?.lightNeutral ?? "#EEF1F6";
    const [size, setSize] = useState({ width: 0, height: 0 });
    const axisColor = axisColorMode === "dark" ? "white" : "black";
    const sortedData = sortDataByDateKey(data, xKey);
    const yDomain = computeYDomain(sortedData, yKeys);
    const axisFormat = axisNumberFormat ?? numberFormat;
    const dateAxis = buildDateAxisConfig({ sortedData, xKey, xAxisDateFormat, xAxisChronological, preFormattedXLabels });
    const bottomPadding = resolveBottomPadding(compactBottom, hasNegativeYValues(sortedData, yKeys));
    return (
        <View
            style={{ flex: 1 }}
            onLayout={(event) => {
                const { width, height } = event.nativeEvent.layout;
                setSize({ width, height });
            }}
        >
            <MonthHeader label={dateAxis.monthHeaderLabel} axisColor={axisColor} />
            {size.width > 0 && size.height > 0 && (
                <VictoryChart
                    width={size.width}
                    height={size.height - (dateAxis.monthHeaderLabel ? 20 : 0)}
                    theme={VictoryTheme.clean}
                    scale={dateAxis.chartScale ?? { x: "linear", y: "linear" }}
                    domain={yDomain ? { y: yDomain } : undefined}
                    padding={{ top: 10, bottom: bottomPadding, left: 40, right: 30 }}
                    containerComponent={<VictoryContainer responsive={false} />}
                >
                    <VictoryAxis
                        crossAxis
                        {...dateAxis.axisProps}
                        style={{
                            axis: { stroke: axisColor },
                            ticks: { stroke: axisColor },
                            tickLabels: { fill: axisColor, fontSize: 10, padding: 5, angle: dateAxis.tickAngle, textAnchor: dateAxis.tickAnchor },
                            axisLabel: { fill: axisColor, fontSize: 12, padding: 30 },
                        }}
                    />
                    <VictoryAxis
                        dependentAxis
                        tickFormat={(t) => thresholdMatchesTick(t, thresholds, yKeys) ? "" : formatTickValue(t, axisFormat)}
                        style={{
                            axis: { stroke: axisColor },
                            ticks: { stroke: axisColor },
                            tickLabels: { fill: axisColor, fontSize: 10, padding: 5 },
                            axisLabel: { fill: axisColor, fontSize: 12, padding: 40 },
                        }}
                    />

                    {renderThresholdAxis({ thresholds, yKeys, axisColor, axisFormat })}
                    {renderSecondaryDateAxis({ secondaryDateTicks, axisColor })}
                    {yKeys.map((yKey, index) => {
                        const seriesData = sortedData
                            .map((d) => ({ x: dateAxis.mapX(d), y: d[yKey], interpolated: !!d.__interpolated }))
                            .filter((d) => d.y != null && d.x != null);
                        const color = colours[index] || "blue";
                        if (seriesData.length === 1) {
                            return (
                                <VictoryScatter
                                    key={yKey}
                                    data={seriesData}
                                    size={4}
                                    style={{ data: { fill: seriesData[0].interpolated ? neutralColor : color } }}
                                />
                            );
                        }
                        const runs = buildSeriesRuns(seriesData, color, neutralColor);
                        return runs.map((run, runIdx) => (
                            <VictoryLine
                                key={`${yKey}-${runIdx}`}
                                data={run.data}
                                style={{ data: { stroke: run.color } }}
                            />
                        ));
                    })}
                </VictoryChart>
            )}
        </View>
    );
}

function BarChartBody({ data, xKey, yKeys, colours, axisColorMode = "light", numberFormat, axisNumberFormat, xAxisDateFormat, xAxisChronological, preFormattedXLabels, secondaryDateTicks, thresholds, compactBottom = false }) {
    const [size, setSize] = useState({ width: 0, height: 0 });
    const axisColor = axisColorMode === "dark" ? "white" : "black";
    const sortedData = sortDataByDateKey(data, xKey);
    const yDomain = computeYDomain(sortedData, yKeys);
    const axisFormat = axisNumberFormat ?? numberFormat;
    const dateAxis = buildDateAxisConfig({ sortedData, xKey, xAxisDateFormat, xAxisChronological, preFormattedXLabels });
    const bottomPadding = resolveBottomPadding(compactBottom, hasNegativeYValues(sortedData, yKeys));

    let chronoBarWidth = null;
    if (size.width > 0 && (preFormattedXLabels || (dateAxis.isDateSeries && dateAxis.chronological))) {
        const plotWidth = Math.max(1, size.width - 90);
        const seriesCount = Math.max(1, yKeys.length);
        const maxBarWidth = Math.max(8, Math.floor(plotWidth / (8 * seriesCount)));

        if (sortedData.length === 1) {
            chronoBarWidth = Math.max(12, Math.min(40, maxBarWidth));
        } else if (sortedData.length > 1) {
            // For pre-formatted (aggregation) labels, treat each row as one
            // unit apart on the x-axis so bar widths stay consistent with
            // the daily view (where minGap = 1 day).
            let minGap = Infinity;
            let totalSpan = 0;
            if (preFormattedXLabels) {
                minGap = 1;
                totalSpan = sortedData.length - 1;
            } else {
                const times = sortedData
                    .map((row) => {
                        const d = toDate(row?.[xKey]);
                        return d ? d.getTime() : null;
                    })
                    .filter((t) => t != null)
                    .sort((a, b) => a - b);
                if (times.length > 1) {
                    for (let i = 1; i < times.length; i++) {
                        const gap = times[i] - times[i - 1];
                        if (gap > 0 && gap < minGap) minGap = gap;
                    }
                    totalSpan = times[times.length - 1] - times[0];
                }
            }
            if (Number.isFinite(minGap) && totalSpan > 0) {
                const pxPerUnit = plotWidth / totalSpan;
                const gapWidth = Math.floor((minGap * pxPerUnit * 0.8) / seriesCount);
                chronoBarWidth = Math.max(2, Math.min(maxBarWidth, gapWidth));
            }
        }
    }
    const barStyle = chronoBarWidth != null ? { width: chronoBarWidth } : undefined;
    return (
        <View
            style={{ flex: 1 }}
            onLayout={(event) => {
                const { width, height } = event.nativeEvent.layout;
                setSize({ width, height });
            }}
        >
            <MonthHeader label={dateAxis.monthHeaderLabel} axisColor={axisColor} />
            {size.width > 0 && size.height > 0 && (
                <VictoryChart
                    width={size.width}
                    height={size.height - (dateAxis.monthHeaderLabel ? 20 : 0)}
                    theme={VictoryTheme.clean}
                    domainPadding={{ x: 25, y: 10 }}
                    scale={dateAxis.chartScale ?? { x: "linear", y: "linear" }}
                    domain={yDomain ? { y: yDomain } : undefined}
                    padding={{ top: 10, bottom: bottomPadding, left: 40, right: 30 }}
                    containerComponent={<VictoryContainer responsive={false} />}
                >
                    <VictoryAxis
                        crossAxis
                        {...dateAxis.axisProps}
                        style={{
                            axis: { stroke: axisColor },
                            ticks: { stroke: axisColor },
                            tickLabels: { fill: axisColor, fontSize: 10, padding: 5, angle: dateAxis.tickAngle, textAnchor: dateAxis.tickAnchor },
                            axisLabel: { fill: axisColor, fontSize: 12, padding: 30 },
                        }}
                    />
                    <VictoryAxis
                        dependentAxis
                        tickFormat={(t) => thresholdMatchesTick(t, thresholds, yKeys) ? "" : formatTickValue(t, axisFormat)}
                        style={{
                            axis: { stroke: axisColor },
                            ticks: { stroke: axisColor },
                            tickLabels: { fill: axisColor, fontSize: 10, padding: 5 },
                            axisLabel: { fill: axisColor, fontSize: 12, padding: 40 },
                        }}
                    />

                    {renderThresholdAxis({ thresholds, yKeys, axisColor, axisFormat })}
                    {renderSecondaryDateAxis({ secondaryDateTicks, axisColor })}
                    {yKeys.length > 1 ? (
                        <VictoryGroup offset={chronoBarWidth != null ? chronoBarWidth : Math.max(4, Math.min(20, (size.width - 90) / Math.max(1, sortedData.length * yKeys.length + 1)))}>
                            {yKeys.map((yKey, index) => (
                                <VictoryBar
                                    key={yKey}
                                    barWidth={chronoBarWidth ?? undefined}
                                    data={sortedData
                                        .map((d) => ({ x: dateAxis.mapX(d), y: d[yKey] }))
                                        .filter((d) => d.y != null && d.x != null)}
                                    style={{
                                        data: { fill: colours[index] || "blue", ...(barStyle || {}) },
                                    }}
                                />
                            ))}
                        </VictoryGroup>
                    ) : (
                        yKeys.map((yKey, index) => (
                            <VictoryBar
                                key={yKey}
                                barWidth={chronoBarWidth ?? undefined}
                                data={sortedData
                                    .map((d) => ({ x: dateAxis.mapX(d), y: d[yKey] }))
                                    .filter((d) => d.y != null && d.x != null)}
                                style={{
                                    data: { fill: colours[index] || "blue", ...(barStyle || {}) },
                                }}
                            />
                        ))
                    )}
                </VictoryChart>
            )}
        </View>
    );
}

function AreaChartBody({ data, xKey, yKeys, colours, axisColorMode = "light", numberFormat, axisNumberFormat, xAxisDateFormat, xAxisChronological, preFormattedXLabels, secondaryDateTicks, thresholds, compactBottom = false }) {
    const theme = useTheme();
    const neutralColor = theme?.colors?.lightNeutral ?? "#EEF1F6";
    const [size, setSize] = React.useState({ width: 0, height: 0 });
    const axisColor = axisColorMode === "dark" ? "white" : "black";
    const sortedData = sortDataByDateKey(data, xKey);
    const yDomain = computeYDomain(sortedData, yKeys);
    const axisFormat = axisNumberFormat ?? numberFormat;
    const dateAxis = buildDateAxisConfig({ sortedData, xKey, xAxisDateFormat, xAxisChronological, preFormattedXLabels });
    const bottomPadding = resolveBottomPadding(compactBottom, hasNegativeYValues(sortedData, yKeys));
    return (
        <View
            style={{ flex: 1 }}
            onLayout={(event) => {
                const { width, height } = event.nativeEvent.layout;
                setSize({ width, height });
            }}
        >
            <MonthHeader label={dateAxis.monthHeaderLabel} axisColor={axisColor} />
            {size.width > 0 && size.height > 0 && (
                <VictoryChart
                    width={size.width}
                    height={size.height - (dateAxis.monthHeaderLabel ? 20 : 0)}
                    theme={VictoryTheme.clean}
                    scale={dateAxis.chartScale ?? { x: "linear", y: "linear" }}
                    domain={yDomain ? { y: yDomain } : undefined}
                    padding={{ top: 10, bottom: bottomPadding, left: 40, right: 30 }}
                    containerComponent={<VictoryContainer responsive={false} />}
                >
                    <VictoryAxis
                        crossAxis
                        {...dateAxis.axisProps}
                        style={{
                            axis: { stroke: axisColor },
                            ticks: { stroke: axisColor },
                            tickLabels: { fill: axisColor, fontSize: 10, padding: 5, angle: dateAxis.tickAngle, textAnchor: dateAxis.tickAnchor },
                            axisLabel: { fill: axisColor, fontSize: 12, padding: 30 },
                        }}
                    />
                    <VictoryAxis
                        dependentAxis
                        tickFormat={(t) => thresholdMatchesTick(t, thresholds, yKeys) ? "" : formatTickValue(t, axisFormat)}
                        style={{
                            axis: { stroke: axisColor },
                            ticks: { stroke: axisColor },
                            tickLabels: { fill: axisColor, fontSize: 10, padding: 5 },
                            axisLabel: { fill: axisColor, fontSize: 12, padding: 40 },
                        }}
                    />

                    {renderThresholdAxis({ thresholds, yKeys, axisColor, axisFormat })}
                    {renderSecondaryDateAxis({ secondaryDateTicks, axisColor })}
                    {yKeys.map((yKey, index) => {
                        const seriesData = sortedData
                            .map((d) => ({ x: dateAxis.mapX(d), y: d[yKey], interpolated: !!d.__interpolated }))
                            .filter((d) => d.y != null && d.x != null);
                        const color = colours[index] || "blue";
                        const runs = buildSeriesRuns(seriesData, color, neutralColor);
                        return runs.map((run, runIdx) => (
                            <VictoryArea
                                key={`${yKey}-${runIdx}`}
                                data={run.data}
                                style={{
                                    data: {
                                        fill: run.color,
                                        fillOpacity: 0.4,
                                        stroke: run.color,
                                        strokeWidth: 2,
                                    },
                                }}
                            />
                        ));
                    })}
                </VictoryChart>
            )}
        </View>
    );
}

// X-axis date format options. "auto" resolves to "DD/MM" by default but
// downgrades to "DD/MM" when the user picked "DD" and the range exceeds 7 days.
// "ddd-DD" is the default view's two-line label (weekday on top, day-of-month
// underneath); not exposed in the user-facing format picker but the new
// default-view path forces it on so MetricGraph can keep its config-driven
// rendering pipeline.
const X_AXIS_DATE_FORMATS = ["auto", "DD", "DD/MM", "DD/MM/YY", "DD/MM/YYYY", "timestamp", "ddd-DD"];

function formatXAxisDate(value, format) {
    if (value == null) return "";
    if (format === "timestamp") return formatTimestamp(value);
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const yyyy = String(date.getFullYear());
    const yy = yyyy.slice(-2);
    switch (format) {
        case "DD": return dd;
        case "DD/MM/YY": return `${dd}/${mm}/${yy}`;
        case "DD/MM/YYYY": return `${dd}/${mm}/${yyyy}`;
        case "ddd-DD": {
            // Two-line label: weekday short name on top, day-of-month below.
            // Victory's VictoryLabel splits the string on \n.
            const ddd = date.toLocaleDateString(undefined, { weekday: "short" });
            return `${ddd}\n${dd}`;
        }
        case "DD/MM":
        default: return `${dd}/${mm}`;
    }
}

// Build everything the time-series renders need to honour the user's
// x-axis date settings: which value to plot, the effective format, whether
// to show a "April 2025" header (DD mode, ≤7 days), and the VictoryAxis
// `tickValues` / `tickFormat` props.
function buildDateAxisConfig({ sortedData, xKey, xAxisDateFormat, xAxisChronological, preFormattedXLabels = false }) {
    // Aggregation view path: the xKey values are already display-ready
    // strings (e.g. "07 - 13", "Jan", "2026") and must NOT be reparsed as
    // dates. Axis-marker rows are blanked here so the secondary axis can
    // render their labels with longer ticks below.
    if (preFormattedXLabels) {
        const tickValues = sortedData.map((row) => row?.[xKey]);
        return {
            isDateSeries: false,
            chronological: false,
            spanDays: 0,
            effectiveFormat: "auto",
            monthHeaderLabel: null,
            mapX: (row) => row?.[xKey],
            chartScale: undefined,
            axisProps: {
                tickValues,
                tickFormat: (t) => stripPreFormattedLabelDetail(t),
            },
            tickAngle: 0,
            tickAnchor: "middle",
        };
    }

    const dates = sortedData.map((row) => {
        const d = toDate(row?.[xKey]);
        return d;
    });
    const isDateSeries = dates.length > 0 && dates.every((d) => d != null);
    // The new default view forces a horizontal two-line label; every other
    // path uses the legacy slanted style. Keeping the angle inside
    // buildDateAxisConfig lets every chart pick it up via dateAxis.
    const horizontalLabel = (xAxisDateFormat ?? "") === "ddd-DD";
    const tickAngle = horizontalLabel ? 0 : 45;
    const tickAnchor = horizontalLabel ? "middle" : "start";
    if (!isDateSeries) {
        return {
            isDateSeries: false,
            chronological: false,
            spanDays: 0,
            effectiveFormat: "DD/MM",
            monthHeaderLabel: null,
            mapX: (row) => row?.[xKey],
            chartScale: undefined,
            axisProps: {},
            tickAngle,
            tickAnchor,
        };
    }

    const chronological = xAxisChronological !== false;
    const minDate = dates[0];
    const maxDate = dates[dates.length - 1];
    const spanDays = Math.max(0, Math.round((maxDate - minDate) / 86400000));

    // Resolve format. "auto" => DD/MM. "DD" only allowed for ≤7-day spans.
    let effectiveFormat = xAxisDateFormat ?? "auto";
    if (effectiveFormat === "auto") effectiveFormat = "DD/MM";
    if (effectiveFormat === "DD" && spanDays > 7) effectiveFormat = "DD/MM";

    const showMonthHeader = effectiveFormat === "DD" && spanDays <= 7;
    const monthHeaderLabel = showMonthHeader
        ? maxDate.toLocaleDateString(undefined, { month: "long", year: "numeric" })
        : null;

    if (!chronological) {
        return {
            isDateSeries: true,
            chronological: false,
            spanDays,
            effectiveFormat,
            monthHeaderLabel,
            mapX: (row) => row?.[xKey],
            chartScale: undefined,
            axisProps: {
                tickFormat: (t) => formatXAxisDate(t, effectiveFormat),
            },
            tickAngle,
            tickAnchor,
        };
    }

    // Chronological mode: plot true Date objects, scale x as time. We always
    // render a tick for every date so the spacing is unambiguous; when there
    // are more than 7 days we just blank most of the labels and label the
    // rest so the axis stays readable. The new default view ("ddd-DD"
    // format) always shows ~7 days on screen even if the rendered chart
    // is wider, so every tick must stay labelled regardless of span.
    const showEveryDate = spanDays <= 7 || effectiveFormat === "ddd-DD";
    const allTickValues = dates.map((d) => d.getTime());
    let tickValues;
    let tickFormat;
    if (showEveryDate) {
        tickValues = allTickValues;
        tickFormat = (t) => formatXAxisDate(new Date(t), effectiveFormat);
    } else {
        tickValues = allTickValues;
        // Scale label density with the number of dates: roughly one label
        // per ~5 dates, floored at 6 (so short ranges stay legible) and
        // capped at 40 (so very large data sources still avoid label
        // overlap). Never exceed the number of dates we actually have.
        const targetLabelCount = Math.min(
            dates.length,
            Math.max(6, Math.min(40, Math.ceil(dates.length / 5)))
        );
        const labelStep = Math.max(1, Math.round((dates.length - 1) / Math.max(1, targetLabelCount - 1)));
        const labelledIndices = new Set();
        for (let i = 0; i < dates.length; i += labelStep) labelledIndices.add(i);
        labelledIndices.add(dates.length - 1);
        tickFormat = (t, index) => {
            if (!labelledIndices.has(index)) return "";
            const current = new Date(t);
            // Find the most recent previously-labelled tick to detect month
            // changes — adjacent unlabelled ticks would otherwise mask them.
            let prev = null;
            for (let i = index - 1; i >= 0; i--) {
                if (labelledIndices.has(i)) {
                    prev = new Date(allTickValues[i]);
                    break;
                }
            }
            const monthChanged = !prev
                || prev.getMonth() !== current.getMonth()
                || prev.getFullYear() !== current.getFullYear();
            if (monthChanged) {
                return current.toLocaleDateString(undefined, { month: "long" });
            }
            return formatXAxisDate(current, effectiveFormat);
        };
    }

    return {
        isDateSeries: true,
        chronological: true,
        spanDays,
        effectiveFormat,
        monthHeaderLabel,
        mapX: (row) => {
            const d = toDate(row?.[xKey]);
            return d ? d.getTime() : null;
        },
        chartScale: { x: "time", y: "linear" },
        axisProps: { tickValues, tickFormat },
        tickAngle,
        tickAnchor,
    };
}

function MonthHeader({ label, axisColor }) {
    if (!label) return null;
    return (
        <View style={{ alignItems: "center", paddingTop: 4 }}>
            <Text style={{ color: axisColor, fontSize: 12, fontWeight: "bold" }}>{label}</Text>
        </View>
    );
}

function formatNumberDisplay(value, format = {}) {
    const {
        currencySymbol = "",
        thousandsSeparator = ",",
        decimalSeparator = ".",
        decimalPlaces = null,
    } = format;

    const num = parseNumericValue(value);
    if (num == null) return String(value ?? "");

    let str;
    if (decimalPlaces != null) {
        str = Math.abs(num).toFixed(decimalPlaces);
    } else {
        str = String(Math.abs(num));
    }

    const [intPart, decPart] = str.split(".");
    let formattedInt = intPart;
    if (thousandsSeparator) {
        formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, thousandsSeparator);
    }

    let result = formattedInt;
    if (decPart !== undefined) {
        result += decimalSeparator + decPart;
    }

    return (num < 0 ? "-" : "") + currencySymbol + result;
}

function formatPercentDisplay(percent, percentRounding) {
    if (percent == null || !Number.isFinite(percent)) return "0%";
    const mode = percentRounding?.mode ?? "none";
    if (mode === "round") {
        const dp = percentRounding?.decimalPlaces ?? 1;
        return `${percent.toFixed(dp)}%`;
    }
    if (mode === "bestFit") {
        return `${formatTickValue(percent)}%`;
    }
    // "none" — strip trailing zeros
    const str = String(parseFloat(percent.toPrecision(10)));
    return `${str}%`;
}

function computeBoxStats(values) {
    if (!values || values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const len = sorted.length;
    const percentile = (p) => {
        const idx = (p / 100) * (len - 1);
        const lower = Math.floor(idx);
        const upper = Math.ceil(idx);
        if (lower === upper) return sorted[lower];
        return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
    };
    return {
        min: sorted[0],
        q1: percentile(25),
        median: percentile(50),
        q3: percentile(75),
        max: sorted[len - 1],
    };
}

function sortDataByDateKey(data, xKey) {
    if (!data || data.length === 0) return data;
    const firstVal = data[0]?.[xKey];
    if (firstVal == null) return data;
    const parsed = toDate(firstVal);
    if (parsed == null) return data;
    return [...data].sort((a, b) => {
        const da = new Date(a[xKey]);
        const db = new Date(b[xKey]);
        return da - db;
    });
}

function computeYDomain(data, yKeys) {
    const safeYKeys = Array.isArray(yKeys) ? yKeys : yKeys ? [yKeys] : [];
    let maxVal = -Infinity;
    let minVal = Infinity;
    data.forEach((row) => {
        safeYKeys.forEach((yKey) => {
            const num = parseNumericValue(row?.[yKey]);
            if (num != null) {
                if (num > maxVal) maxVal = num;
                if (num < minVal) minVal = num;
            }
        });
    });
    if (!Number.isFinite(maxVal)) return undefined;
    const range = maxVal - minVal;
    const padding = range > 0 ? range * 0.05 : Math.abs(maxVal) * 0.05 || 1;
    const yMin = minVal - padding;
    const yMax = maxVal + padding;
    return [yMin, yMax];
}

function hasNegativeYValues(data, yKeys) {
    const keys = Array.isArray(yKeys) ? yKeys : yKeys ? [yKeys] : [];
    for (const row of data || []) {
        for (const k of keys) {
            const num = parseNumericValue(row?.[k]);
            if (num != null && num < 0) return true;
        }
    }
    return false;
}

// Time-series charts get a tighter bottom padding in compact contexts
// (e.g. the metric list tile) so the x-axis sits closer to the bottom of
// the card. When data extends below the axis we keep the larger value so
// negative bars/points stay comfortably inside the plot.
function resolveBottomPadding(compactBottom, hasNegative) {
    return compactBottom && !hasNegative ? 40 : 50;
}

function toDate(value) {
    if (value == null) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function getTimePeriodLabel(date, timePeriod) {
    const year = date.getFullYear();
    if (timePeriod === "date") return date.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
    if (timePeriod === "year") return `${year}`;
    if (timePeriod === "quarter") return `Q${Math.floor(date.getMonth() / 3) + 1} ${year}`;
    return date.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

function getBoxPlotData({ data, xKey, yKeys, boxGrouping = "all", boxTimePeriod = "date" }) {
    const safeYKeys = Array.isArray(yKeys) ? yKeys : yKeys ? [yKeys] : [];

    if (boxGrouping === "all") {
        const allValues = [];
        data.forEach((row) => {
            safeYKeys.forEach((yKey) => {
                const num = parseNumericValue(row?.[yKey]);
                if (num != null) allValues.push(num);
            });
        });
        const stats = computeBoxStats(allValues);
        if (!stats) return [];
        return [{ x: "All", ...stats }];
    }

    if (boxGrouping === "individual") {
        const points = [];
        data.forEach((row) => {
            const xVal = row?.[xKey];
            safeYKeys.forEach((yKey) => {
                const num = parseNumericValue(row?.[yKey]);
                if (num != null) points.push({ x: String(xVal ?? ""), y: num });
            });
        });
        return points;
    }

    if (boxGrouping === "timePeriod") {
        const grouped = new Map();
        data.forEach((row) => {
            const date = toDate(row?.[xKey]);
            if (!date) return;
            const label = getTimePeriodLabel(date, boxTimePeriod);
            if (!grouped.has(label)) grouped.set(label, []);
            safeYKeys.forEach((yKey) => {
                const num = parseNumericValue(row?.[yKey]);
                if (num != null) grouped.get(label).push(num);
            });
        });
        return [...grouped.entries()]
            .filter(([, values]) => values.length > 0)
            .map(([label, values]) => {
                const stats = computeBoxStats(values);
                return { x: label, ...stats };
            });
    }

    // fallback: per yKey
    return safeYKeys
        .map((yKey) => {
            const values = data
                .map((row) => parseNumericValue(row?.[yKey]))
                .filter((num) => num != null);
            const stats = computeBoxStats(values);
            if (!stats) return null;
            return { x: yKey, ...stats };
        })
        .filter(Boolean);
}
// Returns true when a y-axis tick value coincides with one of the active
// threshold values. Used to suppress the regular tick label so the threshold
// axis's longer tick + italic label can stand in for it.
function thresholdMatchesTick(t, thresholds, yKeys) {
    if (!Array.isArray(thresholds) || thresholds.length === 0) return false;
    const tNum = Number(t);
    if (!Number.isFinite(tNum)) return false;
    return thresholds.some((th) => {
        if (!th) return false;
        const v = Number(th.value);
        if (!Number.isFinite(v)) return false;
        if (th.variable && Array.isArray(yKeys) && !yKeys.includes(th.variable)) return false;
        return Math.abs(v - tNum) < 1e-9;
    });
}

// Overlay a second dependent axis that only draws ticks/labels at threshold
// values, plus a dotted grid line per threshold that spans the full chart
// width (so the line starts at the y-axis rather than the first data point).
// The axis line itself is transparent so the existing dependent axis keeps
// its normal appearance.
function renderThresholdAxis({ thresholds, yKeys, axisColor, axisFormat }) {
    if (!Array.isArray(thresholds) || thresholds.length === 0) return null;
    const active = thresholds
        .filter((t) => t && Number.isFinite(Number(t.value)))
        .filter((t) => !t.variable || (Array.isArray(yKeys) && yKeys.includes(t.variable)));
    if (active.length === 0) return null;
    const byValue = new Map(active.map((t) => [Number(t.value), t]));
    const resolveStroke = ({ tick }) => {
        const t = byValue.get(Number(tick));
        return (t && t.color) || axisColor;
    };
    const resolveOpacity = ({ tick }) => {
        const t = byValue.get(Number(tick));
        return typeof t?.opacity === "number" ? t.opacity : 0.5;
    };
    return (
        <VictoryAxis
            dependentAxis
            tickValues={active.map((t) => Number(t.value))}
            tickFormat={(t) => formatTickValue(t, axisFormat)}
            style={{
                axis: { stroke: "transparent" },
                grid: {
                    stroke: resolveStroke,
                    strokeWidth: 1,
                    strokeDasharray: "4,4",
                    strokeOpacity: resolveOpacity,
                },
                ticks: { stroke: axisColor, size: 18 },
                tickLabels: { fill: axisColor, fontSize: 10, padding: 5, fontStyle: "italic" },
            }}
        />
    );
}

// Overlay a second x (independent) axis that renders the aggregation
// view's month / year "boundary" labels with longer ticks and italic
// text — mirroring the y-axis threshold treatment. Only the marker
// xKeys are ticked, so data buckets keep their plain primary labels.
function renderSecondaryDateAxis({ secondaryDateTicks, axisColor }) {
    if (!Array.isArray(secondaryDateTicks) || secondaryDateTicks.length === 0) return null;
    const labelByX = new Map(secondaryDateTicks.map((t) => [t.x, t.label]));
    return (
        <VictoryAxis
            crossAxis
            tickValues={secondaryDateTicks.map((t) => t.x)}
            tickFormat={(t) => labelByX.get(t) ?? ""}
            style={{
                axis: { stroke: "transparent" },
                grid: { stroke: "transparent" },
                ticks: { stroke: axisColor, size: 18 },
                tickLabels: { fill: axisColor, fontSize: 10, padding: 5, fontStyle: "italic" },
            }}
        />
    );
}

function ScatterChartBody({ data, xKey, yKeys, colours, axisColorMode = "light", numberFormat, axisNumberFormat, xAxisDateFormat, xAxisChronological, preFormattedXLabels, secondaryDateTicks, thresholds, compactBottom = false }) {
    const [size, setSize] = React.useState({ width: 0, height: 0 });
    const axisColor = axisColorMode === "dark" ? "white" : "black";
    const sortedData = sortDataByDateKey(data, xKey);
    const yDomain = computeYDomain(sortedData, yKeys);
    const axisFormat = axisNumberFormat ?? numberFormat;
    const dateAxis = buildDateAxisConfig({ sortedData, xKey, xAxisDateFormat, xAxisChronological, preFormattedXLabels });
    const bottomPadding = resolveBottomPadding(compactBottom, hasNegativeYValues(sortedData, yKeys));
    return (
        <View
            style={{ flex: 1 }}
            onLayout={(event) => {
                const { width, height } = event.nativeEvent.layout;
                setSize({ width, height });
            }}
        >
            <MonthHeader label={dateAxis.monthHeaderLabel} axisColor={axisColor} />
            {size.width > 0 && size.height > 0 && (
                <VictoryChart
                    width={size.width}
                    height={size.height - (dateAxis.monthHeaderLabel ? 20 : 0)}
                    theme={VictoryTheme.clean}
                    scale={dateAxis.chartScale ?? { x: "linear", y: "linear" }}
                    domain={yDomain ? { y: yDomain } : undefined}
                    padding={{ top: 10, bottom: bottomPadding, left: 40, right: 30 }}
                    containerComponent={<VictoryContainer responsive={false} />}
                >
                    <VictoryAxis
                        crossAxis
                        {...dateAxis.axisProps}
                        style={{
                            axis: { stroke: axisColor },
                            ticks: { stroke: axisColor },
                            tickLabels: { fill: axisColor, fontSize: 10, padding: 5, angle: dateAxis.tickAngle, textAnchor: dateAxis.tickAnchor },
                            axisLabel: { fill: axisColor, fontSize: 12, padding: 30 },
                        }}
                    />
                    <VictoryAxis
                        dependentAxis
                        tickFormat={(t) => thresholdMatchesTick(t, thresholds, yKeys) ? "" : formatTickValue(t, axisFormat)}
                        style={{
                            axis: { stroke: axisColor },
                            ticks: { stroke: axisColor },
                            tickLabels: { fill: axisColor, fontSize: 10, padding: 5 },
                            axisLabel: { fill: axisColor, fontSize: 12, padding: 40 },
                        }}
                    />
                    {renderThresholdAxis({ thresholds, yKeys, axisColor, axisFormat })}
                    {renderSecondaryDateAxis({ secondaryDateTicks, axisColor })}
                    {yKeys.map((yKey, index) => (
                        <VictoryScatter
                            key={yKey}
                            size={4}
                            data={sortedData
                                .map((d) => ({ x: dateAxis.mapX(d), y: d[yKey] }))
                                .filter((d) => d.y != null && d.x != null)}
                            style={{
                                data: { fill: colours[index] || "blue" },
                            }}
                        />
                    ))}
                </VictoryChart>
            )}
        </View>
    );
}

function BoxChartBody({ data, xKey, yKeys, colours, axisColorMode = "light", boxGrouping = "all", boxTimePeriod = "date", numberFormat, axisNumberFormat, rawGraphData, boxUseRawData, compactBottom = false }) {
    const [size, setSize] = React.useState({ width: 0, height: 0 });
    const axisColor = axisColorMode === "dark" ? "white" : "black";
    const axisFormat = axisNumberFormat ?? numberFormat;
    const effectiveData = boxUseRawData && rawGraphData ? rawGraphData : data;
    const boxData = getBoxPlotData({ data: effectiveData, xKey, yKeys, boxGrouping, boxTimePeriod });
    const bottomPadding = resolveBottomPadding(compactBottom, hasNegativeYValues(effectiveData, yKeys));

    if (!boxData || boxData.length === 0) {
        return (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                <Text style={{ color: axisColor, textAlign: "center" }}>
                    No data available for box plot.{"\n"}Ensure a numeric value field is selected.
                </Text>
            </View>
        );
    }

    if (boxGrouping === "individual") {
        return (
            <View
                style={{ flex: 1 }}
                onLayout={(event) => {
                    const { width, height } = event.nativeEvent.layout;
                    setSize({ width, height });
                }}
            >
                {size.width > 0 && size.height > 0 && (
                    <VictoryChart
                        width={size.width}
                        height={size.height}
                        theme={VictoryTheme.clean}
                        domainPadding={20}
                        padding={{ top: 10, bottom: bottomPadding, left: 40, right: 30 }}
                        containerComponent={<VictoryContainer responsive={false} />}
                    >
                        <VictoryAxis
                            style={{
                                axis: { stroke: axisColor },
                                ticks: { stroke: axisColor },
                                tickLabels: { fill: axisColor, fontSize: 10, padding: 5 },
                                axisLabel: { fill: axisColor, fontSize: 12, padding: 30 },
                            }}
                        />
                        <VictoryAxis
                            dependentAxis
                            tickFormat={(t) => formatTickValue(t, axisFormat)}
                            style={{
                                axis: { stroke: axisColor },
                                ticks: { stroke: axisColor },
                                tickLabels: { fill: axisColor, fontSize: 10, padding: 5 },
                                axisLabel: { fill: axisColor, fontSize: 12, padding: 40 },
                            }}
                        />
                        <VictoryScatter
                            data={boxData}
                            size={4}
                            style={{
                                data: { fill: colours[0] || "blue" },
                            }}
                        />
                    </VictoryChart>
                )}
            </View>
        );
    }

    return (
        <View
            style={{ flex: 1 }}
            onLayout={(event) => {
                const { width, height } = event.nativeEvent.layout;
                setSize({ width, height });
            }}
        >
            {size.width > 0 && size.height > 0 && (
                <VictoryChart
                    width={size.width}
                    height={size.height}
                    theme={VictoryTheme.clean}
                    domainPadding={20}
                    padding={{ top: 10, bottom: bottomPadding, left: 40, right: 30 }}
                    containerComponent={<VictoryContainer responsive={false} />}
                >
                    <VictoryAxis
                        style={{
                            axis: { stroke: axisColor },
                            ticks: { stroke: axisColor },
                            tickLabels: { fill: axisColor, fontSize: 10, padding: 5 },
                            axisLabel: { fill: axisColor, fontSize: 12, padding: 30 },
                        }}
                    />
                    <VictoryAxis
                        dependentAxis
                        tickFormat={(t) => formatTickValue(t, axisFormat)}
                        style={{
                            axis: { stroke: axisColor },
                            ticks: { stroke: axisColor },
                            tickLabels: { fill: axisColor, fontSize: 10, padding: 5 },
                            axisLabel: { fill: axisColor, fontSize: 12, padding: 40 },
                        }}
                    />
                    <VictoryBoxPlot
                        data={boxData}
                        style={{
                            min: { stroke: colours[0] || "blue" },
                            max: { stroke: colours[0] || "blue" },
                            q1: { fill: colours[0] || "blue", fillOpacity: 0.3 },
                            q3: { fill: colours[0] || "blue", fillOpacity: 0.3 },
                            median: { stroke: colours[0] || "blue", strokeWidth: 2 },
                        }}
                    />
                </VictoryChart>
            )}
        </View>
    );
}

function HistogramChartBody({ data, xKey, colours, axisColorMode = "light", compactBottom = false }) {
    const [size, setSize] = React.useState({ width: 0, height: 0 });
    const axisColor = axisColorMode === "dark" ? "white" : "black";
    const histogramData = data
        .map((d) => ({ x: toDate(d[xKey]) }))
        .filter((d) => d.x != null);
    const bottomPadding = resolveBottomPadding(compactBottom, false);

    const binCount = 8;
    let bins = binCount;
    if (histogramData.length > 1) {
        const timestamps = histogramData.map((d) => d.x.getTime()).sort((a, b) => a - b);
        const minT = timestamps[0];
        const maxT = timestamps[timestamps.length - 1];
        if (maxT > minT) {
            const step = (maxT - minT) / binCount;
            bins = Array.from({ length: binCount + 1 }, (_, i) => new Date(minT + step * i));
        }
    }

    return (
        <View
            style={{ flex: 1 }}
            onLayout={(event) => {
                const { width, height } = event.nativeEvent.layout;
                setSize({ width, height });
            }}
        >
            {size.width > 0 && size.height > 0 && (
                <VictoryChart
                    width={size.width}
                    height={size.height}
                    theme={VictoryTheme.clean}
                    scale={{ x: "time" }}
                    padding={{ top: 10, bottom: bottomPadding, left: 40, right: 30 }}
                    containerComponent={<VictoryContainer responsive={false} />}
                >
                    <VictoryAxis
                        tickFormat={(tick) => formatTimestamp(tick)}
                        style={{
                            axis: { stroke: axisColor },
                            ticks: { stroke: axisColor },
                            tickLabels: { fill: axisColor, fontSize: 10, padding: 5 },
                            axisLabel: { fill: axisColor, fontSize: 12, padding: 30 },
                        }}
                    />
                    <VictoryAxis
                        dependentAxis
                        tickFormat={formatTickValue}
                        style={{
                            axis: { stroke: axisColor },
                            ticks: { stroke: axisColor },
                            tickLabels: { fill: axisColor, fontSize: 10, padding: 5 },
                            axisLabel: { fill: axisColor, fontSize: 12, padding: 40 },
                        }}
                    />
                    <VictoryHistogram
                        data={histogramData}
                        bins={bins}
                        cornerRadius={0}
                        style={{
                            data: {
                                fill: colours[0] || "#4f83cc",
                                stroke: axisColor,
                                strokeWidth: 1,
                            },
                        }}
                    />
                </VictoryChart>
            )}
        </View>
    );
}


// Registry of available graph types
// Each entry has: `label`, `value`, and a `render` function for later expansion
const GraphTypes = {
    line: {
        label: "Line Chart",
        value: "line",
        previewImage: require("../../../../assets/images/lineChart.png"),
        render: (props) => <LineChartBody {...props} />,
    },

    bar: {
        label: "Bar Chart",
        value: "bar",
        previewImage: require("../../../../assets/images/barChart.png"),
        render: (props) => <BarChartBody {...props} />,
    },

    pie: {
    label: "Pie Chart",
    value: "pie",
    previewImage: require("../../../../assets/images/pieChart.png"),
    render: ({ data, xKey, yKeys, colours, axisColorMode = "light", backgroundMode = "transparent", pieLabelPlacement = "outside", rounding, numberFormat }) => {
        const ChartComponent = () => {
            const [size, setSize] = React.useState({ width: 0, height: 0 });
            const axisColor = axisColorMode === "dark" ? "white" : "black";
            const yKey = Array.isArray(yKeys) ? yKeys[0] : yKeys;

            const chartData = data.map((d) => ({
                x: d[xKey], // label
                y: parseNumericValue(d[yKey]), // value
            })).filter((d) => d.y != null);

            const isInside = pieLabelPlacement === "inside";

            return (
                <View
                    style={{ flex: 1, backgroundColor: backgroundMode === "transparent" ? "transparent" : backgroundMode }}
                    onLayout={(event) => {
                        const { width, height } = event.nativeEvent.layout;
                        setSize({ width, height });
                    }}
                >
                    {size.width > 0 && size.height > 0 && (
                        <>
                            {isInside ? (
                                <>
                                    {/* date labels - always outside */}
                                    <VictoryPie
                                        width={size.width}
                                        height={size.height}
                                        theme={VictoryTheme.clean}
                                        data={chartData}
                                        colorScale={colours && colours.length > 0 ? colours : "qualitative"}
                                        labels={({ datum }) => formatTimestamp(datum.x)}
                                        style={{
                                            labels: {
                                                fontSize: 11,
                                                fill: axisColor,
                                                fontWeight: "normal",
                                                textAnchor: "middle",
                                            },
                                            parent: { backgroundColor: "transparent" },
                                        }}
                                        padding={{ top: 30, bottom: 40, left: 40, right: 40 }}
                                        containerComponent={<VictoryContainer responsive={false} />}
                                    />
                                    {/* value labels - inside slices */}
                                    <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
                                        <VictoryPie
                                            width={size.width}
                                            height={size.height}
                                            theme={VictoryTheme.clean}
                                            data={chartData}
                                            colorScale={colours && colours.length > 0 ? colours : "qualitative"}
                                            labels={({ datum }) => formatValueWithRounding(datum.y, rounding, numberFormat)}
                                            labelRadius={Math.min(size.width, size.height) * 0.22}
                                            style={{
                                                data: { fill: "transparent", stroke: "transparent" },
                                                labels: {
                                                    fontSize: 10,
                                                    fill: axisColor,
                                                    fontWeight: "bold",
                                                    textAnchor: "middle",
                                                },
                                                parent: { backgroundColor: "transparent" },
                                            }}
                                            padding={{ top: 30, bottom: 40, left: 40, right: 40 }}
                                            containerComponent={<VictoryContainer responsive={false} />}
                                        />
                                    </View>
                                </>
                            ) : (
                                /* outside mode: single VictoryPie with stacked date + value labels */
                                <VictoryPie
                                    width={size.width}
                                    height={size.height}
                                    theme={VictoryTheme.clean}
                                    data={chartData}
                                    colorScale={colours && colours.length > 0 ? colours : "qualitative"}
                                    labels={({ datum }) => [formatTimestamp(datum.x), formatValueWithRounding(datum.y, rounding, numberFormat)]}
                                    labelComponent={
                                        <VictoryLabel
                                            style={[
                                                { fontSize: 11, fill: axisColor, fontWeight: "normal" },
                                                { fontSize: 12, fill: axisColor, fontWeight: "bold" },
                                            ]}
                                        />
                                    }
                                    style={{
                                        parent: { backgroundColor: "transparent" },
                                    }}
                                    padding={{ top: 30, bottom: 40, left: 40, right: 40 }}
                                    containerComponent={<VictoryContainer responsive={false} />}
                                />
                            )}
                        </>
                    )}
                </View>
            );
        };
        return <ChartComponent />;
    },
},

    area: {
        label: "Area Chart",
        value: "area",
        previewImage: require("../../../../assets/images/areaChart.png"),
        render: (props) => <AreaChartBody {...props} />,
    },

    scatter: {
        label: "Scatter Plot",
        value: "scatter",
        previewImage: require("../../../../assets/images/scatterPlot.png"),
        render: (props) => <ScatterChartBody {...props} />,
    },

    box: {
        label: "Box Plot",
        value: "box",
        previewImage: require("../../../../assets/images/boxPlot.png"),
        render: (props) => <BoxChartBody {...props} />,
    },

    histogram: {
        label: "Histogram",
        value: "histogram",
        previewImage: require("../../../../assets/images/histogram.png"),
        render: (props) => <HistogramChartBody {...props} />,
    },


    progressBar: {
    label: "Progress Bar",
    value: "progressBar",
        previewImage: require("../../../../assets/images/progressCircle.png"),
    render: ({ data, xKey, yKeys, colours, axisColorMode = "light", maxValue, capPercentAt100, rounding, percentRounding, numberFormat }) => {
        const ChartComponent = () => {
            const axisColor = axisColorMode === "dark" ? "white" : "black";
            const yKey = Array.isArray(yKeys) ? yKeys[0] : yKeys;

            // find value from latest date row
            let latestValue = 0;
            if (data.length > 0 && yKey) {
                let latestRow = data[0];
                if (xKey) {
                    latestRow = data.reduce((best, row) => {
                        const bestDate = toDate(best[xKey]);
                        const rowDate = toDate(row[xKey]);
                        return rowDate && bestDate && rowDate > bestDate ? row : best;
                    }, data[0]);
                }
                latestValue = parseNumericValue(latestRow[yKey]) ?? 0;
            }

            const progressValue = latestValue;
            const safeMaxValue = maxValue != null && Number(maxValue) > 0 ? Number(maxValue) : (latestValue > 0 ? latestValue : 100);
            const rawPercent = Math.max((progressValue / safeMaxValue) * 100, 0);
            const displayPercent = capPercentAt100 ? Math.min(rawPercent, 100) : rawPercent;
            const barPercent = Math.min(rawPercent, 100);

            return (
                <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: 16 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                        <Text style={{ color: axisColor, fontWeight: "bold", fontSize: 16 }}>
                            {formatValueWithRounding(progressValue, rounding, numberFormat)}
                        </Text>
                        <Text style={{ color: axisColor, fontSize: 14 }}>
                            {formatPercentDisplay(displayPercent, percentRounding)}
                        </Text>
                    </View>
                    <View style={{
                        width: "100%",
                        height: 24,
                        backgroundColor: "#e0e0e0",
                        borderRadius: 12,
                        overflow: "hidden",
                    }}>
                        <View style={{
                            width: `${barPercent}%`,
                            height: "100%",
                            backgroundColor: colours[0] || "#4caf50",
                            borderRadius: 12,
                        }} />
                    </View>
                    <Text style={{ color: axisColor, fontSize: 12, marginTop: 4, textAlign: "right" }}>
                        Target: {formatValueWithRounding(safeMaxValue, rounding, numberFormat)}
                    </Text>
                </View>
            );
        };
        return <ChartComponent />;
    },
},

progressCircle: {
    label: "Progress Circle",
    value: "progressCircle",
        previewImage: require("../../../../assets/images/progressCircle.png"),
    render: ({ data, xKey, yKeys, colours, axisColorMode = "light", maxValue, capPercentAt100, rounding, percentRounding, numberFormat }) => {
        const ChartComponent = () => {
            const [size, setSize] = React.useState({ width: 0, height: 0 });
            const axisColor = axisColorMode === "dark" ? "white" : "black";
            const yKey = Array.isArray(yKeys) ? yKeys[0] : yKeys;

            // find value from latest date row
            let latestValue = 0;
            if (data.length > 0 && yKey) {
                let latestRow = data[0];
                if (xKey) {
                    latestRow = data.reduce((best, row) => {
                        const bestDate = toDate(best[xKey]);
                        const rowDate = toDate(row[xKey]);
                        return rowDate && bestDate && rowDate > bestDate ? row : best;
                    }, data[0]);
                }
                latestValue = parseNumericValue(latestRow[yKey]) ?? 0;
            }

            const progressValue = latestValue;
            const safeMaxValue = maxValue != null && Number(maxValue) > 0 ? Number(maxValue) : (latestValue > 0 ? latestValue : 100);
            const rawPercent = Math.max((progressValue / safeMaxValue) * 100, 0);
            const displayPercent = capPercentAt100 ? Math.min(rawPercent, 100) : rawPercent;
            const piePercent = Math.min(rawPercent, 100);

            const chartData = [
                { x: "Complete", y: piePercent },
                { x: "Remaining", y: 100 - piePercent }
            ];

            return (
                <View
                    style={{ flex: 1 }}
                    onLayout={(event) => {
                        const { width, height } = event.nativeEvent.layout;
                        setSize({ width, height });
                    }}
                >
                    {size.width > 0 && size.height > 0 && (
                        <View style={{ position: "relative" }}>
                            <VictoryPie
                                width={size.width}
                                height={size.height}
                                data={chartData}
                                innerRadius={Math.min(size.width, size.height) / 4}
                                cornerRadius={5}
                                labels={() => null}
                                colorScale={[colours[0] || "#4caf50", "transparent"]}
                                containerComponent={<VictoryContainer responsive={false} />}
                            />
                            <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "center", alignItems: "center" }}>
                                <Text style={{ fontSize: 24, fontWeight: "bold", color: axisColor }}>
                                    {formatPercentDisplay(displayPercent, percentRounding)}
                                </Text>
                                <Text style={{ fontSize: 11, color: axisColor, marginTop: 2 }}>
                                    {formatValueWithRounding(progressValue, rounding, numberFormat)} / {formatValueWithRounding(safeMaxValue, rounding, numberFormat)}
                                </Text>
                            </View>
                        </View>
                    )}
                </View>
            );
        };

        return <ChartComponent />;
    },
},

    numbers: {
    label: "Numbers",
    value: "numbers",
        previewImage: require("../../../../assets/images/numbers.png"),
    render: ({ data, yKeys, colours, axisColorMode = "light", numberFormat = {}, rounding }) => {
        const ChartComponent = () => {
            const axisColor = axisColorMode === "dark" ? "white" : "black";

            if (!data || data.length === 0 || !yKeys || yKeys.length === 0) {
                return (
                    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                        <Text style={{ color: axisColor }}>No data available</Text>
                    </View>
                );
            }

            // For simplicity, take the first row of data
            const firstRow = data[0];

            // merge rounding into numberFormat for display
            const effectiveFormat = { ...numberFormat };
            if (rounding?.mode === "round") {
                effectiveFormat.decimalPlaces = rounding.decimalPlaces ?? 2;
            } else if (rounding?.mode === "none") {
                effectiveFormat.decimalPlaces = null;
            }

            return (
                <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                    {yKeys.map((yKey, index) => (
                        <Text
                            key={yKey}
                            style={{
                                fontSize: 18,
                                fontWeight: "bold",
                                color: colours[index] || axisColor,
                                marginVertical: 4,
                            }}
                        >
                            {yKey}: {rounding?.mode === "bestFit"
                                ? formatTickValue(parseNumericValue(firstRow[yKey]))
                                : formatNumberDisplay(firstRow[yKey], effectiveFormat)}
                        </Text>
                    ))}
                </View>
            );
        };

        return <ChartComponent />;
    },
},
};

export default GraphTypes;