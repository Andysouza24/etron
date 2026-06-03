import React, { useMemo } from "react";
import GenericSelector from "./GenericSelector";
import { toDropdownItems } from "../../../../../utils/fieldClassifier";

export default function DimensionSelector({
    fields = [],
    selectedDimension,
    onDimensionSelect,
}) {
    const dropdownItems = useMemo(() => toDropdownItems(fields), [fields]);

    return (
        <GenericSelector
            wrapInView
            label="Select Dimension"
            title="Dimension Fields"
            items={dropdownItems}
            value={selectedDimension}
            onChange={onDimensionSelect}
        />
    );
}
