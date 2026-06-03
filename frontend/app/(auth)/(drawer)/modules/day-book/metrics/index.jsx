// Author(s): Matthew Parkinson, Noah Bradley

import SearchBar from "../../../../../../components/common/input/SearchBar.jsx";
import Divider from "../../../../../../components/layout/Divider.jsx";
import { View, ActivityIndicator, SectionList, Alert } from "react-native";
import Header from "../../../../../../components/layout/Header.jsx";
import { useRouter } from "expo-router";
import { Snackbar, Text, useTheme } from "react-native-paper";
import { useEffect, useState, useCallback, useMemo } from "react";
import { getCurrentUser } from "aws-amplify/auth";
import ResponsiveScreen from "../../../../../../components/layout/ResponsiveScreen.jsx";
import ThemedRefreshControl from "../../../../../../components/common/ThemedRefreshControl.jsx";
import MetricListCard from "../../../../../../components/boards/MetricListCard.jsx";
import SimpleMetricCard from "../../../../../../components/modules/day-book/metrics/cards/SimpleMetricCard.jsx";
import AddMetricToBoardDialog from "../../../../../../components/modules/day-book/metrics/modals/AddMetricToBoardDialog.jsx";
import { hasPermission } from "../../../../../../utils/permissions.js";
import { useMetricContext } from "../../../../../../contexts/MetricContext";
import { useDataSourceContext } from "../../../../../../contexts/DataSourceContext";
import { useBoardContext } from "../../../../../../contexts/BoardContext";
import { useMetricStates } from "../../../../../../hooks/useMetricStates.js";
import boardService from "../../../../../../services/BoardService.jsx";
import { createMetricItem, mapItemsToLayout } from "../../../../../../utils/boards/itemHandlers";

const GRID_COLS = 12;

const MetricManagement = () => {
    const router = useRouter();
    const theme = useTheme();
    const { accessibleMetrics: metrics, loading, ensureMetrics, refresh, deleteMetric } = useMetricContext();
    const { dataSources, refreshDataSources } = useDataSourceContext();
    const { boards, loading: boardsLoading, ensureBoards } = useBoardContext();
    const [currentUserId, setCurrentUserId] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [refreshing, setRefreshing] = useState(false);
    const [manageMetricsPermission, setManageMetricsPermission] = useState(false);
    const [addToBoardState, setAddToBoardState] = useState({ visible: false, metricId: null, submitting: false });
    const [snackbar, setSnackbar] = useState({ visible: false, message: "", boardId: null });

    useEffect(() => {
        loadPermission();
        ensureMetrics();
        ensureBoards?.();
        refreshDataSources?.();
        getCurrentUser().then(({ userId }) => setCurrentUserId(userId)).catch(() => {});
    }, []);

    const items = useMemo(() => {
        return (metrics || []).map((m) => {
            const rawConfig = m.config || {};
            return {
                id: m.metricId,
                type: "metric",
                name: m.name,
                createdBy: m.createdBy,
                config: {
                    ...rawConfig,
                    metricId: m.metricId,
                    dataSourceId: m.dataSourceId,
                    chartType: rawConfig.chartType || rawConfig.type || "line",
                },
            };
        });
    }, [metrics]);

    const { metricStates } = useMetricStates(items);

    const dataSourceById = useMemo(() => {
        const map = {};
        for (const ds of dataSources?.list || []) {
            if (ds?.dataSourceId) map[ds.dataSourceId] = ds;
        }
        return map;
    }, [dataSources]);

    const itemsUser = useMemo(() => {
        if (!currentUserId) return [];
        return items.filter((item) => item.createdBy == currentUserId);
    }, [items, currentUserId]);

    const itemsOther = useMemo(() => {
        if (!currentUserId) return [];
        return items.filter((item) => item.createdBy != currentUserId);
    }, [items, currentUserId]);

    const filteredUser = useMemo(() => {
        const query = (searchQuery || "").trim().toLowerCase();
        if (!query) return itemsUser;
        return itemsUser.filter((item) => (item.name ?? "").toLowerCase().includes(query));
    }, [itemsUser, searchQuery]);

    const filteredOther = useMemo(() => {
        const query = (searchQuery || "").trim().toLowerCase();
        if (!query) return itemsOther;
        return itemsOther.filter((item) => (item.name ?? "").toLowerCase().includes(query));
    }, [itemsOther, searchQuery]);

    async function loadPermission() {
        const manageMetricsPermission = await hasPermission("modules.daybook.metrics.manage_metrics");
        setManageMetricsPermission(manageMetricsPermission);
    }

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await Promise.all([refresh(), refreshDataSources?.()]);
        setRefreshing(false);
    }, [refresh, refreshDataSources]);

    const handleCardPress = useCallback((metricId) => {
        router.navigate(`/modules/day-book/metrics/view-metric/${metricId}`);
    }, [router]);

    const handleEditMetric = useCallback((metricId) => {
        if (!metricId) return;
        router.navigate(`/modules/day-book/metrics/edit-metric/${metricId}`);
    }, [router]);

    const handleDeleteMetric = useCallback((metricId) => {
        if (!metricId) return;
        Alert.alert(
            "Delete Metric",
            "Are you sure you want to delete this metric?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await deleteMetric(metricId);
                        } catch (err) {
                            console.error("[MetricManagement] deleteMetric:", err);
                            Alert.alert("Error", "Failed to delete the metric. Please try again.");
                        }
                    },
                },
            ],
        );
    }, [deleteMetric]);

    const handleAddMetricToBoard = useCallback((metricId) => {
        if (!metricId) return;
        ensureBoards?.();
        setAddToBoardState({ visible: true, metricId, submitting: false });
    }, [ensureBoards]);

    const handleDismissAddToBoard = useCallback(() => {
        setAddToBoardState((prev) => (prev.submitting ? prev : { visible: false, metricId: null, submitting: false }));
    }, []);

    const handleConfirmAddToBoard = useCallback(async (boardId) => {
        const metricId = addToBoardState.metricId;
        if (!metricId || !boardId) return;
        const metric = (metrics || []).find((m) => m.metricId === metricId);
        if (!metric) {
            Alert.alert("Error", "Metric not found.");
            return;
        }
        setAddToBoardState((prev) => ({ ...prev, submitting: true }));
        try {
            const board = await boardService.getBoard(boardId);
            const existingLayout = mapItemsToLayout(board?.items || [], GRID_COLS);
            const newItem = createMetricItem(metric, existingLayout, GRID_COLS);
            await boardService.addItem(boardId, newItem);
            const boardTitle = board?.name || board?.title || board?.config?.title || "the board";
            setAddToBoardState({ visible: false, metricId: null, submitting: false });
            setSnackbar({
                visible: true,
                message: `Added "${metric.name}" to ${boardTitle}.`,
                boardId,
            });
        } catch (err) {
            console.error("[MetricManagement] addMetricToBoard:", err);
            setAddToBoardState((prev) => ({ ...prev, submitting: false }));
            Alert.alert("Error", "Failed to add metric to board. Please try again.");
        }
    }, [addToBoardState.metricId, metrics]);

    const dismissSnackbar = useCallback(() => {
        setSnackbar((prev) => ({ ...prev, visible: false }));
    }, []);

    const handleViewBoard = useCallback(() => {
        const boardId = snackbar.boardId;
        dismissSnackbar();
        if (boardId) router.navigate(`/boards/${boardId}`);
    }, [snackbar.boardId, dismissSnackbar, router]);

    const activeMetricName = useMemo(() => {
        if (!addToBoardState.metricId) return "";
        return (metrics || []).find((m) => m.metricId === addToBoardState.metricId)?.name || "";
    }, [addToBoardState.metricId, metrics]);

    // Single render path for both "created by you" and "created by others"
    // sections via SectionList. Avoids the perf trap of rendering many
    // chart-bearing rows inside a non-virtualized ScrollView.
    // When the user can't manage metrics, skip the ownership split and
    // show everything in one ungrouped section.
    const sections = useMemo(() => {
        const query = (searchQuery || "").trim();
        if (!manageMetricsPermission) {
            const combined = [...filteredUser, ...filteredOther];
            return [{
                key: "all",
                title: null,
                data: combined,
                emptyText: query
                    ? `No metrics found for "${query}".`
                    : "No metrics to display.",
            }];
        }
        const out = [{
            key: "user",
            title: "Created by you",
            data: filteredUser,
            emptyText: query
                ? `No metrics found for "${query}".`
                : "No metrics to display.",
        }];
        if (filteredOther.length > 0) {
            out.push({
                key: "other",
                title: "Created by others",
                data: filteredOther,
                emptyText: null,
            });
        }
        return out;
    }, [filteredUser, filteredOther, searchQuery, manageMetricsPermission]);

    const renderItem = useCallback(({ item }) => {
        const dataSource = dataSourceById?.[item.config?.dataSourceId];
        return (
            <View style={{ paddingHorizontal: 20, paddingBottom: 14 }}>
                {/*<MetricListCard
                    item={item}
                    metricState={metricStates[item.id]}
                    dataSourceName={dataSource?.name}
                    dataSourceColor={dataSource?.colour || dataSource?.color}
                    dataSourceErrored={dataSource?.status === 'error'}
                    onPress={handleCardPress}
                />*/}
                <SimpleMetricCard 
                    item={item}
                    metricState={metricStates[item.id]}
                    dataSourceErrored={dataSource?.status === 'error'}
                    onPress={handleCardPress}
                    onEdit={handleEditMetric}
                    onDelete={handleDeleteMetric}
                    onAddToBoard={handleAddMetricToBoard}
                />
            </View>
        );
    }, [dataSourceById, metricStates, handleCardPress, handleEditMetric, handleDeleteMetric, handleAddMetricToBoard]);

    const renderSectionHeader = useCallback(({ section }) => {
        if (!section.title) return null;
        return (
            <View style={{ paddingHorizontal: 20, paddingTop: section.key === "other" ? 16 : 8, paddingBottom: 14, gap: 14, backgroundColor: theme.colors.background }}>
                {section.key === "other" && <Divider />}
                <Text style={{ fontSize: 16, color: theme.colors.placeholderText }}>
                    {section.title}
                </Text>
            </View>
        );
    }, [theme.colors.placeholderText, theme.colors.background]);

    const renderSectionFooter = useCallback(({ section }) => {
        if (section.data.length > 0 || !section.emptyText) return null;
        return (
            <View style={{ paddingHorizontal: 20, paddingBottom: 14 }}>
                <Text style={{ color: theme.colors.onSurfaceVariant }}>
                    {section.emptyText}
                </Text>
            </View>
        );
    }, [theme.colors.onSurfaceVariant]);

    const keyExtractor = useCallback((item) => item.id, []);

    return (
        <ResponsiveScreen
            header={
                <Header
                    title="Metrics"
                    showMenu
                    showPlus
                    onRightIconPress={() => router.navigate("/modules/day-book/metrics/create-metric")}
                    rightIconPermission={manageMetricsPermission}
                />
            }
            center={false}
            padded={false}
            scroll={false}
        >
            <View style={{ flex: 1 }}>
                <SearchBar 
                    placeholder="Search metrics"
                    onSearch={setSearchQuery}
                />

                {loading ? (
                    <ActivityIndicator size={"large"} />
                ) : (
                    <SectionList
                        sections={sections}
                        keyExtractor={keyExtractor}
                        renderItem={renderItem}
                        renderSectionHeader={renderSectionHeader}
                        renderSectionFooter={renderSectionFooter}
                        stickySectionHeadersEnabled={false}
                        refreshControl={<ThemedRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                        contentContainerStyle={{ paddingBottom: 40 }}
                        initialNumToRender={6}
                        maxToRenderPerBatch={4}
                        windowSize={7}
                        removeClippedSubviews
                    />
                )}
            </View>

            <AddMetricToBoardDialog
                visible={addToBoardState.visible}
                onDismiss={handleDismissAddToBoard}
                onConfirm={handleConfirmAddToBoard}
                boards={boards || []}
                loading={boardsLoading}
                submitting={addToBoardState.submitting}
                metricName={activeMetricName}
            />

            <Snackbar
                visible={snackbar.visible}
                onDismiss={dismissSnackbar}
                duration={5000}
                action={snackbar.boardId ? { label: "View board", onPress: handleViewBoard } : undefined}
            >
                {snackbar.message}
            </Snackbar>
        </ResponsiveScreen>
    )
}

export default MetricManagement;
