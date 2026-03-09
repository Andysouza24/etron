import React, { useMemo } from "react";
import { View } from "react-native";
import { Text } from "react-native-paper";
import DropDown from "../../../common/input/DropDown";
import { toDropdownItems } from "../../../../utils/fieldClassifier";

export default function DimensionSelector({
    fields = [],
    selectedDimension,
    onDimensionSelect,
}) {
    const dropdownItems = useMemo(() => toDropdownItems(fields), [fields]);

    return (
        <View>
            <Text variant="labelLarge">Select Dimension</Text>
            <DropDown
                title="Dimension Fields"
                items={dropdownItems}
                showRouterButton={false}
                onSelect={onDimensionSelect}
                value={selectedDimension}
            />
        </View>
    );
}
