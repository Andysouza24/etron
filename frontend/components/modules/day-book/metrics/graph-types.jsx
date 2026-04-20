import React, { useState } from "react";
import { VictoryContainer, VictoryAxis, VictoryTheme, VictoryChart, VictoryLine, VictoryBar, VictoryPie, VictoryArea, VictoryScatter, VictoryBoxPlot, VictoryHistogram, VictoryLabel } from "victory-native";
import { Text, View } from "react-native";

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

function parseNumericValue(value) {
    if (value == null || value === "") return null;
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    const cleaned = String(value).replace(/[$,\s]/g, "");
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : null;
}

function formatTimestamp(value) {
    if (value == null) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
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


// Registry of available graph types
// Each entry has: `label`, `value`, and a `render` function for later expansion
const GraphTypes = {
    line: {
        label: "Line Chart",
        value: "line",
        previewImage: require("../../../../assets/images/lineChart.png"),
        render: ({ data, xKey, yKeys, colours, axisColorMode = "light", rounding, numberFormat, axisNumberFormat }) => {
            const ChartComponent = () => {
                const [size, setSize] = useState({ width: 0, height: 0 });
                const axisColor = axisColorMode === "dark" ? "white" : "black";
                const sortedData = sortDataByDateKey(data, xKey);
                const yDomain = computeYDomain(sortedData, yKeys);
                const axisFormat = axisNumberFormat ?? numberFormat;
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
                                scale={{ x: "linear", y: "linear" }}
                                domain={yDomain ? { y: yDomain } : undefined}
                                padding={{ top: 10, bottom: 50, left: 60, right: 30 }}
                                containerComponent={<VictoryContainer responsive={false} />}
                            >
                                <VictoryAxis
                                    crossAxis
                                    style={{
                                        axis: { stroke: axisColor },
                                        ticks: { stroke: axisColor },
                                        tickLabels: { fill: axisColor, fontSize: 10, padding: 5, angle: 45, textAnchor: "start" },
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

                                {yKeys.map((yKey, index) => (
                                    <VictoryLine
                                        key={yKey}
                                        data={sortedData
                                            .map((d) => ({ x: d[xKey], y: d[yKey] }))
                                            .filter((d) => d.y != null)}
                                        style={{
                                            data: { stroke: colours[index] || "blue" },
                                        }}
                                    />
                                ))}
                            </VictoryChart>
                        )}
                    </View>
                );    
            };
            return <ChartComponent/>;
        },
    },

    bar: {
        label: "Bar Chart",
        value: "bar",
        previewImage: require("../../../../assets/images/barChart.png"),
        render: ({ data, xKey, yKeys, colours, axisColorMode = "light", rounding, numberFormat, axisNumberFormat }) => {
            const ChartComponent = () => {
                const [size, setSize] = useState({ width: 0, height: 0 });
                const axisColor = axisColorMode === "dark" ? "white" : "black";
                const sortedData = sortDataByDateKey(data, xKey);
                const yDomain = computeYDomain(sortedData, yKeys);
                const axisFormat = axisNumberFormat ?? numberFormat;
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
                                domainPadding={{ x: 25, y: 10 }}
                                scale={{ x: "linear", y: "linear" }}
                                domain={yDomain ? { y: yDomain } : undefined}
                                padding={{ top: 10, bottom: 50, left: 60, right: 30 }}
                                containerComponent={<VictoryContainer responsive={false} />}
                            >
                                <VictoryAxis
                                    crossAxis
                                    style={{
                                        axis: { stroke: axisColor },
                                        ticks: { stroke: axisColor },
                                        tickLabels: { fill: axisColor, fontSize: 10, padding: 5, angle: 45, textAnchor: "start" },
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

                                {yKeys.map((yKey, index) => (
                                    <VictoryBar
                                        key={yKey}
                                        data={sortedData
                                            .map((d) => ({ x: d[xKey], y: d[yKey] }))
                                            .filter((d) => d.y != null)}
                                        style={{
                                            data: { fill: colours[index] || "blue" },
                                        }}
                                    />
                                ))}
                            </VictoryChart>
                        )}
                    </View>
                );
            };
            return <ChartComponent/>
        },
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
        render: ({ data, xKey, yKeys, colours, axisColorMode = "light", rounding, numberFormat, axisNumberFormat }) => {
            const ChartComponent = () => {
                const [size, setSize] = React.useState({ width: 0, height: 0 });
                const axisColor = axisColorMode === "dark" ? "white" : "black";
                const sortedData = sortDataByDateKey(data, xKey);
                const yDomain = computeYDomain(sortedData, yKeys);
                const axisFormat = axisNumberFormat ?? numberFormat;
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
                                scale={{ x: "linear", y: "linear" }}
                                domain={yDomain ? { y: yDomain } : undefined}
                                padding={{ top: 10, bottom: 50, left: 60, right: 30 }}
                                containerComponent={<VictoryContainer responsive={false} />}
                            >
                                {/* X Axis */}
                                <VictoryAxis
                                    crossAxis
                                    style={{
                                        axis: { stroke: axisColor },
                                        ticks: { stroke: axisColor },
                                        tickLabels: { fill: axisColor, fontSize: 10, padding: 5, angle: 45, textAnchor: "start" },
                                        axisLabel: { fill: axisColor, fontSize: 12, padding: 30 },
                                    }}
                                />

                                {/* Y Axis */}
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

                                {/* Area(s) */}
                                {yKeys.map((yKey, index) => (
                                    <VictoryArea
                                        key={yKey}
                                        data={sortedData
                                            .map((d) => ({ x: d[xKey], y: d[yKey] }))
                                            .filter((d) => d.y != null)}
                                        style={{
                                            data: {
                                                fill: colours[index] || "blue",
                                                fillOpacity: 0.4,
                                                stroke: colours[index] || "blue",
                                                strokeWidth: 2,
                                            },
                                        }}
                                    />
                                ))}
                            </VictoryChart>
                        )}
                    </View>
                );
            };
          
            return <ChartComponent />;
        },
    },

    scatter: {
        label: "Scatter Plot",
        value: "scatter",
        previewImage: require("../../../../assets/images/scatterPlot.png"),
        render: ({ data, xKey, yKeys, colours, axisColorMode = "light", rounding, numberFormat, axisNumberFormat }) => {
            const ChartComponent = () => {
                const [size, setSize] = React.useState({ width: 0, height: 0 });
                const axisColor = axisColorMode === "dark" ? "white" : "black";
                const sortedData = sortDataByDateKey(data, xKey);
                const yDomain = computeYDomain(sortedData, yKeys);
                const axisFormat = axisNumberFormat ?? numberFormat;
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
                                scale={{ x: "linear", y: "linear" }}
                                domain={yDomain ? { y: yDomain } : undefined}
                                padding={{ top: 10, bottom: 50, left: 60, right: 30 }}
                                containerComponent={<VictoryContainer responsive={false} />}
                            >
                                {/* X Axis */}
                                <VictoryAxis
                                    crossAxis
                                    style={{
                                        axis: { stroke: axisColor },
                                        ticks: { stroke: axisColor },
                                        tickLabels: { fill: axisColor, fontSize: 10, padding: 5, angle: 45, textAnchor: "start" },
                                        axisLabel: { fill: axisColor, fontSize: 12, padding: 30 },
                                    }}
                                />

                                {/* Y Axis */}
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

                                {/* Scatter points */}
                                {yKeys.map((yKey, index) => (
                                    <VictoryScatter
                                        key={yKey}
                                        size={4}
                                        data={sortedData
                                            .map((d) => ({ x: d[xKey], y: d[yKey] }))
                                            .filter((d) => d.y != null)}
                                        style={{
                                            data: { fill: colours[index] || "blue" },
                                        }}
                                    />
                                ))}
                            </VictoryChart>
                        )}
                    </View>
                );
            };
        return <ChartComponent />;
        },
    },

    box: {
        label: "Box Plot",
        value: "box",
        previewImage: require("../../../../assets/images/boxPlot.png"),
        render: ({ data, xKey, yKeys, colours, axisColorMode = "light", boxGrouping = "all", boxTimePeriod = "date", rounding, numberFormat, axisNumberFormat, rawGraphData, boxUseRawData }) => {
            const ChartComponent = () => {
                const [size, setSize] = React.useState({ width: 0, height: 0 });
                const axisColor = axisColorMode === "dark" ? "white" : "black";
                const axisFormat = axisNumberFormat ?? numberFormat;
                const effectiveData = boxUseRawData && rawGraphData ? rawGraphData : data;
                const boxData = getBoxPlotData({ data: effectiveData, xKey, yKeys, boxGrouping, boxTimePeriod });

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
                                    padding={{ top: 10, bottom: 50, left: 60, right: 30 }}
                                    containerComponent={<VictoryContainer responsive={false} />}
                                >
                                    <VictoryAxis
                                        style={{
                                            axis: { stroke: axisColor },
                                            ticks: { stroke: axisColor },
                                            tickLabels: { fill: axisColor, fontSize: 10, padding: 5, angle: 45, textAnchor: "start" },
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
                                padding={{ top: 10, bottom: 50, left: 60, right: 30 }}
                                containerComponent={<VictoryContainer responsive={false} />}
                            >
                                <VictoryAxis
                                    style={{
                                        axis: { stroke: axisColor },
                                        ticks: { stroke: axisColor },
                                        tickLabels: { fill: axisColor, fontSize: 10, padding: 5, angle: 45, textAnchor: "start" },
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
            };

            return <ChartComponent />;
        },
    },

    histogram: {
        label: "Histogram",
        value: "histogram",
        previewImage: require("../../../../assets/images/histogram.png"),
        render: ({ data, xKey, colours, axisColorMode = "light" }) => {
            const ChartComponent = () => {
                const [size, setSize] = React.useState({ width: 0, height: 0 });
                const axisColor = axisColorMode === "dark" ? "white" : "black";
                const histogramData = data
                    .map((d) => ({ x: toDate(d[xKey]) }))
                    .filter((d) => d.x != null);

                // compute explicit equal-width bin boundaries
                //TODO: fix, test with better data
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
                                padding={{ top: 10, bottom: 50, left: 60, right: 30 }}
                                containerComponent={<VictoryContainer responsive={false} />}
                            >
                                <VictoryAxis
                                    tickFormat={(tick) => formatTimestamp(tick)}
                                    style={{
                                        axis: { stroke: axisColor },
                                        ticks: { stroke: axisColor },
                                        tickLabels: { fill: axisColor, fontSize: 10, padding: 5, angle: 45, textAnchor: "start" },
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
            };
            return <ChartComponent />;
        },
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