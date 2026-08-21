// settings screen for a dashboard parent connection
// supports both micromax-dashboard and test-connection (and any future
// parent/file adapter pair following the same pattern)

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import { ActivityIndicator, List, Text, useTheme } from "react-native-paper";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";

import ResponsiveScreen from "../../../../../../../components/layout/ResponsiveScreen";
import Header from "../../../../../../../components/layout/Header";
import StackLayout from "../../../../../../../components/layout/StackLayout";
import BasicButton from "../../../../../../../components/common/buttons/BasicButton";
import ThemedRefreshControl from "../../../../../../../components/common/ThemedRefreshControl";
import DashboardConnectionCard from "../../../../../../../components/modules/day-book/data-sources/DashboardConnectionCard";
import DataPreviewModal from "../../../../../../../components/modules/day-book/data-sources/DataPreviewModal";

import { useDataSourceContext } from "../../../../../../../contexts/DataSourceContext";
import { useHasPermission } from "../../../../../../../hooks/useHasPermission";
import useDataPreview from "../../../../../../../hooks/modules/day_book/data-sources/useDataPreview";
import { getWorkspaceId } from "../../../../../../../storage/workspaceStorage";

// display labels keyed by parent source type
// keeps the screen generic across every parent/file dashboard pair
const PARENT_TYPE_LABELS = {
    "micromax-dashboard": "Micromax Dashboard",
    "test-connection": "Test Connection",
};

// child source buckets shown as accordions on this screen
// `alwaysShow` keeps the group visible even when empty (currently active only)
const CHILD_GROUPS = [
    { key: "pending", title: "Pending", alwaysShow: false, emptyText: null },
    { key: "review", title: "Schema review", alwaysShow: false, emptyText: null },
    { key: "error", title: "Error", alwaysShow: false, emptyText: null },
    { key: "active", title: "Active", alwaysShow: true, emptyText: "There are no active data sources." },
    { key: "disabled", title: "Disabled", alwaysShow: false, emptyText: null },
];

// route a child source into exactly one bucket
// priority: review > error > pending/processing > disabled/empty > active
// `isRefreshing` lets the caller treat an in-flight refresh as processing so
// the card moves out of "active" the instant the user clicks refresh, even
// before the backend status update reaches the AppSync subscription.
const bucketForChild = (child, isRefreshing = false) => {
    const status = (child.status || "").toLowerCase();
    if (isRefreshing) return "pending";
    if (child.requiresReview) return "review";
    if (status === "error" || status === "failed") return "error";
    if (status === "pending" || status === "pending_upload" || status === "processing") return "pending";
    if (child.enabled === false || status === "no_data") return "disabled";
    return "active";
};

const formatDate = (value) => {
    if (!value) return "—";
    try {
        return new Date(value).toLocaleString();
    } catch {
        return "—";
    }
};

const MicromaxDashboardSettings = () => {
    const theme = useTheme();
    const { id: parentId } = useLocalSearchParams();
    const {
        dataSources,
        refreshDataSources,
        rescanMicromaxDashboard,
        refreshDashboardRawData,
        disconnectDataSource,
        toggleDataSourceEnabled,
    } = useDataSourceContext();
    const { allowed: manageDataSourcesPermission } = useHasPermission(
        "modules.daybook.datasources.manage_dataSources"
    );
    const { allowed: viewDataPermission } = useHasPermission(
        "modules.daybook.datasources.view_data"
    );

    const [workspaceId, setWorkspaceId] = useState(null);
    useEffect(() => {
        getWorkspaceId().then(setWorkspaceId).catch(() => setWorkspaceId(null));
    }, []);
    const {
        previewOpen,
        previewStatus,
        previewSchema,
        previewRows,
        openPreview,
        dismissPreview,
    } = useDataPreview(workspaceId);

    const [rescanning, setRescanning] = useState(false);
    const [disconnecting, setDisconnecting] = useState(false);
    const [refreshingChildId, setRefreshingChildId] = useState(null);
    const [refreshing, setRefreshing] = useState(false);
    const [notFound, setNotFound] = useState(false);

    const list = dataSources?.list || [];
    const parent = useMemo(
        () => list.find((s) => s.dataSourceId === parentId),
        [list, parentId]
    );
    // file children are identified purely by parentDataSourceId so this screen
    // works for any parent/file pair (micromax-dashboard-file, test-connection-file, ...)
    const fileChildren = useMemo(
        () =>
            list.filter(
                (s) => s.config?.parentDataSourceId === parentId
            ),
        [list, parentId]
    );

    const displayName = parent
        ? (PARENT_TYPE_LABELS[parent.sourceType] || parent.name || "Connection")
        : "Connection";

    useFocusEffect(
        useCallback(() => {
            refreshDataSources?.();
        }, [refreshDataSources])
    );

    useEffect(() => {
        if (parent) {
            setNotFound(false);
            return;
        }
        const t = setTimeout(() => setNotFound(true), 5000);
        return () => clearTimeout(t);
    }, [parent]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            await refreshDataSources?.();
        } finally {
            setRefreshing(false);
        }
    }, [refreshDataSources]);

    const handleRescan = async () => {
        if (!parent || !manageDataSourcesPermission) return;
        setRescanning(true);
        try {
            await rescanMicromaxDashboard(parent.dataSourceId, parent.sourceType);
        } catch (err) {
            // TODO: Replace Alert.alert with a Paper Snackbar once a shared Snackbar component is available.
            Alert.alert("Refresh failed", err?.message || "Unable to rescan files");
        } finally {
            setRescanning(false);
        }
    };

    const handleRescanChild = async (child) => {
        if (!manageDataSourcesPermission || !child?.dataSourceId) return;
        setRefreshingChildId(child.dataSourceId);
        try {
            await refreshDashboardRawData(child.dataSourceId);
        } catch (err) {
            // TODO: Replace Alert.alert with a Paper Snackbar once a shared Snackbar component is available.
            Alert.alert("Refresh failed", err?.message || "Unable to refresh this file.");
        } finally {
            setRefreshingChildId(null);
        }
    };

    const handleDisconnect = () => {
        if (!parent || !manageDataSourcesPermission) return;
        // TODO: Replace Alert.alert with a Paper Dialog for destructive confirmations (theme-aware, M3 extra-large radius) once a shared confirmation Dialog component is available.
        Alert.alert(
            `Disconnect ${displayName}?`,
            "Disconnecting will remove every file data source and its imported data. Your original files are not affected.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Disconnect",
                    style: "destructive",
                    onPress: async () => {
                        setDisconnecting(true);
                        try {
                            await disconnectDataSource(parent.dataSourceId);
                            router.back();
                        } catch (err) {
                            // TODO: Replace Alert.alert with a Paper Snackbar once a shared Snackbar component is available.
                            Alert.alert(
                                "Disconnect failed",
                                err?.message || `Unable to disconnect ${displayName}`
                            );
                            setDisconnecting(false);
                        }
                    },
                },
            ]
        );
    };

    const bucketedChildren = useMemo(() => {
        const buckets = { pending: [], review: [], error: [], active: [], disabled: [] };
        fileChildren.forEach((child) => {
            const isRefreshing = refreshingChildId === child.dataSourceId;
            buckets[bucketForChild(child, isRefreshing)].push(child);
        });
        return buckets;
    }, [fileChildren, refreshingChildId]);

    const renderChildCard = (child) => {
        const isRefreshingThis = refreshingChildId === child.dataSourceId;
        const isEnabled = child.enabled !== false;
        const subtitle = isRefreshingThis
            ? "Refreshing..."
            : !isEnabled
                ? "Disabled"
                : child.lastUpdate
                    ? `Last sync ${formatDate(child.lastUpdate)}`
                    : "Not synced yet";
        return (
            <DashboardConnectionCard
                key={child.dataSourceId}
                label={child.name}
                subtitle={subtitle}
                status={child.status}
                progressPercent={child.progressPercent}
                enabled={isEnabled}
                onNavigate={() =>
                    router.navigate(
                        `/modules/day-book/data-management/view-data-source/${child.dataSourceId}`
                    )
                }
                onSync={
                    manageDataSourcesPermission && !isRefreshingThis && isEnabled
                        ? () => handleRescanChild(child)
                        : undefined
                }
                onToggleEnabled={(next) =>
                    toggleDataSourceEnabled(child.dataSourceId, next).catch((err) => {
                        Alert.alert(
                            next ? "Unable to enable" : "Unable to disable",
                            err?.message || "Please try again."
                        );
                    })
                }
                onViewData={() => openPreview(child)}
                viewDataAllowed={viewDataPermission}
                syncing={isRefreshingThis}
                manageDataSourceAllowed={manageDataSourcesPermission}
            />
        );
    };

    if (!parent) {
        return (
            <ResponsiveScreen
                header={<Header title={displayName} showBack />}
                center
                padded
            >
                {notFound ? (
                    <View>
                        <Text variant="titleMedium">Connection not found</Text>
                        <Text
                            variant="bodyMedium"
                            style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}
                        >
                            This connection may have been deleted or you no longer have access.
                        </Text>
                        <BasicButton
                            label="Go back"
                            onPress={() => router.back()}
                            mode="outlined"
                            style={{ marginTop: 16 }}
                        />
                    </View>
                ) : (
                    <View>
                        <ActivityIndicator accessibilityLabel="Loading connection" />
                        <Text
                            variant="bodyMedium"
                            style={{ color: theme.colors.onSurfaceVariant, marginTop: 12 }}
                        >
                            Loading connection…
                        </Text>
                    </View>
                )}
            </ResponsiveScreen>
        );
    }

    return (
        <ResponsiveScreen
            header={<Header title={displayName} showBack />}
            center={false}
            padded
            scroll={false}
        >
            <ScrollView
                contentContainerStyle={styles.content}
                refreshControl={
                    <ThemedRefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                    />
                }
            >
                <StackLayout spacing={20}>
                    <View>
                        <Text variant="titleMedium">{parent.name}</Text>
                        <Text
                            variant="bodySmall"
                            style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}
                        >
                            {(() => {
                                const created = parent.createdAt
                                    ? `Connected ${formatDate(parent.createdAt)}`
                                    : null;
                                const fileLabel = `${fileChildren.length} file${
                                    fileChildren.length === 1 ? "" : "s"
                                }`;
                                return created ? `${created} · ${fileLabel}` : fileLabel;
                            })()}
                        </Text>
                        <Text
                            variant="bodySmall"
                            style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}
                        >
                            {parent.lastUpdate
                                ? `Last update ${formatDate(parent.lastUpdate)}`
                                : "Last update —"}
                        </Text>
                    </View>

                    <List.AccordionGroup>
                        <List.Accordion
                            id="about-connection"
                            title="About this connection"
                            style={styles.aboutAccordion}
                            titleStyle={[
                                styles.aboutTitle,
                                { color: theme.colors.onSurfaceVariant },
                            ]}
                            left={() => null}
                        >
                            <Text
                                variant="bodySmall"
                                style={[
                                    styles.aboutBody,
                                    { color: theme.colors.onSurfaceVariant },
                                ]}
                            >
                                Every JSON file uploaded to the export bucket appears below as its own
                                data source. Files are re-imported when overwritten and removed when
                                deleted from the bucket.
                            </Text>
                        </List.Accordion>
                    </List.AccordionGroup>

                    <View>
                        <List.Subheader>Imported files</List.Subheader>
                        {fileChildren.length === 0 ? (
                            <Text style={{ color: theme.colors.onSurfaceVariant }}>
                                No files yet. Files uploaded to {displayName} will appear here automatically.
                            </Text>
                        ) : (
                            <List.AccordionGroup>
                                {CHILD_GROUPS.map((group) => {
                                    const items = bucketedChildren[group.key] || [];
                                    if (items.length === 0 && !group.alwaysShow) return null;
                                    return (
                                        <List.Accordion
                                            key={group.key}
                                            id={group.key}
                                            title={`${group.title} (${items.length})`}
                                        >
                                            {items.length === 0 ? (
                                                <Text
                                                    style={[
                                                        styles.groupEmpty,
                                                        { color: theme.colors.onSurfaceVariant },
                                                    ]}
                                                >
                                                    {group.emptyText}
                                                </Text>
                                            ) : (
                                                <StackLayout spacing={12} style={styles.groupBody}>
                                                    {items.map((child) => renderChildCard(child))}
                                                </StackLayout>
                                            )}
                                        </List.Accordion>
                                    );
                                })}
                            </List.AccordionGroup>
                        )}
                    </View>

                    {manageDataSourcesPermission && (
                        <StackLayout spacing={10}>
                            <BasicButton
                                label="Check for new files"
                                onPress={handleRescan}
                                disabled={rescanning || disconnecting}
                                loading={rescanning}
                                mode="outlined"
                                fullWidth
                            />
                            <BasicButton
                                label={`Disconnect ${displayName}`}
                                onPress={handleDisconnect}
                                disabled={rescanning || disconnecting}
                                loading={disconnecting}
                                fullWidth
                                danger
                            />
                        </StackLayout>
                    )}
                </StackLayout>
            </ScrollView>
            <DataPreviewModal
                visible={previewOpen}
                status={previewStatus}
                schema={previewSchema}
                rows={previewRows}
                onDismiss={dismissPreview}
            />
        </ResponsiveScreen>
    );
};

const styles = StyleSheet.create({
    content: {
        paddingBottom: 32,
    },
    groupBody: {
        paddingHorizontal: 8,
        paddingBottom: 8,
    },
    groupEmpty: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontStyle: "italic",
    },
    aboutAccordion: {
        backgroundColor: "transparent",
        paddingTop: 0,
        paddingBottom: 0,
        paddingHorizontal: 0,
        minHeight: 0,
        marginTop: -16,
    },
    aboutTitle: {
        fontSize: 13,
        fontWeight: "400",
        marginLeft: -8,
        marginVertical: -4,
    },
    aboutBody: {
        paddingHorizontal: 0,
        paddingBottom: 8,
        paddingTop: 0,
    },
});

export default MicromaxDashboardSettings;
