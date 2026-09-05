import React, { useMemo } from "react";
import GenericSelector from "./GenericSelector";
import { toDropdownItems } from "../../../../../utils/fieldClassifier";

export default function ValueSelector({
    fields = [],
    valueSelection,
    onValueSelectionChange,
    selectionTitle,
}) {
    const dropdownItems = useMemo(() => toDropdownItems(fields), [fields]);

    return (
        <GenericSelector
            label={selectionTitle}
            title="Value Fields"
            items={dropdownItems}
            value={valueSelection}
            onChange={onValueSelectionChange}
        />
    );
}
