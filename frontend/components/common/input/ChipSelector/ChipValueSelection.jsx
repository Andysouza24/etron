import { useState, useMemo } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Chip, Icon, useTheme } from "react-native-paper";
import ChipDropDown from "./ChipDropDown";

const ChipValueSelection = ({
    title = "Select a value",
    items = [],
    valueSelections = [],
    onValueSelectionChange,
}) => {
    const theme = useTheme();
    const [picking, setPicking] = useState(false);

    const availableItems = useMemo(
        () => items.filter((i) => !valueSelections.includes(i.value)),
        [items, valueSelections]
    );

    const selectedItems = useMemo(
        () =>
            valueSelections
                .map((v) => items.find((i) => i.value === v))
                .filter(Boolean),
        [items, valueSelections]
    );

    const emitChange = (next) => {
        if (onValueSelectionChange) onValueSelectionChange(next);
    };

    const handleRemove = (value) => {
        emitChange(valueSelections.filter((v) => v !== value));
    };

    const handleAdd = (value) => {
        setPicking(false);
        if (valueSelections.includes(value)) return;
        emitChange([...valueSelections, value]);
    };

    const openPicker = () => setPicking(true);

    if (valueSelections.length === 0) {
        return (
            <ChipDropDown
                title={title}
                items={availableItems}
                onSelect={handleAdd}
                clearOnSelect
            />
        );
    }

    return (
        <View style={styles.container}>
            {selectedItems.map((item) => (
                <Chip
                    key={`${item.value}`}
                    mode="flat"
                    onClose={() => handleRemove(item.value)}
                    accessibilityLabel={item.label}
                    style={styles.chip}
                >
                    {item.label}
                </Chip>
            ))}

            {picking && availableItems.length > 0 ? (
                <ChipDropDown
                    title={title}
                    items={availableItems}
                    onSelect={handleAdd}
                    clearOnSelect
                />
            ) : (
                availableItems.length > 0 && (
                    <Pressable
                        onPress={openPicker}
                        accessibilityLabel={`Add ${title}`}
                        accessibilityRole="button"
                        style={styles.addButton}
                    >
                        <Icon
                            source="plus-circle-outline"
                            size={20}
                            color={theme.colors.primary}
                        />
                    </Pressable>
                )
            )}
        </View>
    );
};

export default ChipValueSelection;

const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 8,
    },
    chip: {
        alignSelf: "center",
    },
    addButton: {
        width: 32,
        height: 32,
        alignItems: "center",
        justifyContent: "center",
        alignSelf: "center",
    },
});