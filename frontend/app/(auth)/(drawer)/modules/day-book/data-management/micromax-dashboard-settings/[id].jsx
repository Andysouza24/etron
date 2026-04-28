// settings screen for the Micromax Dashboard parent connection

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { ActivityIndicator, List, Text, useTheme } from "react-native-paper";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";

import ResponsiveScreen from "../../../../../../../components/layout/ResponsiveScreen";
import Header from "../../../../../../../components/layout/Header";
import StackLayout from "../../../../../../../components/layout/StackLayout";
import BasicButton from "../../../../../../../components/common/buttons/BasicButton";
import DataConnectionCard from "../../../../../../../components/modules/day-book/data-sources/DataConnectionCard";

import { useDataSourceContext } from "../../../../../../../contexts/DataSourceContext";
import { useHasPermission } from "../../../../../../../hooks/useHasPermission";

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
    } = useDataSourceContext();
    const { allowed: manageDataSourcesPermission } = useHasPermission(
        "modules.daybook.datasources.manage_dataSources"
    );

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
    const fileChildren = useMemo(
        () =>
            list.filter(
                (s) =>
                    (s.sourceType || s.type) === "micromax-dashboard-file" &&
                    s.config?.parentDataSourceId === parentId
            ),
        [list, parentId]
    );

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
            await rescanMicromaxDashboard(parent.dataSourceId);
            // TODO: Replace Alert.alert with a Paper Snackbar once a shared Snackbar component is available.
            Alert.alert(
                "Refresh started",
                "Re-importing your files now. They'll update in a moment."
            );
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
            // TODO: Replace Alert.alert with a Paper Snackbar once a shared Snackbar component is available.
            Alert.alert(
                "Refresh started",
                `${child.name} will refresh in a moment.`
            );
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
            "Disconnect Micromax Dashboard?",
            "Disconnecting will remove every file data source and its imported data. Your original files in Micromax Dashboard are not affected.",
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
                                err?.message || "Unable to disconnect Micromax Dashboard"
                            );
                            setDisconnecting(false);
                        }
                    },
                },
            ]
        );
    };

    if (!parent) {
        return (
            <ResponsiveScreen
                header={<Header title="Micromax Dashboard" showBack />}
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
            header={<Header title="Micromax Dashboard" showBack />}
            center={false}
            padded
            scroll={false}
        >
            <ScrollView
                contentContainerStyle={styles.content}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={theme.colors.primary}
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
                    </View>

                    <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                        Every JSON file uploaded to the export bucket appears below as its own
                        data source. Files are re-imported when overwritten and removed when
                        deleted from the bucket.
                    </Text>

                    {manageDataSourcesPermission && (
                        <StackLayout spacing={10}>
                            <BasicButton
                                label="Check for new files"
                                onPress={handleRescan}
                                disabled={rescanning || disconnecting}
                                loading={rescanning}
                                mode="outlined"
                                fullWidth={false}
                            />
                            <BasicButton
                                label="Disconnect Micromax Dashboard"
                                onPress={handleDisconnect}
                                disabled={rescanning || disconnecting}
                                loading={disconnecting}
                                fullWidth={false}
                                danger
                            />
                        </StackLayout>
                    )}

                    <View>
                        <List.Subheader>Imported files</List.Subheader>
                        {fileChildren.length === 0 ? (
                            <Text style={{ color: theme.colors.onSurfaceVariant }}>
                                No files yet. Files uploaded to Micromax Dashboard will appear here automatically.
                            </Text>
                        ) : (
                            <StackLayout spacing={12}>
                                {fileChildren.map((child) => {
                                    const isRefreshingThis = refreshingChildId === child.dataSourceId;
                                    return (
                                        <DataConnectionCard
                                            key={child.dataSourceId}
                                            label={child.name}
                                            subtitle={
                                                isRefreshingThis
                                                    ? "Refreshing..."
                                                    : child.lastUpdate
                                                        ? `Last updated ${formatDate(child.lastUpdate)}`
                                                        : "Not imported yet"
                                            }
                                            status={child.status}
                                            onNavigate={() =>
                                                router.navigate(
                                                    `/modules/day-book/data-management/view-data-source/${child.dataSourceId}`
                                                )
                                            }
                                            onSettings={() =>
                                                router.navigate(
                                                    `/modules/day-book/data-management/edit-data-source/${child.dataSourceId}`
                                                )
                                            }
                                            onSync={
                                                manageDataSourcesPermission && !isRefreshingThis
                                                    ? () => handleRescanChild(child)
                                                    : undefined
                                            }
                                            manageDataSourceAllowed={manageDataSourcesPermission}
                                        />
                                    );
                                })}
                            </StackLayout>
                        )}
                    </View>
                </StackLayout>
            </ScrollView>
        </ResponsiveScreen>
    );
};

const styles = StyleSheet.create({
    content: {
        paddingBottom: 32,
    },
});

export default MicromaxDashboardSettings;
