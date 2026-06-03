import React from "react";
import { View } from "react-native";
import { Text } from "react-native-paper";
import GraphTypes from "./graph-types";

class GraphErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('[GraphPreview] ErrorBoundary caught render error:', error);
        console.error('[GraphPreview] ErrorBoundary componentStack:', errorInfo?.componentStack);
    }

    render() {
        if (this.state.hasError) {
            return (
                <View style={{ padding: 16, alignItems: "center" }}>
                    <Text style={{ color: "red" }}>Graph render error: {this.state.error?.message}</Text>
                </View>
            );
        }
        return this.props.children;
    }
}

export default function GraphPreview({ graphType, data, xKey, yKeys, colours, axisColorMode, maxValue, capPercentAt100, boxGrouping, boxTimePeriod, pieLabelPlacement, rounding, numberFormat, percentRounding, axisNumberFormat, rawGraphData, boxUseRawData, xAxisDateFormat, xAxisChronological, preFormattedXLabels, secondaryDateTicks, thresholds, compactBottom }) {
    const graphDef = GraphTypes[graphType];

    if (!graphDef) {
        return <Text>Please select a graph type to preview</Text>;
    }

    try {
        const rendered = graphDef.render({ data, xKey, yKeys, colours, axisColorMode, maxValue, capPercentAt100, boxGrouping, boxTimePeriod, pieLabelPlacement, rounding, numberFormat, percentRounding, axisNumberFormat, rawGraphData, boxUseRawData, xAxisDateFormat, xAxisChronological, preFormattedXLabels, secondaryDateTicks, thresholds, compactBottom });
        return <GraphErrorBoundary>{rendered}</GraphErrorBoundary>;
    } catch (err) {
        console.error('[GraphPreview] render function threw:', err);
        return <Text style={{ color: "red" }}>Graph error: {err.message}</Text>;
    }
}
