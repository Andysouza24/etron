// API specific extras inside GeneralSettingsStep
// endpoint is shown read-only here as editing it post-creation is handled by the existing Edit Data Source screen

import React from "react";
import { View, StyleSheet } from "react-native";
import { Text, useTheme } from "react-native-paper";

const ApiSettingsExtra = ({ draft }) => {
    const theme = useTheme();
    const endpoint = draft?.form?.url || draft?.form?.endpoint || "";

    return (
        <View style={styles.container}>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                Endpoint
            </Text>
            <Text style={{ color: theme.colors.onSurface }} numberOfLines={2}>
                {endpoint || "—"}
            </Text>
            {/* TODO: in-wizard endpoint editing (currently handled by the
                Edit Data Source screen post-creation). */}
            {/* TODO: per-source authentication editor parity with the form. */}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        gap: 4,
    },
});

export default ApiSettingsExtra;
