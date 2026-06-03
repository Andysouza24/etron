import React, { useMemo } from "react";
import GenericSelector from "./GenericSelector";
import { toDropdownItems } from "../../../../../utils/fieldClassifier";

export default function DateSelector({
    fields = [],
    valueSelection,
    onValueSelectionChange,
    selectionTitle,
}) {
    const dropdownItems = useMemo(() => toDropdownItems(fields), [fields]);

    return (
        <GenericSelector
            label={selectionTitle}
            title="Date Fields"
            items={dropdownItems}
            value={valueSelection}
            onChange={onValueSelectionChange}
        />
    );
}
