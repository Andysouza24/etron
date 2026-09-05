import React, { useState } from "react";
import { View } from "react-native";
import { Chip, IconButton, Text, useTheme } from "react-native-paper";
import MetricCheckbox from "../../../../common/buttons/MetricCheckbox";
import { simpleStyles } from "../../../../../assets/styles/stylesheets/day-book/modules/metrics/simpleMetric";

export default function RowSelector({ data, idKey, selectedRows, onSelectedRowsChange }) {
    const theme = useTheme();
    const [showChecklist, setShowChecklist] = useState(false);

    const rowIds = data.map((row) => row[idKey]);
    const allSelected = selectedRows.length === rowIds.length && rowIds.length > 0;

    const handleToggleAll = () => {
        onSelectedRowsChange(allSelected ? [] : rowIds);
    };

    return (
        <>
            <View style={simpleStyles.rowSelectorHeader}>
                <Text>Select Data Points (Optional)</Text>
                <Chip
                    mode="outlined"
                    onPress={handleToggleAll}
                    textStyle={{ color: theme.colors.primary }}
                    accessibilityLabel={allSelected ? "Deselect all data points" : "Select all data points"}
                >
                    {allSelected ? "Deselect All" : "Select All"}
                </Chip>
                <IconButton
                    icon={showChecklist ? "chevron-up" : "chevron-down"}
                    size={20}
                    onPress={() => setShowChecklist(!showChecklist)}
                />
            </View>

            {showChecklist && (
                <MetricCheckbox
                    items={rowIds}
                    selected={selectedRows}
                    onChange={onSelectedRowsChange}
                />
            )}
        </>
    );
}
