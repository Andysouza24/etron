import React, { useMemo } from "react";
import { Text } from "react-native-paper";
import DropDown from "../../../../common/input/DropDown";
import { toDropdownItems } from "../../../../../utils/fieldClassifier";

export default function DateSelector({
    fields = [],
    valueSelection,
    onValueSelectionChange,
    selectionTitle,
}) {
    const dropdownItems = useMemo(() => toDropdownItems(fields), [fields]);

    return (
        <>
            <Text variant="labelLarge">{selectionTitle}</Text>
            <DropDown
                title="Date Fields"
                items={dropdownItems}
                showRouterButton={false}
                onSelect={onValueSelectionChange}
                value={valueSelection}
            />
        </>
    );
}
