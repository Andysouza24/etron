import React from "react";
import { Text } from "react-native-paper";
import DropDown from "../../../../common/input/DropDown";
import MetricCheckbox from "../../../../common/buttons/MetricCheckbox";
import MetricRadioButton from "../../../../common/buttons/MetricRadioButton";
import GraphTypes from "../graph-types";

export default function VariableSelector({
    variableNames,
    selectedMetric,
    onSelectMetric,
    independentVariable,
    onIndependentChange,
    dependentVariables,
    onDependentChange,
}) {
    const singleSelectGraphs = ["bar", "pie"];
    const isSingleSelect = singleSelectGraphs.includes(selectedMetric);

    return (
        <>
            <DropDown
                title="Select Metric"
                items={Object.values(GraphTypes).map((g) => ({
                    value: g.value,
                    label: g.label,
                }))}
                showRouterButton={false}
                onSelect={onSelectMetric}
                value={selectedMetric}
            />

            <Text>Select Independent Variable (X-Axis)</Text>
            <MetricRadioButton
                items={variableNames}
                selected={independentVariable}
                onChange={onIndependentChange}
            />

            <Text style={{ marginTop: 12 }}>Select Dependent Variables (Y-Axis)</Text>
            {isSingleSelect ? (
                <MetricRadioButton
                    items={variableNames}
                    selected={
                        Array.isArray(dependentVariables)
                            ? dependentVariables[0]
                            : dependentVariables
                    }
                    onChange={(selection) =>
                        onDependentChange(selection ? [selection] : [])
                    }
                />
            ) : (
                <MetricCheckbox
                    items={variableNames}
                    selected={
                        Array.isArray(dependentVariables) ? dependentVariables : []
                    }
                    onChange={(selection) =>
                        onDependentChange(
                            Array.isArray(selection)
                                ? selection
                                : selection
                                ? [selection]
                                : []
                        )
                    }
                />
            )}
        </>
    );
}
