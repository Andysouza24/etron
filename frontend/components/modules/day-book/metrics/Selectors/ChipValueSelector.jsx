import { useMemo } from "react";
import { toDropdownItems } from "../../../../../utils/fieldClassifier";
import ChipValueSelection from "../../../../common/input/ChipSelector/ChipValueSelection";

export default function ChipValueSelector({
    fields = [],
    valueSelections = [],
    onValueSelectionChange,
    selectionTitle,
}) {
    const dropdownItems = useMemo(() => toDropdownItems(fields), [fields]);

    return (
        <ChipValueSelection
            title={selectionTitle}
            items={dropdownItems}
            valueSelections={valueSelections}
            onValueSelectionChange={onValueSelectionChange}
        />
    );
}