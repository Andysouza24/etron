import React from "react";
import { Text } from "react-native-paper";
import GraphTypes from "./graph-types";

export default function GraphPreview({ graphType, data, xKey, yKeys, colours, axisColorMode }) {
    const graphDef = GraphTypes[graphType];
    console.log("data: ", data);
    console.log("yKeys: ", yKeys);

    if (!graphDef) {
        return <Text>Please select a graph type to preview</Text>;
    }

    return graphDef.render({ data, xKey, yKeys, colours, axisColorMode });
}
