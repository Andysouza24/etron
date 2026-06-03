import React from "react";
import GenericSelector from "./GenericSelector";

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
        <GenericSelector
            label="Data Aggregation"
            labelVariant="labelMedium"
            title="Aggregation"
            items={AGGREGATION_ITEMS}
            value={selectedAggregation}
            onChange={onAggregationSelect}
        />
    );
}
