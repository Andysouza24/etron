import React, { useState } from "react";
import { VictoryContainer, VictoryAxis, VictoryTheme, VictoryChart, VictoryLine, VictoryBar, VictoryPie, VictoryArea, VictoryScatter, VictoryBoxPlot, VictoryHistogram } from "victory-native";
import { Text, View } from "react-native";


function formatTickValue(t) {
    const abs = Math.abs(t);
    if (abs >= 1e6) return `${(t / 1e6).toFixed(1)}M`;
    if (abs >= 1e3) return `${(t / 1e3).toFixed(0)}K`;
    return t;
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
                y: d[yKey], // value
            }));

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
                            labels={({ datum }) => `${datum.x}\n${datum.y}`} // value on new line
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
        render: ({ data, xKey, yKeys, colours, axisColorMode = "light" }) => {
            const ChartComponent = () => {
              const [size, setSize] = React.useState({ width: 0, height: 0 });
              const yKey = Array.isArray(yKeys) ? yKeys[0] : yKeys; // boxplot usually uses a single dependent variable
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
                            domainPadding={20}
                            scale={{ x: "linear", y: "linear" }}
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
                                data={data.map((d) => ({
                                    x: d[xKey],
                                    y: d[yKey],
                                }))}
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
                                    tickFormat={formatTickValue}
                                    style={{
                                        axis: { stroke: axisColor },
                                        ticks: { stroke: axisColor },
                                        tickLabels: { fill: axisColor, fontSize: 10, padding: 5 },
                                        axisLabel: { fill: axisColor, fontSize: 12, padding: 40 },
                                    }}
                                />

                                <VictoryHistogram
                                    data={data.map((d) => ({
                                        x: d[xKey],
                                    }))}
                                    bins={5}
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


    progress: {
    label: "Progress Bar",
    value: "progress",
        previewImage: require("../../../../assets/images/progressCircle.png"),
    render: ({ data, yKeys, colours, axisColorMode = "light" }) => {
        const ChartComponent = () => {
            const [size, setSize] = React.useState({ width: 0, height: 0 });
            const axisColor = axisColorMode === "dark" ? "white" : "black";
            // Assume single value in data[0][yKeys[0]] for progress
            const progressValue = data.length > 0 ? data[0][yKeys[0]] : 0;
            const maxValue = 100; // adjust if dynamic range is needed

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
                            domain={{ x: [0, maxValue], y: [0, 1] }}
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

progress: {
    label: "Progress Circle",
    value: "progress",
        previewImage: require("../../../../assets/images/progressCircle.png"),
    render: ({ data, yKeys, colours, axisColorMode = "light" }) => {
        const ChartComponent = () => {
            const [size, setSize] = React.useState({ width: 0, height: 0 });
            const axisColor = axisColorMode === "dark" ? "white" : "black";
            // take first yKey value from first row of data
            const progressValue = data.length > 0 && yKeys.length > 0 ? data[0][yKeys[0]] : 0;
            const percent = Math.min(Math.max(progressValue, 0), 100); // clamp 0–100

            const chartData = [
                { x: 1, y: percent },
                { x: 2, y: 100 - percent }
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
                        <Svg viewBox={`0 0 ${size.width} ${size.height}`} width="100%" height="100%">
                            <VictoryPie
                                standalone={false}
                                width={size.width}
                                height={size.height}
                                data={chartData}
                                innerRadius={size.width / 4} // makes it a donut
                                cornerRadius={size.width / 20}
                                labels={() => null}
                                style={{
                                    data: {
                                        fill: ({ datum }) =>
                                            datum.x === 1
                                                ? (colours[0] || "#4caf50")
                                                : "transparent"
                                    }
                                }}
                            />
                            <VictoryLabel
                                textAnchor="middle"
                                verticalAnchor="middle"
                                x={size.width / 2}
                                y={size.height / 2}
                                text={`${Math.round(percent)}%`}
                                style={{ fontSize: 24, fill: axisColor }}
                            />
                        </Svg>
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