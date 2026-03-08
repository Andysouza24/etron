import React, { useMemo } from "react";
import { Text, useTheme } from "react-native-paper";
import DropDown from "../../../common/input/DropDown";
import MetricRadioButton from "../../../common/buttons/MetricRadioButton";

export default function ValueSelector({
    variableNames,
    valueSelection,
    onValueSelectionChange,
    selectionTitle,
    filterKeywords,
    suggestedLabel = "Suggested",
    dropdownTitle = "All Variables",
}) {
    const theme = useTheme();

    const dropdownItems = useMemo(
        () => variableNames.map((name) => ({ value: name, label: name })),
        [variableNames]
    );

    const filteredVariables = useMemo(() => {
        if (!filterKeywords || filterKeywords.length === 0) return [];
        return variableNames.filter((name) =>
            filterKeywords.some((kw) => name.toLowerCase().includes(kw.toLowerCase()))
        );
    }, [variableNames, filterKeywords]);

    const showRadioButtons = filteredVariables.length > 0;

    return (
        <>
            <Text variant="labelLarge">{selectionTitle}</Text>
            <DropDown
                title={dropdownTitle}
                items={dropdownItems}
                showRouterButton={false}
                onSelect={onValueSelectionChange}
                value={valueSelection}
            />
            {showRadioButtons && (
                <>
                    <Text style={{ color: theme.colors.primary, fontStyle: 'italic', marginTop: 8 }}>
                        {suggestedLabel}
                    </Text>
                    <MetricRadioButton
                        items={filteredVariables}
                        selected={valueSelection}
                        onChange={onValueSelectionChange}
                    />
                </>
            )}
        </>
    );
}
