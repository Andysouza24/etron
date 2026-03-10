import React from "react";
import { Text } from "react-native-paper";
import DropDown from "../../../../common/input/DropDown";

// TODO: add to utils/constants
const AGGREGATION_ITEMS = [
    { value: "sum", label: "Sum" },
    { value: "avg", label: "Average" },
    { value: "min", label: "Minimum" },
    { value: "max", label: "Maximum" },
    { value: "count", label: "Count" },
];

// TODO: update drop down UI, slimmer
export default function AggregationDropDown({
    onAggregationSelect,
    selectedAggregation = AGGREGATION_ITEMS[0].value, // default to sum
}) {
    return (
        <>
            <Text variant="labelMedium">Data Aggregation</Text>
            <DropDown
                title="Aggregation"
                items={AGGREGATION_ITEMS}
                showRouterButton={false}
                onSelect={onAggregationSelect}
                value={selectedAggregation}
            />
        </>
    );
} 