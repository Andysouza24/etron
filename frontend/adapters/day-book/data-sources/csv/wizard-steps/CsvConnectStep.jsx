// connection step for local csv file upload flow
// csv file picker, reads raw text, captures name
// asks backend for schema preview and writes it to wizard draft for next step

import React, { useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";
import * as DocumentPicker from "expo-document-picker";

import StackLayout from "../../../../../components/layout/StackLayout";
import BasicButton from "../../../../../components/common/buttons/BasicButton";
import TextField from "../../../../../components/common/input/TextField";
import { apiPost } from "../../../../../utils/api/apiClient";
import endpoints from "../../../../../utils/api/endpoints";
import { getWorkspaceId } from "../../../../../storage/workspaceStorage";
import { useWizard } from "../../../../../components/modules/day-book/data-sources/wizard/WizardContext";

const ACCEPTED_TYPES = [
    "text/csv",
    "application/vnd.ms-excel",
    "application/csv",
    "text/comma-separated-values",
];

const CsvConnectStep = () => {
    const theme = useTheme();
    const { draft, setDraft, goNext, setError } = useWizard();

    const [pickStatus, setPickStatus] = useState(draft.rawData ? "loaded" : "idle");
    const [previewing, setPreviewing] = useState(false);

    const handlePickFile = async () => {
        try {
            setPickStatus("loading");
            const result = await DocumentPicker.getDocumentAsync({
                type: ACCEPTED_TYPES,
                copyToCacheDirectory: true,
            });
            if (result.canceled) {
                setPickStatus(draft.rawData ? "loaded" : "idle");
                return;
            }
            const file = result.assets[0];
            const text = await (await fetch(file.uri)).text();
            setDraft({
                fileUri: file.uri,
                fileName: file.name,
                rawData: text,
                schemaPreview: null,
                confirmedSchema: null,
            });
            setPickStatus("loaded");
        } catch (err) {
            console.error("[CsvConnectStep] pick file:", err);
            setPickStatus("idle");
            setError(err?.message || "Failed to read file");
        }
    };

    const handlePreviewSchema = async () => {
        if (!draft.rawData) return;
        setPreviewing(true);
        setError(null);
        try {
            const workspaceId = await getWorkspaceId();
            const result = await apiPost(
                endpoints.modules.day_book.data_sources.previewSchema,
                { workspaceId, rawData: draft.rawData }
            );
            const preview = result.data;
            // local CSV is a one-shot upload - if the file is empty there's nothing to upload
            // block the user here rather than letting the empty-schema flow proceed
            if (preview?.isEmpty || (preview?.schema?.length ?? 0) === 0) {
                setError("The selected file is empty. Add some data and try again.");
                return;
            }
            setDraft({
                schemaPreview: preview,
                confirmedSchema: preview?.schema || null,
            });
            goNext();
        } catch (err) {
            console.error("[CsvConnectStep] previewSchema:", err);
            setError(err?.message || "Failed to preview field types");
        } finally {
            setPreviewing(false);
        }
    };

    const handleNameChange = (value) => setDraft({ name: value });

    const canPreview = Boolean(draft.rawData) && Boolean((draft.name || "").trim());

    return (
        <StackLayout spacing={16}>
            <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
                Upload CSV
            </Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                Pick a CSV file from your device. We'll auto-detect column types so
                you can review them on the next step.
            </Text>

            <BasicButton
                fullWidth
                label={draft.fileName ? `Replace file (${draft.fileName})` : "Pick a CSV file"}
                onPress={handlePickFile}
                disabled={pickStatus === "loading" || previewing}
                icon="file"
            />

            {pickStatus === "loading" && <ActivityIndicator />}

            {pickStatus === "loaded" && (
                <StackLayout spacing={12}>
                    <TextField
                        label="Source Name"
                        placeholder="Source Name"
                        value={draft.name || ""}
                        onChangeText={handleNameChange}
                    />
                </StackLayout>
            )}

            <View style={styles.actions}>
                <BasicButton
                    label={previewing ? "Analysing..." : "Continue"}
                    onPress={handlePreviewSchema}
                    disabled={!canPreview || previewing}
                    loading={previewing}
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

export default CsvConnectStep;
