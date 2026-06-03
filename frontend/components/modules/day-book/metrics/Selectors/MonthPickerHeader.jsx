// Button-style trigger that opens a picker for jumping the date window to
// any month in the dataset's range.
//
// Presentational. The parent owns the month list and the jump semantics:
// it builds `months` (each `{ key, label }`) and reacts to `onChange(key)`
// however it wants (e.g. set the window end to the last day of that month).
//
// Tapping the button opens a centered overlay that lays every month out
// directly as tappable rows — no dropdown, no confirm step. Picking a row
// closes the overlay and immediately fires `onChange`.

import React from "react";
import { StyleSheet, View } from "react-native";
import { Button, Modal, Portal, Text, TouchableRipple, useTheme } from "react-native-paper";

const MonthPickerHeader = ({
    label,
    months,
    selectedKey,
    onChange,
    disabled = false,
    readOnly = false,
    accessibilityLabel = "Open month picker",
}) => {
    const theme = useTheme();
    const [open, setOpen] = React.useState(false);

    const hasOptions = Array.isArray(months) && months.length > 0;
    const isDisabled = disabled || !hasOptions || !label;

    const handleSelect = (value) => {
        setOpen(false);
        if (value != null && value !== selectedKey) {
            onChange?.(value);
        }
    };

    if (readOnly) {
        return (
            <View style={styles.wrapper}>
                <Text
                    style={[
                        theme.fonts.headlineSmall,
                        { color: theme.colors.onSurface, paddingVertical: 6 },
                    ]}
                    accessibilityRole="text"
                >
                    {label || " "}
                </Text>
            </View>
        );
    }

    return (
        <View style={styles.wrapper}>
            <Button
                mode="text"
                icon="unfold-more-horizontal"
                onPress={() => setOpen(true)}
                disabled={isDisabled}
                compact
                accessibilityLabel={accessibilityLabel}
                contentStyle={styles.buttonContent}
                textColor={theme.colors.onSurface}
            >
                <Text
                    style={[
                        theme.fonts.headlineSmall,
                        { color: theme.colors.onSurface},
                    ]}
                    accessibilityRole="text"
                >
                    {label || " "}
                </Text>
            </Button>
            <Portal>
                <Modal
                    visible={open}
                    onDismiss={() => setOpen(false)}
                    contentContainerStyle={[
                        styles.sheet,
                        { backgroundColor: theme.colors.elevation.level3 },
                    ]}
                >
                    {months?.map((item) => {
                        const isSelected = item.key === selectedKey;
                        return (
                            <TouchableRipple
                                key={item.key}
                                onPress={() => handleSelect(item.key)}
                                accessibilityRole="button"
                                accessibilityLabel={`Jump to ${item.label}`}
                                accessibilityState={{ selected: isSelected }}
                                style={[
                                    styles.row,
                                    isSelected && {
                                        backgroundColor: theme.colors.secondaryContainer,
                                    },
                                ]}
                            >
                                <Text
                                    style={[
                                        theme.fonts.labelLarge,
                                        {
                                            color: isSelected
                                                ? theme.colors.onSecondaryContainer
                                                : theme.colors.onSurface,
                                            textAlign: "center",
                                        },
                                    ]}
                                >
                                    {item.label}
                                </Text>
                            </TouchableRipple>
                        );
                    })}
                </Modal>
            </Portal>
        </View>
    );
};

const styles = StyleSheet.create({
    wrapper: {
        alignItems: "center",
    },
    buttonContent: {
        flexDirection: "row-reverse",
    },
    sheet: {
        marginHorizontal: 48,
        borderRadius: 12,
        overflow: "hidden",
        paddingVertical: 8,
    },
    row: {
        paddingVertical: 12,
        paddingHorizontal: 16,
    },
});

export default MonthPickerHeader;
