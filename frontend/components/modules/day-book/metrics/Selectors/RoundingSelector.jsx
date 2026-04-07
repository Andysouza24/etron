import React from "react";
import { View, ScrollView, TouchableOpacity } from "react-native";
import { Text, useTheme } from "react-native-paper";

const MODES = [
    { value: "none", label: "No Rounding" },
    { value: "round", label: "Rounding" },
    { value: "bestFit", label: "Best Fit" },
];

const DECIMAL_OPTIONS = Array.from({ length: 11 }, (_, i) => i); // 0-10

//TODO: improve the decimal places selector UI

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
        <View style={{ marginVertical: 8 }}>
            <Text style={{ fontSize: 13, color: theme.colors.onSurface, marginBottom: 6, fontWeight: "600" }}>
                {label}
            </Text>

            {/* selection chips */}
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
                {MODES.map((m) => {
                    const selected = mode === m.value;
                    return (
                        <TouchableOpacity
                            key={m.value}
                            onPress={() => selectMode(m.value)}
                            style={{
                                paddingHorizontal: 12,
                                paddingVertical: 6,
                                borderRadius: 16,
                                backgroundColor: selected ? theme.colors.primary : theme.colors.surfaceVariant,
                            }}
                        >
                            <Text style={{
                                fontSize: 12,
                                color: selected ? theme.colors.onPrimary : theme.colors.onSurface,
                                fontWeight: selected ? "600" : "400",
                            }}>
                                {m.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {/* decimal places scroller */}
            {mode === "round" && (
                <View>
                    <Text style={{ fontSize: 12, color: theme.colors.onSurfaceVariant, marginBottom: 4 }}>
                        Decimal Places
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={{ flexDirection: "row", gap: 6 }}>
                            {DECIMAL_OPTIONS.map((dp) => {
                                const selected = decimalPlaces === dp;
                                return (
                                    <TouchableOpacity
                                        key={dp}
                                        onPress={() => selectDecimal(dp)}
                                        style={{
                                            width: 36,
                                            height: 36,
                                            borderRadius: 18,
                                            justifyContent: "center",
                                            alignItems: "center",
                                            backgroundColor: selected ? theme.colors.primary : theme.colors.surfaceVariant,
                                        }}
                                    >
                                        <Text style={{
                                            fontSize: 13,
                                            color: selected ? theme.colors.onPrimary : theme.colors.onSurface,
                                            fontWeight: selected ? "700" : "400",
                                        }}>
                                            {dp}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </ScrollView>
                </View>
            )}

            {/* description */}
            <Text style={{ fontSize: 11, color: theme.colors.onSurfaceVariant, marginTop: 6 }}>
                {mode === "none" && "Values displayed exactly as stored."}
                {mode === "round" && `Values rounded to ${decimalPlaces} decimal place${decimalPlaces !== 1 ? "s" : ""}.`}
                {mode === "bestFit" && "Values automatically abbreviated (e.g. 1.4M, 2.5K)."}
            </Text>
        </View>
    );
}
