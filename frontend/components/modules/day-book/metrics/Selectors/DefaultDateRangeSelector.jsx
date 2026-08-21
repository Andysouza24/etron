// Reusable horizontal range navigator: [chevron-left] [label] [chevron-right].
//
// Presentational only. The parent decides what "previous" and "next" mean
// (shift by 1 day for the default 7-day view, 1 week for the week view,
// 1 month for the month view, etc.) so this component can back every
// time-window variant without modification.

import React from "react";
import { StyleSheet, View } from "react-native";
import { IconButton, Text, useTheme } from "react-native-paper";

const DefaultDateRangeSelector = ({
    label,
    onPrev,
    onNext,
    disablePrev = false,
    disableNext = false,
    accessibilityPrevLabel = "Previous range",
    accessibilityNextLabel = "Next range",
}) => {
    const theme = useTheme();
    return (
        <View style={styles.row}>
            <IconButton
                icon="chevron-left"
                size={20}
                onPress={onPrev}
                disabled={disablePrev}
                accessibilityLabel={accessibilityPrevLabel}
            />
            <Text
                style={[
                    styles.label,
                    theme.fonts?.labelMedium,
                    { color: theme.colors.onSurface },
                ]}
                numberOfLines={1}
            >
                {label}
            </Text>
            <IconButton
                icon="chevron-right"
                size={20}
                onPress={onNext}
                disabled={disableNext}
                accessibilityLabel={accessibilityNextLabel}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    row: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
    },
    label: {
        flexShrink: 1,
        textAlign: "center",
        minWidth: 110,
    },
});

export default DefaultDateRangeSelector;
