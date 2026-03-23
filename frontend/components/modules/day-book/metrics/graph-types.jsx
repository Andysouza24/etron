import React, { useState } from "react";
import { VictoryContainer, VictoryAxis, VictoryTheme, VictoryChart, VictoryLine, VictoryBar, VictoryPie, VictoryArea, VictoryScatter, VictoryBoxPlot, VictoryHistogram, VictoryLabel } from "victory-native";
import { Text, View } from "react-native";
import Svg from "react-native-svg";
// Registry of available graph types
// Each entry has: `label`, `value`, and a `render` function for later expansion
const resolveAxisColor = (mode = "light") => (mode === "dark" ? "#F4F7FF" : "#1B1B1B");

const resolveGridColor = (mode = "light") => (mode === "dark" ? "rgba(244,247,255,0.24)" : "rgba(27,27,27,0.08)");

const buildDefaultXAxisStyle = (mode = "light") => {
    const axisColor = resolveAxisColor(mode);
    return {
        axis: { stroke: axisColor },
        ticks: { stroke: axisColor },
        tickLabels: {
            fill: axisColor,
            fontSize: 10,
            padding: 5,
            angle: 45,
            textAnchor: "start"
        },
        axisLabel: { fill: axisColor, fontSize: 12, padding: 30 },
        grid: { stroke: resolveGridColor(mode) }
    };
};

const buildDefaultYAxisStyle = (mode = "light") => {
    const axisColor = resolveAxisColor(mode);
    return {
        axis: { stroke: axisColor },
        ticks: { stroke: axisColor },
        tickLabels: { fill: axisColor, fontSize: 10, padding: 5 },
        axisLabel: { fill: axisColor, fontSize: 12, padding: 40 },
        grid: { stroke: resolveGridColor(mode) }
    };
};

const useChartSize = () => {
    const [size, setSize] = useState({ width: 0, height: 0 });

    const handleLayout = (event) => {
        const { width, height } = event.nativeEvent.layout;
        if (width !== size.width || height !== size.height) {
            setSize({ width, height });
        }
    };

    return [size, handleLayout];
};

const normalizeKeys = (keys) => {
    if (Array.isArray(keys)) {
        return keys;
    }
    if (keys === undefined || keys === null) {
        return [];
    }
    return [keys];
};

const buildSeriesData = (data = [], xKey, yKey) =>
    data
        .map((datum) => ({
            x: datum?.[xKey],
            y: datum?.[yKey]
        }))
        .filter((point) => point.x !== undefined && point.y !== undefined);

const DEFAULT_SERIES_COLOUR = "#2979FF";

const mergeAxisStyles = (base, override) => {
    const styleOverride = override?.style || {};
    return {
        axis: { ...base.axis, ...(styleOverride.axis || {}) },
        ticks: { ...base.ticks, ...(styleOverride.ticks || {}) },
        tickLabels: { ...base.tickLabels, ...(styleOverride.tickLabels || {}) },
        axisLabel: { ...base.axisLabel, ...(styleOverride.axisLabel || {}) },
        grid: { ...base.grid, ...(styleOverride.grid || {}) }
    };
};

const buildAxisProps = (baseStyle, options) => {
    const props = {
        style: mergeAxisStyles(baseStyle, options)
    };

    if (options?.tickValues) {
        props.tickValues = options.tickValues;
    }

    if (options?.tickFormat) {
        props.tickFormat = options.tickFormat;
    }

    if (options?.tickCount) {
        props.tickCount = options.tickCount;
    }

    return props;
};

const GraphTypes = {
    line: {
        label: "Line Chart",
        value: "line",
        previewImage: require("../../../../assets/images/lineChart.png"),
        render: ({
            data = [],
            xKey,
            yKeys,
            colours = [],
            axisOptions = {},
            axisColorMode = "dark"
        }) => {
            const ChartComponent = () => {
                const [size, handleLayout] = useChartSize();
                const safeYKeys = normalizeKeys(yKeys);
                const xAxisProps = buildAxisProps(buildDefaultXAxisStyle(axisColorMode), axisOptions?.x);
                const yAxisProps = buildAxisProps(buildDefaultYAxisStyle(axisColorMode), axisOptions?.y);

                return (
                    <View style={{ flex: 1 }} onLayout={handleLayout}>
                        {size.width > 0 && size.height > 0 && (
                            <VictoryChart
                                width={size.width}
                                height={size.height}
                                theme={VictoryTheme.clean}
                                scale={{ x: "linear", y: "linear" }}
                                padding={{ top: 10, bottom: 50, left: 60, right: 30 }}
                                containerComponent={<VictoryContainer responsive={false} />}
                            >
                                <VictoryAxis crossAxis {...xAxisProps} />
                                <VictoryAxis dependentAxis {...yAxisProps} />
                                {safeYKeys.map((yKey, index) => (
                                    <VictoryLine
                                        key={yKey}
                                        data={buildSeriesData(data, xKey, yKey)}
                                        style={{
                                            data: {
                                                stroke: colours[index] || colours[0] || DEFAULT_SERIES_COLOUR
                                            }
                                        }}
                                    />
                                ))}
                            </VictoryChart>
                        )}
                    </View>
                );
            };

            return <ChartComponent />;
        }
    },
    bar: {
        label: "Bar Chart",
        value: "bar",
        previewImage: require("../../../../assets/images/barChart.png"),
        render: ({
            data = [],
            xKey,
            yKeys,
            colours = [],
            axisOptions = {},
            axisColorMode = "dark"
        }) => {
            const ChartComponent = () => {
                const [size, handleLayout] = useChartSize();
                const safeYKeys = normalizeKeys(yKeys);
                const xAxisProps = buildAxisProps(buildDefaultXAxisStyle(axisColorMode), axisOptions?.x);
                const yAxisProps = buildAxisProps(buildDefaultYAxisStyle(axisColorMode), axisOptions?.y);

                return (
                    <View style={{ flex: 1 }} onLayout={handleLayout}>
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
                                <VictoryAxis crossAxis {...xAxisProps} />
                                <VictoryAxis dependentAxis {...yAxisProps} />
                                {safeYKeys.map((yKey, index) => (
                                    <VictoryBar
                                        key={yKey}
                                        data={buildSeriesData(data, xKey, yKey)}
                                        style={{
                                            data: {
                                                fill: colours[index] || colours[0] || DEFAULT_SERIES_COLOUR
                                            }
                                        }}
                                    />
                                ))}
                            </VictoryChart>
                        )}
                    </View>
                );
            };

            return <ChartComponent />;
        }
    },
    pie: {
        label: "Pie Chart",
        value: "pie",
        previewImage: require("../../../../assets/images/pieChart.png"),
        render: ({
            data = [],
            xKey,
            yKeys,
            colours = [],
            axisColorMode = "dark",
            backgroundMode = "transparent"
        }) => {
            const ChartComponent = () => {
                const [size, handleLayout] = useChartSize();
                const axisColor = resolveAxisColor(axisColorMode);
                const safeYKeys = normalizeKeys(yKeys);
                const primaryKey = safeYKeys[0];
                const chartData = primaryKey
                    ? data
                        .map((datum) => ({ x: datum?.[xKey], y: datum?.[primaryKey] }))
                        .filter((point) => point.x !== undefined && point.y !== undefined)
                    : [];

                return (
                    <View
                        style={{ flex: 1, backgroundColor: backgroundMode === "transparent" ? "transparent" : backgroundMode }}
                        onLayout={handleLayout}
                    >
                        {size.width > 0 && size.height > 0 && chartData.length > 0 && (
                            <VictoryPie
                                width={size.width}
                                height={size.height}
                                theme={VictoryTheme.clean}
                                data={chartData}
                                colorScale={colours.length > 0 ? colours : "qualitative"}
                                labels={({ datum }) => `${datum.x}\n${datum.y}`}
                                labelRadius={({ radius }) => radius + 12}
                                labelComponent={
                                    <VictoryLabel
                                        textAnchor="middle"
                                        style={{ fill: axisColor, fontSize: 12 }}
                                        lineHeight={1.2}
                                    />
                                }
                                style={{
                                    labels: {
                                        fontSize: 12,
                                        fill: axisColor,
                                        textAnchor: "middle"
                                    },
                                    parent: {
                                        backgroundColor: "transparent"
                                    }
                                }}
                                padding={{ top: 30, bottom: 40, left: 40, right: 40 }}
                            />
                        )}
                    </View>
                );
            };

            return <ChartComponent />;
        }
    },
    area: {
        label: "Area Chart",
        value: "area",
        previewImage: require("../../../../assets/images/areaChart.png"),
        render: ({
            data = [],
            xKey,
            yKeys,
            colours = [],
            axisOptions = {},
            axisColorMode = "dark"
        }) => {
            const ChartComponent = () => {
                const [size, handleLayout] = useChartSize();
                const safeYKeys = normalizeKeys(yKeys);
                const xAxisProps = buildAxisProps(buildDefaultXAxisStyle(axisColorMode), axisOptions?.x);
                const yAxisProps = buildAxisProps(buildDefaultYAxisStyle(axisColorMode), axisOptions?.y);

                return (
                    <View style={{ flex: 1 }} onLayout={handleLayout}>
                        {size.width > 0 && size.height > 0 && (
                            <VictoryChart
                                width={size.width}
                                height={size.height}
                                theme={VictoryTheme.clean}
                                scale={{ x: "linear", y: "linear" }}
                                padding={{ top: 10, bottom: 50, left: 60, right: 30 }}
                                containerComponent={<VictoryContainer responsive={false} />}
                            >
                                <VictoryAxis crossAxis {...xAxisProps} />
                                <VictoryAxis dependentAxis {...yAxisProps} />
                                {safeYKeys.map((yKey, index) => (
                                    <VictoryArea
                                        key={yKey}
                                        data={buildSeriesData(data, xKey, yKey)}
                                        style={{
                                            data: {
                                                fill: colours[index] || colours[0] || DEFAULT_SERIES_COLOUR,
                                                fillOpacity: 0.35,
                                                stroke: colours[index] || colours[0] || DEFAULT_SERIES_COLOUR,
                                                strokeWidth: 2
                                            }
                                        }}
                                    />
                                ))}
                            </VictoryChart>
                        )}
                    </View>
                );
            };

            return <ChartComponent />;
        }
    },
    scatter: {
        label: "Scatter Plot",
        value: "scatter",
        previewImage: require("../../../../assets/images/scatterPlot.png"),
        render: ({
            data = [],
            xKey,
            yKeys,
            colours = [],
            axisOptions = {},
            axisColorMode = "dark"
        }) => {
            const ChartComponent = () => {
                const [size, handleLayout] = useChartSize();
                const safeYKeys = normalizeKeys(yKeys);
                const xAxisProps = buildAxisProps(buildDefaultXAxisStyle(axisColorMode), axisOptions?.x);
                const yAxisProps = buildAxisProps(buildDefaultYAxisStyle(axisColorMode), axisOptions?.y);

                return (
                    <View style={{ flex: 1 }} onLayout={handleLayout}>
                        {size.width > 0 && size.height > 0 && (
                            <VictoryChart
                                width={size.width}
                                height={size.height}
                                theme={VictoryTheme.clean}
                                scale={{ x: "linear", y: "linear" }}
                                padding={{ top: 10, bottom: 50, left: 60, right: 30 }}
                                containerComponent={<VictoryContainer responsive={false} />}
                            >
                                <VictoryAxis crossAxis {...xAxisProps} />
                                <VictoryAxis dependentAxis {...yAxisProps} />
                                {safeYKeys.map((yKey, index) => (
                                    <VictoryScatter
                                        key={yKey}
                                        data={buildSeriesData(data, xKey, yKey)}
                                        size={4}
                                        style={{
                                            data: {
                                                fill: colours[index] || colours[0] || DEFAULT_SERIES_COLOUR
                                            }
                                        }}
                                    />
                                ))}
                            </VictoryChart>
                        )}
                    </View>
                );
            };

            return <ChartComponent />;
        }
    },
    box: {
        label: "Box Plot",
        value: "box",
        previewImage: require("../../../../assets/images/boxPlot.png"),
        render: ({
            data = [],
            xKey,
            yKeys,
            colours = [],
            axisOptions = {},
            axisColorMode = "dark"
        }) => {
            const ChartComponent = () => {
                const [size, handleLayout] = useChartSize();
                const safeYKeys = normalizeKeys(yKeys);
                const primaryKey = safeYKeys[0];
                const xAxisProps = buildAxisProps(buildDefaultXAxisStyle(axisColorMode), axisOptions?.x);
                const yAxisProps = buildAxisProps(buildDefaultYAxisStyle(axisColorMode), axisOptions?.y);

                if (!primaryKey) {
                    return (
                        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                            <Text>No metric selected</Text>
                        </View>
                    );
                }

                const boxData = data
                    .map((datum) => ({ x: datum?.[xKey], y: datum?.[primaryKey] }))
                    .filter((point) => point.x !== undefined && point.y !== undefined);

                return (
                    <View style={{ flex: 1 }} onLayout={handleLayout}>
                        {size.width > 0 && size.height > 0 && boxData.length > 0 && (
                            <VictoryChart
                                width={size.width}
                                height={size.height}
                                theme={VictoryTheme.clean}
                                domainPadding={20}
                                scale={{ x: "linear", y: "linear" }}
                                padding={{ top: 10, bottom: 50, left: 40, right: 30 }}
                                containerComponent={<VictoryContainer responsive={false} />}
                            >
                                <VictoryAxis {...xAxisProps} />
                                <VictoryAxis dependentAxis {...yAxisProps} />
                                <VictoryBoxPlot
                                    data={boxData}
                                    style={{
                                        min: { stroke: colours[0] || DEFAULT_SERIES_COLOUR },
                                        max: { stroke: colours[0] || DEFAULT_SERIES_COLOUR },
                                        q1: {
                                            fill: colours[0] || DEFAULT_SERIES_COLOUR,
                                            fillOpacity: 0.3
                                        },
                                        q3: {
                                            fill: colours[0] || DEFAULT_SERIES_COLOUR,
                                            fillOpacity: 0.3
                                        },
                                        median: {
                                            stroke: colours[0] || DEFAULT_SERIES_COLOUR,
                                            strokeWidth: 2
                                        }
                                    }}
                                />
                            </VictoryChart>
                        )}
                    </View>
                );
            };

            return <ChartComponent />;
        }
    },
    histogram: {
        label: "Histogram",
        value: "histogram",
        previewImage: require("../../../../assets/images/histogram.png"),
        render: ({
            data = [],
            xKey,
            colours = [],
            axisOptions = {},
            axisColorMode = "dark"
        }) => {
            const ChartComponent = () => {
                const [size, handleLayout] = useChartSize();
                const xAxisProps = buildAxisProps(buildDefaultXAxisStyle(axisColorMode), axisOptions?.x);
                const yAxisProps = buildAxisProps(buildDefaultYAxisStyle(axisColorMode), axisOptions?.y);
                const histogramData = data
                    .map((datum) => ({ x: datum?.[xKey] }))
                    .filter((point) => point.x !== undefined && point.x !== null);

                return (
                    <View style={{ flex: 1 }} onLayout={handleLayout}>
                        {size.width > 0 && size.height > 0 && histogramData.length > 0 && (
                            <VictoryChart
                                width={size.width}
                                height={size.height}
                                theme={VictoryTheme.clean}
                                domainPadding={20}
                                padding={{ top: 10, bottom: 50, left: 60, right: 30 }}
                                containerComponent={<VictoryContainer responsive={false} />}
                            >
                                <VictoryAxis {...xAxisProps} />
                                <VictoryAxis dependentAxis {...yAxisProps} />
                                <VictoryHistogram
                                    data={histogramData}
                                    bins={5}
                                    style={{
                                        data: {
                                            fill: colours[0] || DEFAULT_SERIES_COLOUR,
                                            stroke: resolveAxisColor(axisColorMode),
                                            strokeWidth: 1
                                        }
                                    }}
                                />
                            </VictoryChart>
                        )}
                    </View>
                );
            };

            return <ChartComponent />;
        }
    },
    progressBar: {
        label: "Progress Bar",
        value: "progressBar",
        previewImage: require("../../../../assets/images/progressCircle.png"),
        render: ({ data = [], yKeys = [], colours = [], axisColorMode = "dark" }) => {
            const ChartComponent = () => {
                const [size, handleLayout] = useChartSize();
                const primaryKey = normalizeKeys(yKeys)[0];
                const axisColor = resolveAxisColor(axisColorMode);
                const progressValue = primaryKey && data.length > 0 ? data[0]?.[primaryKey] ?? 0 : 0;
                const maxValue = 100;

                return (
                    <View style={{ flex: 1 }} onLayout={handleLayout}>
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
                                        tickLabels: { fill: axisColor, fontSize: 10, padding: 5 }
                                    }}
                                />
                                <VictoryBar
                                    horizontal
                                    barWidth={Math.max(size.height / 2, 12)}
                                    data={[{ x: progressValue, y: 1 }]}
                                    style={{
                                        data: {
                                            fill: colours[0] || DEFAULT_SERIES_COLOUR
                                        }
                                    }}
                                />
                            </VictoryChart>
                        )}
                    </View>
                );
            };

            return <ChartComponent />;
        }
    },
    progressCircle: {
        label: "Progress Circle",
        value: "progressCircle",
        previewImage: require("../../../../assets/images/progressCircle.png"),
        render: ({ data = [], yKeys = [], colours = [], axisColorMode = "dark" }) => {
            const ChartComponent = () => {
                const [size, handleLayout] = useChartSize();
                const axisColor = resolveAxisColor(axisColorMode);
                const primaryKey = normalizeKeys(yKeys)[0];
                const progressValue = primaryKey && data.length > 0 ? data[0]?.[primaryKey] ?? 0 : 0;
                const percent = Math.min(Math.max(progressValue, 0), 100);
                const chartData = [
                    { x: 1, y: percent },
                    { x: 2, y: 100 - percent }
                ];

                return (
                    <View style={{ flex: 1 }} onLayout={handleLayout}>
                        {size.width > 0 && size.height > 0 && (
                            <Svg viewBox={`0 0 ${size.width} ${size.height}`} width="100%" height="100%">
                                <VictoryPie
                                    standalone={false}
                                    width={size.width}
                                    height={size.height}
                                    data={chartData}
                                    innerRadius={size.width / 4}
                                    cornerRadius={size.width / 20}
                                    labels={() => null}
                                    style={{
                                        data: {
                                            fill: ({ datum }) =>
                                                datum.x === 1
                                                    ? colours[0] || DEFAULT_SERIES_COLOUR
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
        }
    },
    numbers: {
        label: "Numbers",
        value: "numbers",
        previewImage: require("../../../../assets/images/numbers.png"),
        render: ({ data = [], yKeys = [], colours = [], axisColorMode = "dark" }) => {
            const ChartComponent = () => {
                const axisColor = resolveAxisColor(axisColorMode);
                const safeYKeys = normalizeKeys(yKeys);

                if (data.length === 0 || safeYKeys.length === 0) {
                    return (
                        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                            <Text style={{ color: axisColor }}>No data available</Text>
                        </View>
                    );
                }

                const firstRow = data[0] || {};

                return (
                    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                        {safeYKeys.map((yKey, index) => (
                            <Text
                                key={yKey}
                                style={{
                                    fontSize: 18,
                                    fontWeight: "bold",
                                    color: colours[index] || axisColor,
                                    marginVertical: 4
                                }}
                            >
                                {yKey}: {firstRow?.[yKey] ?? "—"}
                            </Text>
                        ))}
                    </View>
                );
            };

            return <ChartComponent />;
        }
    }
};

export default GraphTypes;
