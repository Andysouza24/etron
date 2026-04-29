// compact horizontal step indicator
// highlights active step, dims completed/upcoming ones

import React from "react";
import { StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

// TODO: redesign step indicator

const WizardStepIndicator = ({ steps = [], activeIndex = 0 }) => {
    const theme = useTheme();

    if (!steps.length) return null;

    return (
        <View style={styles.container} accessibilityRole="tablist">
            {steps.map((step, index) => {
                const isActive = index === activeIndex;
                const isComplete = index < activeIndex;
                const dotColor = isActive
                    ? theme.colors.primary
                    : isComplete
                        ? theme.colors.primary
                        : theme.colors.surfaceVariant;
                const labelColor = isActive
                    ? theme.colors.onSurface
                    : theme.colors.onSurfaceVariant;

                return (
                    <View key={step.key} style={styles.stepWrap}>
                        <View style={styles.stepHeader}>
                            <View
                                style={[
                                    styles.dot,
                                    {
                                        backgroundColor: dotColor,
                                        borderColor: theme.colors.outline,
                                    },
                                ]}
                                accessibilityLabel={`Step ${index + 1}: ${step.title}`}
                            >
                                <Text
                                    style={[
                                        styles.dotText,
                                        {
                                            color: isActive || isComplete
                                                ? theme.colors.onPrimary
                                                : theme.colors.onSurfaceVariant,
                                        },
                                    ]}
                                >
                                    {index + 1}
                                </Text>
                            </View>
                            {index < steps.length - 1 && (
                                <View
                                    style={[
                                        styles.connector,
                                        {
                                            backgroundColor: isComplete
                                                ? theme.colors.primary
                                                : theme.colors.surfaceVariant,
                                        },
                                    ]}
                                />
                            )}
                        </View>
                        <Text
                            numberOfLines={1}
                            style={[styles.label, { color: labelColor }]}
                        >
                            {step.title}
                        </Text>
                    </View>
                );
            })}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        alignItems: "flex-start",
        paddingVertical: 8,
    },
    stepWrap: {
        flex: 1,
        alignItems: "flex-start",
    },
    stepHeader: {
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "stretch",
    },
    dot: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    dotText: {
        fontSize: 12,
        fontWeight: "600",
    },
    connector: {
        flex: 1,
        height: 2,
        marginHorizontal: 4,
    },
    label: {
        fontSize: 12,
        marginTop: 4,
    },
});

export default WizardStepIndicator;
