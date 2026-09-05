import React from "react";
import { View, ScrollView, StyleSheet, Pressable } from "react-native";
import { Chip, Text, useTheme } from "react-native-paper";

const MODES = [
    { value: "none", label: "No Rounding" },
    { value: "round", label: "Rounding" },
    { value: "bestFit", label: "Best Fit" },
];

const DECIMAL_OPTIONS = Array.from({ length: 11 }, (_, i) => i); // 0-10

export default function RoundingSelector({ rounding, setRounding, label = "Value Rounding" }) {
    const theme = useTheme();
    const mode = rounding?.mode ?? "none";
    const decimalPlaces = rounding?.decimalPlaces ?? 2;

    const selectMode = (newMode) => {
        setRounding((prev) => ({
            ...prev,
            mode: newMode,
            decimalPlaces: prev?.decimalPlaces ?? 2,
        }));
    };

    const selectDecimal = (dp) => {
        setRounding((prev) => ({ ...prev, decimalPlaces: dp }));
    };

    return (
        <View style={styles.container}>
            <Text variant="labelLarge" style={{ color: theme.colors.onSurface, marginBottom: 8 }}>
                {label}
            </Text>

            {/* selection chips */}
            <View style={styles.chipRow}>
                {MODES.map((m) => {
                    const selected = mode === m.value;
                    return (
                        <Chip
                            key={m.value}
                            selected={selected}
                            onPress={() => selectMode(m.value)}
                            showSelectedCheck={false}
                            style={{
                                backgroundColor: selected
                                    ? theme.colors.secondaryContainer
                                    : theme.colors.surfaceVariant,
                            }}
                            textStyle={{
                                color: selected
                                    ? theme.colors.onSecondaryContainer
                                    : theme.colors.onSurfaceVariant,
                            }}
                            accessibilityLabel={`Rounding mode: ${m.label}`}
                        >
                            {m.label}
                        </Chip>
                    );
                })}
            </View>

            {/* decimal places scroller */}
            {mode === "round" && (
                <View>
                    <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 4 }}>
                        Decimal Places
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={styles.decimalRow}>
                            {DECIMAL_OPTIONS.map((dp) => {
                                const selected = decimalPlaces === dp;
                                return (
                                    <Pressable
                                        key={dp}
                                        onPress={() => selectDecimal(dp)}
                                        style={[
                                            styles.decimalButton,
                                            {
                                                backgroundColor: selected
                                                    ? theme.colors.secondaryContainer
                                                    : theme.colors.surfaceVariant,
                                            },
                                        ]}
                                        accessibilityLabel={`${dp} decimal places`}
                                        accessibilityRole="button"
                                    >
                                        <Text
                                            variant="labelMedium"
                                            style={{
                                                color: selected
                                                    ? theme.colors.onSecondaryContainer
                                                    : theme.colors.onSurfaceVariant,
                                            }}
                                        >
                                            {dp}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </View>
                    </ScrollView>
                </View>
            )}

            {/* description */}
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}>
                {mode === "none" && "Values displayed exactly as stored."}
                {mode === "round" && `Values rounded to ${decimalPlaces} decimal place${decimalPlaces !== 1 ? "s" : ""}.`}
                {mode === "bestFit" && "Values automatically abbreviated (e.g. 1.4M, 2.5K)."}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginVertical: 8,
    },
    chipRow: {
        flexDirection: "row",
        gap: 8,
        marginBottom: 8,
    },
    decimalRow: {
        flexDirection: "row",
        gap: 8,
    },
    decimalButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: "center",
        alignItems: "center",
    },
});
