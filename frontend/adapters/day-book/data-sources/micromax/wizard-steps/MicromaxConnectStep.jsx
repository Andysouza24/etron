// connect step for the Micromax Dashboard flow
// captures connection name
// then on Continue creates the parent data source in `pending_setup` status
// asks backend to discover every child file currently in bucket
// discovery auto-applies bundled default schemas and activates each child - no manual review is required

import React, { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

import StackLayout from "../../../../../components/layout/StackLayout";
import TextField from "../../../../../components/common/input/TextField";
import BasicButton from "../../../../../components/common/buttons/BasicButton";
import { apiPost } from "../../../../../utils/api/apiClient";
import endpoints from "../../../../../utils/api/endpoints";
import { getWorkspaceId } from "../../../../../storage/workspaceStorage";
import { useWizard } from "../../../../../components/modules/day-book/data-sources/wizard/WizardContext";

const DEFAULT_SOURCE_TYPE = "micromax-dashboard";
const DEFAULT_DISPLAY_NAME = "Micromax Dashboard";
const DEFAULT_DESCRIPTION =
    "Connect Micromax Dashboard. Each export file becomes its own data source and is set up automatically using the standard field configuration. If any new files don't have a standard configuration yet, you'll be asked to review their fields after connecting.";

// props let other adapters reuse this step:
//   sourceType - parent dataSource type (defaults to "micromax-dashboard")
//   displayName - shown in headings, default name and placeholder
//   description - body copy on the step
//   discoverEndpoint - function(dataSourceId) returning the discover API path
//                      (defaults to the micromax-dashboard discover endpoint)
const MicromaxConnectStep = ({
    sourceType = DEFAULT_SOURCE_TYPE,
    displayName = DEFAULT_DISPLAY_NAME,
    description = DEFAULT_DESCRIPTION,
    discoverEndpoint = endpoints.modules.day_book.data_sources.discoverMicromaxDashboard,
} = {}) => {
    const theme = useTheme();
    const { draft, setDraft, goNext, setError } = useWizard();

    const [name, setName] = useState(draft.name || "");
    const [continuing, setContinuing] = useState(false);

    const formIsValid = useMemo(() => true, []); // name is optional

    const handleContinue = async () => {
        setContinuing(true);
        setError(null);
        try {
            const workspaceId = await getWorkspaceId();
            const trimmedName = name.trim() || displayName;

            // create the parent in pending_setup so we can discover children before any data is processed
            const createResponse = await apiPost(
                endpoints.modules.day_book.data_sources.addRemote,
                {
                    workspaceId,
                    name: trimmedName,
                    sourceType,
                    config: {},
                    pendingSetup: true,
                }
            );
            const created = createResponse?.data;
            if (!created?.dataSourceId) {
                throw new Error("No dataSourceId returned from server");
            }

            const discoverResponse = await apiPost(
                discoverEndpoint(created.dataSourceId),
                { workspaceId }
            );
            const discovered = discoverResponse?.data?.children || [];

            setDraft({
                name: trimmedName,
                dataSourceId: created.dataSourceId,
                children: discovered,
                reviewedChildIds: {},
            });
            goNext();
        } catch (err) {
            console.error("[MicromaxConnectStep] continue:", err);
            setError(err?.response?.data?.error || err?.message || "Failed to start setup");
        } finally {
            setContinuing(false);
        }
    };

    return (
        <StackLayout spacing={16}>
            <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
                {displayName}
            </Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                {description}
            </Text>

            <TextField
                label="Connection name (optional)"
                placeholder={`e.g. ${displayName}`}
                value={name}
                onChangeText={setName}
            />

            <View style={styles.actions}>
                <BasicButton
                    label={continuing ? "Setting up..." : "Continue"}
                    onPress={handleContinue}
                    loading={continuing}
                    disabled={!formIsValid || continuing}
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

export default MicromaxConnectStep;
