// shared general settings step
// renders connection name + optional adapter specific extras component
// primary action runs wizard finalise callback (wired up by adapter)

import React from "react";
import { StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

import StackLayout from "../../../../../layout/StackLayout";
import TextField from "../../../../../common/input/TextField";
import BasicButton from "../../../../../common/buttons/BasicButton";
import { useWizard } from "../WizardContext";

// TODO: identify additional common fields for the general settings step

const SectionHeader = ({ title, description, theme }) => (
    <View style={{ gap: 4 }}>
        <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
            {title}
        </Text>
        {description ? (
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                {description}
            </Text>
        ) : null}
    </View>
);

const GeneralSettingsStep = ({
    ExtraSettings,
    finaliseLabel = "Create Connection",
    nameLabel = "Connection name",
    namePlaceholder = "Connection name",
}) => {
    const theme = useTheme();
    const { draft, setDraft, goBack, finalise, loading, isFirst } = useWizard();

    const handleNameChange = (value) => setDraft({ name: value });

    const canFinalise = Boolean((draft.name || "").trim()) && !loading;

    const handleFinalise = async () => {
        try {
            await finalise();
        } catch {
            // wizard already surfaces the error
        }
    };

    return (
        <StackLayout spacing={20}>
            <StackLayout spacing={8}>
                <SectionHeader title="General" theme={theme} />
                <TextField
                    label={nameLabel}
                    placeholder={namePlaceholder}
                    value={draft.name || ""}
                    onChangeText={handleNameChange}
                />
            </StackLayout>

            {ExtraSettings ? (
                <StackLayout spacing={8}>
                    <SectionHeader
                        title="Source settings"
                        description="Settings specific to this data source type."
                        theme={theme}
                    />
                    <ExtraSettings draft={draft} setDraft={setDraft} />
                </StackLayout>
            ) : null}

            {/* TODO: collaboration settings — per-role read/manage permissions */}
            <StackLayout spacing={8}>
                <SectionHeader
                    title="Collaboration"
                    description="Choose which roles can view or manage this connection."
                    theme={theme}
                />
                <Text style={{ color: theme.colors.onSurfaceVariant, fontStyle: "italic" }}>
                    Not yet available.
                </Text>
            </StackLayout>

            {/* TODO: refresh / sync schedule controls */}
            <StackLayout spacing={8}>
                <SectionHeader
                    title="Refresh schedule"
                    description="Configure how often this connection re-syncs."
                    theme={theme}
                />
                <Text style={{ color: theme.colors.onSurfaceVariant, fontStyle: "italic" }}>
                    Not yet available.
                </Text>
            </StackLayout>

            <View style={styles.actions}>
                {!isFirst && (
                    <BasicButton label="Back" onPress={goBack} mode="outlined" />
                )}
                <BasicButton
                    label={finaliseLabel}
                    onPress={handleFinalise}
                    loading={loading}
                    disabled={!canFinalise}
                />
            </View>
        </StackLayout>
    );
};

const styles = StyleSheet.create({
    actions: {
        flexDirection: "row",
        justifyContent: "flex-end",
        gap: 8,
        marginTop: 12,
    },
});

export default GeneralSettingsStep;
