// per-child review step for the Micromax Dashboard wizard
// shown only when discovery finds export files that do not have a bundled default schema
// each pending child must be reviewed before the wizard can advance to general settings

import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
    ActivityIndicator,
    Card,
    Dialog,
    Icon,
    Portal,
    Text,
    useTheme,
} from "react-native-paper";

import StackLayout from "../../../../../components/layout/StackLayout";
import BasicButton from "../../../../../components/common/buttons/BasicButton";
import FieldCategoryReview from "../../../../../components/modules/day-book/data-sources/FieldCategoryReview";
import { apiPost } from "../../../../../utils/api/apiClient";
import endpoints from "../../../../../utils/api/endpoints";
import { getWorkspaceId } from "../../../../../storage/workspaceStorage";
import { useWizard } from "../../../../../components/modules/day-book/data-sources/wizard/WizardContext";

const MicromaxChildrenReviewStep = () => {
    const theme = useTheme();
    const { draft, setDraft, goNext, goBack, isFirst, setError } = useWizard();

    // only files without a bundled default schema reach this step - the backend leaves them in `pending_setup`
    const pendingChildren = useMemo(
        () => (draft.children || []).filter((c) => c.status === "pending_setup"),
        [draft.children]
    );
    const reviewedIds = draft.reviewedChildIds || {};

    const [activeChildId, setActiveChildId] = useState(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [activePreview, setActivePreview] = useState(null);
    const [activeSchema, setActiveSchema] = useState(null);
    const [activating, setActivating] = useState(false);

    const allReviewed = useMemo(
        () => pendingChildren.length > 0 && pendingChildren.every((c) => reviewedIds[c.dataSourceId]),
        [pendingChildren, reviewedIds]
    );

    const activeChild = useMemo(
        () => pendingChildren.find((c) => c.dataSourceId === activeChildId) || null,
        [pendingChildren, activeChildId]
    );

    const openChild = (child) => {
        setActiveChildId(child.dataSourceId);
        setActivePreview(null);
        setActiveSchema(null);
    };

    const closeDialog = () => {
        setActiveChildId(null);
        setActivePreview(null);
        setActiveSchema(null);
        setActivating(false);
    };

    // fetch the schema preview for the active child whenever it changes
    useEffect(() => {
        if (!activeChild) return;
        let cancelled = false;
        const load = async () => {
            setPreviewLoading(true);
            setError(null);
            try {
                const workspaceId = await getWorkspaceId();
                const response = await apiPost(
                    endpoints.modules.day_book.data_sources.previewSchemaForSource(
                        activeChild.dataSourceId
                    ),
                    { workspaceId }
                );
                if (cancelled) return;
                const preview = response?.data;
                setActivePreview(preview);
                setActiveSchema(preview?.schema || []);
            } catch (err) {
                if (cancelled) return;
                console.error("[MicromaxChildrenReviewStep] preview:", err);
                setError(err?.response?.data?.error || err?.message || "Failed to load schema preview");
                setActivePreview(null);
                setActiveSchema([]);
            } finally {
                if (!cancelled) setPreviewLoading(false);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [activeChild, setError]);

    const handleSaveChild = async () => {
        if (!activeChild) return;
        setActivating(true);
        setError(null);
        try {
            const workspaceId = await getWorkspaceId();
            // empty file - send an empty confirmedSchema so the backend activates the source without saving a schema yet
            // when data first arrives the transform will auto-infer + flag for review
            await apiPost(
                endpoints.modules.day_book.data_sources.activate(activeChild.dataSourceId),
                { workspaceId, confirmedSchema: activeSchema || [] }
            );
            setDraft((prev) => ({
                ...prev,
                reviewedChildIds: {
                    ...(prev.reviewedChildIds || {}),
                    [activeChild.dataSourceId]: true,
                },
            }));
            closeDialog();
        } catch (err) {
            console.error("[MicromaxChildrenReviewStep] activate:", err);
            setError(err?.response?.data?.error || err?.message || "Failed to save schema");
        } finally {
            setActivating(false);
        }
    };

    if (!pendingChildren.length) {
        return (
            <StackLayout spacing={16}>
                <Text style={{ color: theme.colors.onSurfaceVariant }}>
                    All export files were set up automatically. Continue to finish setup.
                </Text>
                <View style={styles.actions}>
                    {!isFirst && <BasicButton label="Back" mode="outlined" onPress={goBack} />}
                    <BasicButton label="Continue" onPress={goNext} />
                </View>
            </StackLayout>
        );
    }

    return (
        <StackLayout spacing={16}>
            <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
                Review new files
            </Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                These export files do not have a default field configuration yet. Review
                the detected fields for each one before continuing. All other files were
                set up automatically.
            </Text>

            <StackLayout spacing={8}>
                {pendingChildren.map((child) => {
                    const reviewed = !!reviewedIds[child.dataSourceId];
                    return (
                        <Card
                            key={child.dataSourceId}
                            mode="outlined"
                            onPress={() => openChild(child)}
                        >
                            <Card.Title
                                title={child.name || child.config?.fileName || child.dataSourceId}
                                subtitle={reviewed ? "Reviewed" : "Pending review"}
                                right={(props) => (
                                    <Icon
                                        {...props}
                                        size={20}
                                        source={reviewed ? "check-circle" : "circle-outline"}
                                        color={reviewed ? theme.colors.primary : theme.colors.onSurfaceVariant}
                                    />
                                )}
                            />
                        </Card>
                    );
                })}
            </StackLayout>

            <View style={styles.actions}>
                {!isFirst && <BasicButton label="Back" mode="outlined" onPress={goBack} />}
                <BasicButton
                    label="Continue"
                    onPress={goNext}
                    disabled={!allReviewed}
                />
            </View>

            <Portal>
                <Dialog
                    visible={!!activeChild}
                    onDismiss={closeDialog}
                    style={[styles.dialog, { backgroundColor: theme.colors.background }]}
                >
                    <Dialog.Title>
                        {activeChild?.name || activeChild?.config?.fileName || "Review file"}
                    </Dialog.Title>
                    <Dialog.Content>
                        {previewLoading && (
                            <View style={styles.loaderRow}>
                                <ActivityIndicator />
                                <Text style={{ color: theme.colors.onSurfaceVariant }}>
                                    Loading schema preview...
                                </Text>
                            </View>
                        )}
                        {!previewLoading && activePreview && (activePreview.isEmpty || activeSchema?.length === 0) && (
                            <View style={styles.emptyState}>
                                <Text variant="titleSmall">No data yet</Text>
                                <Text style={{ color: theme.colors.onSurfaceVariant }}>
                                    This file is empty, so there are no fields to review.
                                    Mark it as reviewed to continue. Fields will be flagged
                                    for review once data arrives.
                                </Text>
                            </View>
                        )}
                        {!previewLoading && activeSchema && activeSchema.length > 0 && (
                            <ScrollView style={styles.dialogScroll} nestedScrollEnabled>
                                <FieldCategoryReview
                                    schema={activeSchema}
                                    sampleData={activePreview?.sampleData || []}
                                    onChange={setActiveSchema}
                                />
                            </ScrollView>
                        )}
                    </Dialog.Content>
                    <Dialog.Actions>
                        <BasicButton label="Cancel" mode="outlined" onPress={closeDialog} />
                        <BasicButton
                            label={activating ? "Saving..." : (activeSchema?.length ? "Save" : "Mark as reviewed")}
                            onPress={handleSaveChild}
                            loading={activating}
                            disabled={previewLoading || activating || !activePreview}
                        />
                    </Dialog.Actions>
                </Dialog>
            </Portal>
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
    dialog: {
        maxHeight: "90%",
    },
    dialogScroll: {
        maxHeight: 480,
    },
    loaderRow: {
        flexDirection: "row",
        gap: 8,
        alignItems: "center",
        paddingVertical: 12,
    },
    emptyState: {
        gap: 8,
        paddingVertical: 8,
    },
});

export default MicromaxChildrenReviewStep;
