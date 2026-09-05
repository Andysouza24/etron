
// connect step for the Custom API flow
// renders the shared ApiForm, lets user test connection
// on "Continue" creates data source in pending_setup state and fetches schema preview via live adapter
// the preview is stored on the wizard draft for the field-review step to consume

import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Dialog, Portal, Text, useTheme } from "react-native-paper";

import StackLayout from "../../../../../components/layout/StackLayout";
import BasicButton from "../../../../../components/common/buttons/BasicButton";
import ApiForm from "../../../../../components/layout/forms/ApiForm";
import {
    validateApiForm,
    buildApiConnectionData,
    generateApiNameFromUrl,
} from "../../../../../utils/connectionValidators";
import { apiPost } from "../../../../../utils/api/apiClient";
import endpoints from "../../../../../utils/api/endpoints";
import { getWorkspaceId } from "../../../../../storage/workspaceStorage";
import { buildApiBackendPayload, API_SOURCE_TYPE } from "../../apiAdapterPayload";
import { useWizard } from "../../../../../components/modules/day-book/data-sources/wizard/WizardContext";

const ApiConnectStep = () => {
    const theme = useTheme();
    const { draft, setDraft, goNext, setError } = useWizard();

    const [errors, setErrors] = useState({});
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState(draft.testResult || null);
    const [resultDialogOpen, setResultDialogOpen] = useState(false);
    const [continuing, setContinuing] = useState(false);

    const formData = draft.form || {};

    const setFormData = (updater) => {
        setDraft((prev) => {
            const nextForm = typeof updater === "function" ? updater(prev.form || {}) : updater;
            return { ...prev, form: nextForm };
        });
        // any form change invalidates a previous test
        setTestResult(null);
    };

    // Auto-generate a friendly name from the URL when the name field is empty
    const handleFieldBlur = () => {
        if (!formData.name && formData.url) {
            return generateApiNameFromUrl(formData);
        }
        return null;
    };

    const formIsValid = useMemo(() => validateApiForm(formData), [formData]);

    const validate = () => {
        const result = validateApiForm(formData, true);
        if (result === true) {
            setErrors({});
            return true;
        }
        setErrors(result || {});
        return false;
    };

    const handleTestConnection = async () => {
        if (!validate()) return;
        setTesting(true);
        setError(null);
        try {
            const connectionData = buildApiConnectionData(formData);
            const { config, secrets } = buildApiBackendPayload(connectionData);
            const workspaceId = await getWorkspaceId();
            const response = await apiPost(
                endpoints.modules.day_book.data_sources.testConnection,
                { sourceType: API_SOURCE_TYPE, config, secrets },
                { workspaceId }
            );
            const result = response?.data ?? {};
            if (result.status && result.status !== "success") {
                throw new Error(result.errorMessage || "Connection test failed");
            }
            setTestResult({ status: "success", preview: result.preview ?? result.data ?? null, raw: result });
            setResultDialogOpen(true);
        } catch (err) {
            console.error("[ApiConnectStep] testConnection:", err);
            setTestResult({ status: "error", errorMessage: err?.message || "Test failed" });
        } finally {
            setTesting(false);
        }
    };

    const handleContinue = async () => {
        if (!validate()) return;
        setContinuing(true);
        setError(null);
        try {
            const workspaceId = await getWorkspaceId();
            const connectionData = buildApiConnectionData(formData);
            const { sourceType, config, secrets } = buildApiBackendPayload(connectionData);

            const name = (formData.name?.trim()
                || generateApiNameFromUrl(formData)
                || "API Connection").trim();

            // create a pending data source so the live adapter has access to config + secrets when the next step requests a schema preview
            const createResponse = await apiPost(
                endpoints.modules.day_book.data_sources.addRemote,
                {
                    workspaceId,
                    name,
                    sourceType,
                    config,
                    secrets,
                    pendingSetup: true,
                }
            );
            const created = createResponse?.data;
            if (!created?.dataSourceId) {
                throw new Error("No dataSourceId returned from server");
            }

            const previewResponse = await apiPost(
                endpoints.modules.day_book.data_sources.previewSchemaForSource(created.dataSourceId),
                { workspaceId }
            );
            const preview = previewResponse?.data;
            if (!preview?.schema?.length) {
                throw new Error("Schema preview returned no fields");
            }

            setDraft({
                name,
                dataSourceId: created.dataSourceId,
                schemaPreview: preview,
                confirmedSchema: preview.schema,
                testResult,
            });
            goNext();
        } catch (err) {
            console.error("[ApiConnectStep] continue:", err);
            setError(err?.response?.data?.error || err?.message || "Failed to start setup");
        } finally {
            setContinuing(false);
        }
    };

    const canContinue = formIsValid && !continuing && !testing;

    const previewJson = useMemo(() => {
        if (!testResult || testResult.status !== "success") return null;
        const payload = testResult.preview ?? testResult.raw ?? null;
        if (payload == null) return null;
        try {
            return JSON.stringify(payload, null, 2);
        } catch {
            return String(payload);
        }
    }, [testResult]);

    const connectionDetails = useMemo(() => {
        const connectionData = buildApiConnectionData(formData);
        const { config } = buildApiBackendPayload(connectionData);
        return [
            { label: "Endpoint", value: config.endpoint || "—" },
            { label: "Authentication", value: config.authType || "None" },
        ];
    }, [formData]);

    return (
        <StackLayout spacing={16}>
            <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
                Custom API
            </Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                Configure how to reach your API endpoint. Test the connection, then
                continue to review the detected fields.
            </Text>

            <ApiForm
                formData={formData}
                setFormData={setFormData}
                errors={errors}
                isConnected={false}
                theme={theme}
                onFieldBlur={handleFieldBlur}
            />

            <View style={styles.testRow}>
                <BasicButton
                    label={testing ? "Testing..." : "Test Connection"}
                    icon="connection"
                    onPress={handleTestConnection}
                    loading={testing}
                    disabled={!formIsValid || testing || continuing}
                    mode="outlined"
                />
            </View>

            {testResult?.status === "error" && (
                <View
                    style={[
                        styles.banner,
                        { backgroundColor: theme.colors.errorContainer },
                    ]}
                >
                    <Text style={{ color: theme.colors.onErrorContainer }}>
                        {testResult.errorMessage}
                    </Text>
                </View>
            )}

            <View style={styles.actions}>
                <BasicButton
                    label={continuing ? "Setting up..." : "Continue"}
                    onPress={handleContinue}
                    loading={continuing}
                    disabled={!canContinue}
                />
            </View>

            <Portal>
                <Dialog
                    visible={resultDialogOpen}
                    onDismiss={() => setResultDialogOpen(false)}
                    style={{ backgroundColor: theme.colors.background }}
                >
                    <Dialog.Title>Connection successful</Dialog.Title>
                    <Dialog.Content>
                        <StackLayout spacing={12}>
                            {connectionDetails.map((detail) => (
                                <View key={detail.label} style={styles.detailRow}>
                                    <Text style={{ color: theme.colors.onSurface }}>
                                        {detail.label}
                                    </Text>
                                    <Text
                                        style={[styles.detailValue, { color: theme.colors.onSurfaceVariant }]}
                                        numberOfLines={2}
                                    >
                                        {detail.value}
                                    </Text>
                                </View>
                            ))}

                            <Text variant="labelLarge" style={{ color: theme.colors.onSurface, marginTop: 8 }}>
                                Preview
                            </Text>
                            <View
                                style={[
                                    styles.previewBox,
                                    { backgroundColor: theme.colors.surfaceVariant },
                                ]}
                            >
                                <ScrollView style={styles.previewScroll} nestedScrollEnabled>
                                    <Text
                                        selectable
                                        style={[styles.previewText, { color: theme.colors.onSurfaceVariant }]}
                                    >
                                        {previewJson || "No preview data returned."}
                                    </Text>
                                </ScrollView>
                            </View>
                        </StackLayout>
                    </Dialog.Content>
                    <Dialog.Actions>
                        <BasicButton
                            label="Close"
                            mode="outlined"
                            onPress={() => setResultDialogOpen(false)}
                        />
                    </Dialog.Actions>
                </Dialog>
            </Portal>
        </StackLayout>
    );
};

const styles = StyleSheet.create({
    testRow: {
        flexDirection: "row",
        justifyContent: "flex-end",
    },
    banner: {
        padding: 12,
        borderRadius: 8,
    },
    actions: {
        flexDirection: "row",
        justifyContent: "flex-end",
        gap: 8,
        marginTop: 12,
    },
    detailRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        gap: 12,
    },
    detailValue: {
        flexShrink: 1,
        textAlign: "right",
    },
    previewBox: {
        padding: 12,
        borderRadius: 8,
        maxHeight: 240,
    },
    previewScroll: {
        maxHeight: 220,
    },
    previewText: {
        fontFamily: "monospace",
        fontSize: 12,
    },
});

export default ApiConnectStep;
