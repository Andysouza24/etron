import React, { useState } from "react";
import { VictoryContainer, VictoryAxis, VictoryTheme, VictoryChart, VictoryLine, VictoryBar, VictoryPie, VictoryArea, VictoryScatter, VictoryBoxPlot, VictoryHistogram } from "victory-native";
import { Text, View } from "react-native";


function formatTickValue(t) {
    if (typeof t === "string") return t;
    const abs = Math.abs(t);
    if (abs >= 1e6) return `${(t / 1e6).toFixed(1)}M`;
    if (abs >= 1e3) return `${(t / 1e3).toFixed(0)}K`;
    return t;
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

function toDate(value) {
    if (value == null) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function getTimePeriodLabel(date, timePeriod) {
    const year = date.getFullYear();
    if (timePeriod === "year") return `${year}`;
    if (timePeriod === "quarter") return `Q${Math.floor(date.getMonth() / 3) + 1} ${year}`;
    return date.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

function getBoxPlotData({ data, xKey, yKeys, boxGrouping = "yKey", boxTimePeriod = "month" }) {
    const safeYKeys = Array.isArray(yKeys) ? yKeys : yKeys ? [yKeys] : [];

    if (boxGrouping === "xValue") {
        const grouped = new Map();
        data.forEach((row) => {
            const label = row?.[xKey];
            if (label == null) return;
            if (!grouped.has(label)) grouped.set(label, []);
            safeYKeys.forEach((yKey) => {
                const num = parseNumericValue(row?.[yKey]);
                if (num != null) grouped.get(label).push(num);
            });
        });
        return [...grouped.entries()]
            .filter(([, values]) => values.length > 0)
            .map(([label, values]) => ({ x: String(label), y: values }));
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
            .map(([label, values]) => ({ x: label, y: values }));
    }

    return safeYKeys
        .map((yKey) => ({
            x: yKey,
            y: data
                .map((row) => parseNumericValue(row?.[yKey]))
                .filter((num) => num != null),
        }))
        .filter((entry) => entry.y.length > 0);
}


// Registry of available graph types
// Each entry has: `label`, `value`, and a `render` function for later expansion
const GraphTypes = {
    line: {
        label: "Line Chart",
        value: "line",
        previewImage: require("../../../../assets/images/lineChart.png"),
        render: ({ data, xKey, yKeys, colours, axisColorMode = "light" }) => {
            const ChartComponent = () => {
                const [size, setSize] = useState({ width: 0, height: 0 });
                const axisColor = axisColorMode === "dark" ? "white" : "black";
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
                                    tickFormat={formatTickValue}
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
                                        data={data.map((d) => ({
                                            x: d[xKey],
                                            y: d[yKey],
                                        }))}
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
        render: ({ data, xKey, yKeys, colours, axisColorMode = "light" }) => {
            const ChartComponent = () => {
                const [size, setSize] = useState({ width: 0, height: 0 });
                const axisColor = axisColorMode === "dark" ? "white" : "black";
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
                                    tickFormat={formatTickValue}
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
                                        data={data.map((d) => ({
                                            x: d[xKey],
                                            y: d[yKey],
                                        }))}
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
    render: ({ data, xKey, yKeys, colours, axisColorMode = "light", backgroundMode = "transparent" }) => {
        const ChartComponent = () => {
            const [size, setSize] = React.useState({ width: 0, height: 0 });
            const axisColor = axisColorMode === "dark" ? "white" : "black";
            const yKey = Array.isArray(yKeys) ? yKeys[0] : yKeys;

            const chartData = data.map((d) => ({
                x: d[xKey], // label
                y: parseNumericValue(d[yKey]), // value
            })).filter((d) => d.y != null);

            return (
                <View
                    style={{ flex: 1, backgroundColor: backgroundMode === "transparent" ? "transparent" : backgroundMode }}
                    onLayout={(event) => {
                        const { width, height } = event.nativeEvent.layout;
                        setSize({ width, height });
                    }}
                >
                    {size.width > 0 && size.height > 0 && (
                        <VictoryPie
                            width={size.width}
                            height={size.height}
                            theme={VictoryTheme.clean}
                            data={chartData}
                            colorScale={colours && colours.length > 0 ? colours : "qualitative"}
                            labels={({ datum }) => `${formatTimestamp(datum.x)}\n${formatTickValue(datum.y)}`} // value on new line
                            style={{
                                labels: {
                                    fontSize: 12,
                                    fill: axisColor,
                                    textAnchor: "middle",
                                },
                                parent: {
                                    backgroundColor: "transparent", // ensures pie chart itself has no white background
                                },
                            }}
                            padding={{ top: 30, bottom: 40, left: 40, right: 40 }}
                        />
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
        render: ({ data, xKey, yKeys, colours, axisColorMode = "light" }) => {
            const ChartComponent = () => {
                const [size, setSize] = React.useState({ width: 0, height: 0 });
                const axisColor = axisColorMode === "dark" ? "white" : "black";
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
                                    tickFormat={formatTickValue}
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
                                        data={data.map((d) => ({
                                            x: d[xKey],
                                            y: d[yKey],
                                        }))}
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
        render: ({ data, xKey, yKeys, colours, axisColorMode = "light" }) => {
            const ChartComponent = () => {
                const [size, setSize] = React.useState({ width: 0, height: 0 });
                const axisColor = axisColorMode === "dark" ? "white" : "black";
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
                                    tickFormat={formatTickValue}
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
                                        data={data.map((d) => ({
                                            x: d[xKey],
                                            y: d[yKey],
                                        }))}
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
                render: ({ data, xKey, yKeys, colours, axisColorMode = "light", boxGrouping = "yKey", boxTimePeriod = "month" }) => {
            const ChartComponent = () => {
              const [size, setSize] = React.useState({ width: 0, height: 0 });
                const axisColor = axisColorMode === "dark" ? "white" : "black";
                                const boxData = getBoxPlotData({ data, xKey, yKeys, boxGrouping, boxTimePeriod });
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
                            {/* X Axis */}
                            <VictoryAxis
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
                                tickFormat={formatTickValue}
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

    //NEEDS TO BE FIXED
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
                                    bins={8}
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
    render: ({ data, yKeys, colours, axisColorMode = "light", maxValue = 100 }) => {
        const ChartComponent = () => {
            const [size, setSize] = React.useState({ width: 0, height: 0 });
            const axisColor = axisColorMode === "dark" ? "white" : "black";
            // Assume single value in data[0][yKeys[0]] for progress
            const yKey = Array.isArray(yKeys) ? yKeys[0] : yKeys;
            const progressValue = data.length > 0 ? (parseNumericValue(data[0][yKey]) ?? 0) : 0;
            const safeMaxValue = Number(maxValue) > 0 ? Number(maxValue) : 100;

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
                            domain={{ x: [0, safeMaxValue], y: [0, 1] }}
                            padding={{ top: 20, bottom: 20, left: 40, right: 20 }}
                            containerComponent={<VictoryContainer responsive={false} />}
                        >
                            <VictoryAxis
                                style={{
                                    axis: { stroke: axisColor },
                                    ticks: { stroke: axisColor },
                                    tickLabels: { fill: axisColor, fontSize: 10, padding: 5 },
                                }}
                            />
                            {/* No dependent axis needed (progress is just a bar) */}

                            <VictoryBar
                                horizontal
                                barWidth={size.height / 2}
                                data={[{ x: progressValue, y: 1 }]}
                                style={{
                                    data: {
                                        fill: colours[0] || "#4caf50",
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

progressCircle: {
    label: "Progress Circle",
    value: "progressCircle",
        previewImage: require("../../../../assets/images/progressCircle.png"),
    render: ({ data, yKeys, colours, axisColorMode = "light", maxValue = 100 }) => {
        const ChartComponent = () => {
            const [size, setSize] = React.useState({ width: 0, height: 0 });
            const axisColor = axisColorMode === "dark" ? "white" : "black";
            // take first yKey value from first row of data
            const yKey = Array.isArray(yKeys) ? yKeys[0] : yKeys;
            const progressValue = data.length > 0 && yKey ? (parseNumericValue(data[0][yKey]) ?? 0) : 0;
            const safeMaxValue = Number(maxValue) > 0 ? Number(maxValue) : 100;
            const percent = Math.min(Math.max((progressValue / safeMaxValue) * 100, 0), 100); // clamp 0-100

            const chartData = [
                { x: "Complete", y: percent },
                { x: "Remaining", y: 100 - percent }
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
                                    {Math.round(percent)}%
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
    render: ({ data, yKeys, colours, axisColorMode = "light" }) => {
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
                            {yKey}: {firstRow[yKey]}
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