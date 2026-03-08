import React from "react";
import ValueSelector from "./ValueSelector";

const DATE_KEYWORDS = ["date", "time", "day", "month", "year", "week", "period", "timestamp"];

export default function DateSelector({
    variableNames,
    valueSelection,
    onValueSelectionChange,
    selectionTitle,
}) {
    return (
        <ValueSelector
            variableNames={variableNames}
            valueSelection={valueSelection}
            onValueSelectionChange={onValueSelectionChange}
            selectionTitle={selectionTitle}
            filterKeywords={DATE_KEYWORDS}
            suggestedLabel="Suggested"
            dropdownTitle="All Variables"
        />
    );
}
