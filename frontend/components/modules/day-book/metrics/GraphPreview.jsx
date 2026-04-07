import React from "react";
import { Text } from "react-native-paper";
import GraphTypes from "./graph-types";

export default function GraphPreview({ graphType, data, xKey, yKeys, colours, axisColorMode, maxValue, capPercentAt100, boxGrouping, boxTimePeriod, pieLabelPlacement, rounding, numberFormat, percentRounding, axisNumberFormat, rawGraphData, boxUseRawData }) {
    const graphDef = GraphTypes[graphType];

    if (!graphDef) {
        return <Text>Please select a graph type to preview</Text>;
    }

    return graphDef.render({ data, xKey, yKeys, colours, axisColorMode, maxValue, capPercentAt100, boxGrouping, boxTimePeriod, pieLabelPlacement, rounding, numberFormat, percentRounding, axisNumberFormat, rawGraphData, boxUseRawData });
}
