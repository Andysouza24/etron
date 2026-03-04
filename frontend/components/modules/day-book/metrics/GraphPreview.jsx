import React from "react";
import { Text } from "react-native-paper";
import GraphTypes from "../../../../app/(auth)/(drawer)/modules/day-book/metrics/graph-types";

export default function GraphPreview({ graphType, data, xKey, yKeys, colours, axisColorMode }) {
    const graphDef = GraphTypes[graphType];

    if (!graphDef) {
        return <Text>Please select a graph type to preview</Text>;
    }

    return graphDef.render({ data, xKey, yKeys, colours, axisColorMode });
}
