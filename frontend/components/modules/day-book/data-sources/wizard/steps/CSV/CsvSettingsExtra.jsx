// csv specific extras rendered inside GeneralSettingsStep
// exposes "method" toggle - overwrite vs extend


import React from "react";
import { View, StyleSheet } from "react-native";
import { RadioButton, Text, useTheme } from "react-native-paper";

// TODO: identify any other csv specific concerns that should be exposed here

const CsvSettingsExtra = ({ draft, setDraft }) => {
    const theme = useTheme();
    const method = draft.method || "overwrite";

    return (
        <View style={styles.container}>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>
                When the same file is re-uploaded, how should existing data behave?
            </Text>
            <RadioButton.Group
                onValueChange={(value) => setDraft({ method: value })}
                value={method}
            >
                <RadioButton.Item label="Overwrite existing rows" value="overwrite" />
                <RadioButton.Item label="Extend existing rows" value="extend" />
            </RadioButton.Group>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        gap: 4,
    },
});

export default CsvSettingsExtra;
