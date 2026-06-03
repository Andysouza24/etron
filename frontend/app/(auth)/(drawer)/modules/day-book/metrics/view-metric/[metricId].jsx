// Author(s): Noah Bradley

import { View, StyleSheet, Alert, ActivityIndicator, Modal } from "react-native";
import { Card, Chip, List, Text, useTheme } from "react-native-paper";
import Header from "../../../../../../../components/layout/Header";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState, useRef } from "react";
import { getWorkspaceId } from "../../../../../../../storage/workspaceStorage";
import GraphTypes from '../../../../../../../components/modules/day-book/metrics/graph-types';
import MetricGraph, { USE_AGGREGATION_VIEW } from '../../../../../../../components/modules/day-book/metrics/MetricGraph';
import MetricViewer from '../../../../../../../components/modules/day-book/metrics/MetricViewer';
import { NEXT_AGGREGATION_PERIOD } from '../../../../../../../utils/metricAggregationPeriod';
import metricDataService from "../../../../../../../services/MetricDataService";
import BasicButton from "../../../../../../../components/common/buttons/BasicButton";
import endpoints from "../../../../../../../utils/api/endpoints";
import { apiGet, apiDelete } from "../../../../../../../utils/api/apiClient";
import ResponsiveScreen from "../../../../../../../components/layout/ResponsiveScreen";
import ItemNotFound from "../../../../../../../components/common/errors/MissingItem";
import ViewShot from "react-native-view-shot";
import * as MediaLibrary from "expo-media-library";
import PermissionGate from "../../../../../../../components/common/PermissionGate";
import { captureRef } from "react-native-view-shot";
import { useHasPermission } from "../../../../../../../hooks/useHasPermission";
import ExportChipGroup from "../../../../../../../components/common/ExportChipGroup";
import DataSourceErrorNotice from "../../../../../../../components/boards/DataSourceErrorNotice";
import { formatMetricValue, formatRangeValue } from "../../../../../../../utils/boards/boardUtils";
import { useMetricContext } from "../../../../../../../contexts/MetricContext";

// TODO: fix, graph view does not reflect settings applied during metric creation and the preview displayed during metric creation.

const ViewMetric = () => {
    const { metricId } = useLocalSearchParams();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [metricSettings, setMetricSettings] = useState(null);
    // Full response bundle (preferred) — includes `periods` so toggling the
    // aggregation view never triggers a refetch.
    const [metricResponse, setMetricResponse] = useState(null);
    const [metricData, setMetricData] = useState([]);
    const [metricYKeys, setMetricYKeys] = useState([]);
    const [availableYears, setAvailableYears] = useState(null);
    const [selectedYear, setSelectedYear] = useState(null);
    const [metricExists, setMetricExists] = useState(true);
    const [deleting, setDeleting] = useState(false);
    const [coloursState, setColoursState] = useState(["red", "blue", "green", "purple"]);
    const [exporting, setExporting] = useState(false);
    const [exportModalVisible, setExportModalVisible] = useState(false);
    const [backgroundMode, setBackgroundMode] = useState("white");
    const [axisColorModeState, setAxisColorModeState] = useState("dark");
    const [dataSource, setDataSource] = useState(null);
    const [creatorName, setCreatorName] = useState(null);
    const [aggregationPeriod, setAggregationPeriod] = useState("daily");
    const { allowed: manageMetricsPermission } = useHasPermission("modules.daybook.metrics.manage_metrics");
    const { allowed: viewDataPermission } = useHasPermission("modules.daybook.datasources.view_data");
    // metadata + averages accordion are gated behind either permission so
    // users without data access don't see derived statistics about it.
    const canViewDetails = manageMetricsPermission || viewDataPermission;
    // Data source update counter — bumps when AppSync notifies us that the
    // underlying data has changed. We re-fetch the metric whenever it bumps
    // so the displayed values are always up to date.
    const { dataUpdateVals } = useMetricContext();
    const dataSourceId = metricSettings?.dataSourceId;
    const dataVersion = dataSourceId ? dataUpdateVals?.[dataSourceId] : undefined;
    // Refs to read the latest values without being subject to async closure
    // staleness inside `getMetricSettings`.
    const dataUpdateValsRef = useRef(dataUpdateVals);
    useEffect(() => {
        dataUpdateValsRef.current = dataUpdateVals;
    }, [dataUpdateVals]);

    const router = useRouter();
    const viewShotRef = useRef();
    const theme = useTheme();

    useEffect(() => {
        getMetricSettings();
    }, [metricId]);

    // The version-watch effect needs a baseline that represents "what
    // version did the most recent fetch run against?". We mark it as set
    // only after `getMetricSettings` finishes its initial load so the very
    // first effect run after mount doesn't swallow a version that bumped
    // mid-fetch. Reset whenever the route's metricId changes so a previous
    // metric's baseline never leaks into the new one.
    const lastSeenDataVersionRef = useRef(undefined);
    const [versionBaselineSet, setVersionBaselineSet] = useState(false);
    useEffect(() => {
        lastSeenDataVersionRef.current = undefined;
        setVersionBaselineSet(false);
    }, [metricId]);

    // When the data source data changes (AppSync push bumps dataUpdateVals),
    // re-pull the metric so the values shown stay current. Skips until the
    // initial load has snapshotted the baseline version, otherwise the
    // first run after mount would just adopt whatever value happens to be
    // current and never trigger a refresh.
    useEffect(() => {
        if (!metricSettings || !dataSourceId) return;
        if (!versionBaselineSet) return;
        if (lastSeenDataVersionRef.current === dataVersion) return;
        lastSeenDataVersionRef.current = dataVersion;
        // Drop cached bundles for this data source so subsequent reads
        // can't serve a stale slice keyed under the previous version.
        metricDataService.clearCacheForDataSource(dataSourceId);
        refetchForYear(selectedYear ?? "all");
    }, [dataVersion, dataSourceId, metricSettings, versionBaselineSet]);

    // Derive the displayed rows from the cached response + currently
    // selected period. When the backend ships a multi-period bundle this
    // makes the toggle instantaneous (no network call); otherwise we fall
    // back to `response.data`.
    useEffect(() => {
        if (!metricResponse || !metricSettings) return;
        const sliced = metricDataService.getPeriodSlice(metricResponse, aggregationPeriod);
        const { data, yKeys } = metricDataService.buildChartPayload(
            { ...metricResponse, data: sliced },
            metricSettings.config
        );
        setMetricData(data);
        setMetricYKeys(yKeys);
    }, [metricResponse, aggregationPeriod, metricSettings]);


    async function getMetricSettings() {
        setLoading(true);
        const workspaceId = await getWorkspaceId();

        try {
            const result = await apiGet(endpoints.modules.day_book.metrics.getMetric(metricId), { workspaceId });
            const settings = result.data;
            setMetricSettings(settings);
            if (!settings) {
                setMetricExists(false);
                setLoading(false);
                return;
            }

            // No aggregatePeriod here — the backend returns all four
            // periods in one bundle and the period derivation effect picks
            // the right slice.
            const initialDataVersion = dataUpdateValsRef.current?.[settings.dataSourceId];
            const response = await metricDataService.fetchAllPages(
                metricId,
                settings.dataSourceId,
                { year: "all", dataVersion: initialDataVersion },
                {
                    onPage: (page) => {
                        // Render rows as each page lands so the user sees the
                        // chart fill in instead of waiting for the full set.
                        setMetricResponse(page);
                        if (page.availableYears) setAvailableYears(page.availableYears);
                        setSelectedYear(page.appliedFilter?.year ?? null);
                    },
                }
            );
            if (response) {
                setMetricResponse(response);
                setAvailableYears(response.availableYears);
                setSelectedYear(response.appliedFilter?.year ?? null);
            }
            // Snapshot the version we just fetched against. If AppSync
            // bumped to a newer value while the fetch was in flight, the
            // version-watch effect will see the mismatch on its next run
            // and trigger a refresh so the displayed values stay current.
            lastSeenDataVersionRef.current = initialDataVersion;
            setVersionBaselineSet(true);

            // also fetch the underlying data source so we can surface an
            // error banner if it is currently flagged as errored, and so we
            // can render its name/colour chip and meta details.
            try {
                const dsResult = await apiGet(
                    endpoints.modules.day_book.data_sources.getDataSource(settings.dataSourceId),
                    { workspaceId }
                );
                setDataSource(dsResult?.data ?? null);
            } catch (dsErr) {
                const isPermissionError = (
                    dsErr?.response?.status === 400 ||
                    dsErr?.message?.includes('Server error 400')
                ) && (
                    dsErr?.response?.data?.error?.includes('permission') ||
                    dsErr?.response?.data?.message?.includes('permission') ||
                    dsErr?.message?.includes('permission')
                );
                if (!isPermissionError) {
                    console.error("Error loading data source status:", dsErr);
                }
            }

            // fetch the creator's profile so the meta section can show the
            // user's display name rather than just their id.
            if (settings.createdBy) {
                try {
                    const userResult = await apiGet(
                        endpoints.workspace.users.getUser(workspaceId, settings.createdBy)
                    );
                    const userData = userResult?.data;
                    if (userData) {
                        const fullName = [userData.given_name, userData.family_name]
                            .filter(Boolean)
                            .join(" ");
                        setCreatorName(fullName || userData.email || null);
                    }
                } catch (userErr) {
                    console.error("Error loading metric creator:", userErr);
                }
            }
        } catch (error) {
            console.error("Error downloading metric:", error);
            setMetricExists(false);
        } finally {
            setLoading(false);
        }
    }

    async function refetchForYear(year) {
        if (!metricSettings) return;
        setRefreshing(true);
        try {
            const response = await metricDataService.fetchAllPages(
                metricId,
                metricSettings.dataSourceId,
                { year, dataVersion: dataUpdateValsRef.current?.[metricSettings.dataSourceId] },
                {
                    onPage: (page) => {
                        setMetricResponse(page);
                        setSelectedYear(page.appliedFilter?.year ?? year);
                        if (page.availableYears) setAvailableYears(page.availableYears);
                    },
                }
            );
            if (response) {
                setMetricResponse(response);
                setSelectedYear(response.appliedFilter?.year ?? year);
                if (response.availableYears) setAvailableYears(response.availableYears);
            }
        } catch (err) {
            console.error("Error refetching metric for year:", err);
        } finally {
            setRefreshing(false);
        }
    }

    // Apply a new aggregation period. The backend already shipped every
    // period in the cached response, so this is a pure local switch — no
    // network call. The derivation effect above re-slices the response
    // whenever `aggregationPeriod` changes.
    function cycleAggregationPeriod(next) {
        if (!metricSettings) return;
        const resolved = next || NEXT_AGGREGATION_PERIOD[aggregationPeriod] || "daily";
        setAggregationPeriod(resolved);
    }

    async function exportGraphToCameraRoll() {
        try {
            setExporting(true);
        
            const { status } = await MediaLibrary.requestPermissionsAsync();
            if (status !== "granted") {
                Alert.alert("Permission Required", "Please allow access to save images to your gallery.");
                return;
            }
        
            // Wait briefly to ensure rendering completes
            await new Promise((resolve) => setTimeout(resolve, 200));
        
            await new Promise(resolve => setTimeout(resolve, 300));
            const uri = await captureRef(viewShotRef, { format: "png", quality: 1.0 });
            if (!uri) throw new Error("Failed to capture graph view.");
        
            await MediaLibrary.saveToLibraryAsync(uri);
            Alert.alert("Success", "Graph exported to camera roll successfully!");
        } catch (error) {
            console.error("Error exporting graph:", error);
            Alert.alert("Error", "Failed to export graph. Please try again.");
        } finally {
            setExporting(false);
        }
    }

    async function deleteMetric() {
        const confirmed = await new Promise((resolve) => {
            Alert.alert("Delete Metric", "Are you sure you want to delete this metric?", [
                { text: "Cancel", onPress: () => resolve(false), style: "cancel" },
                { text: "Delete", onPress: () => resolve(true), style: "destructive" },
            ]);
        });

        if (!confirmed) return;

        try {
            setDeleting(true);
            const workspaceId = await getWorkspaceId();
            await apiDelete(endpoints.modules.day_book.metrics.removeMetric(metricId), { workspaceId });
            router.navigate("/modules/day-book/metrics");
        } catch (error) {
            console.error("Error deleting metric:", error);
            Alert.alert("Error", "Failed to delete the metric. Please try again.");
        } finally {
            setDeleting(false);
        }
    }

    function convertToGraphData(rows) {
        const { independentVariable, dependentVariables } = metricSettings.config;
        const graphRows = rows.map(row => {
            const newRow = {};
            newRow[independentVariable] = Number(row[independentVariable]) || row[independentVariable];
            for (const key of dependentVariables) {
                const valueAsNumber = Number(row[key]);
                newRow[key] = !isNaN(valueAsNumber) ? valueAsNumber : row[key];
            }

            return newRow;
        });
        return graphRows;
    }

    if (loading || !metricExists) {
        return (
            <ResponsiveScreen
                header={
                    <Header title="View Metric" showBack />
                }
                center={metricExists ? false : true}
                padded={false}
                scroll={false}
            >
                {metricExists ? (
                    <ActivityIndicator size="large" />
                ) : (
                    <ItemNotFound
                        icon = "alert-circle-outline"
                        item = "metric"
                        itemId = {metricId}
                        listRoute = "/modules/day-book/metrics/"
                    />
                )}
            </ResponsiveScreen>
        ) 
    }

    const graphDef = GraphTypes[metricSettings.config.type] || GraphTypes[metricSettings.config.graphType];
    const filteredData = metricData;
    const yKeys = metricYKeys.length > 0 ? metricYKeys : (metricSettings.config.dependentVariables || []);
    const dataSourceErrored = dataSource?.status === 'error';
    const dataSourceName = dataSource?.name || 'Unknown data source';
    const dataSourceColor = dataSource?.colour || dataSource?.color;
    const chipBackground = dataSourceColor || theme.colors.secondaryContainer;
    const chipTextColor = dataSourceColor ? theme.colors.onSecondary : theme.colors.onSecondaryContainer;

    const formatDateTime = (value) => {
        if (!value) return 'Unknown';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return 'Unknown';
        return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    };
    const formatDate = (value) => {
        if (!value) return 'Unknown';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return 'Unknown';
        return date.toLocaleDateString();
    };

    const independentVariable = metricSettings.config.independentVariable;
    const xValues = independentVariable
        ? filteredData
            .map(row => row?.[independentVariable])
            .filter(v => v !== undefined && v !== null)
        : [];
    const rangeText = (() => {
        if (xValues.length === 0) return 'Not available';
        if (xValues.length === 1) return formatRangeValue(xValues[0]);
        return `${formatRangeValue(xValues[0])} to ${formatRangeValue(xValues[xValues.length - 1])}`;
    })();

    const summaries = yKeys
        .map(variable => ({ variable, summary: metricDataService.getMetricSummary(filteredData, variable) }))
        .filter(entry => entry.summary.count > 0);

    // Widen the graph slightly when any dependent variable dips below zero
    // so the axis label and negative-value region have enough vertical room.
    const hasNegativeValues = summaries.some(
        ({ summary }) => Number.isFinite(summary?.min) && summary.min < 0
    );
    const graphAspectRatio = hasNegativeValues ? 5 / 6 : 1;

    const metaItems = [
        { label: 'Created by', value: creatorName || 'Unknown' },
        { label: 'Created on', value: formatDate(metricSettings.createdAt) },
        { label: 'Data points', value: String(filteredData.length) },
        { label: 'Date range', value: rangeText },
        { label: 'Data source', value: dataSourceName },
    ];

    if (!loading) {
        return (
            <ResponsiveScreen
                header={
                    <Header
                        title={metricSettings.name}
                        showBack
                        rightActions={[
                            ...(manageMetricsPermission ? [{
                                key: 'settings',
                                icon: 'cog',
                                onPress: () => router.navigate(`/modules/day-book/metrics/settings/${metricId}`),
                            }] : []),
                            {
                                key: 'edit',
                                icon: 'pencil',
                                onPress: () => router.navigate(`/modules/day-book/metrics/edit-metric/${metricId}`),
                                disabled: !manageMetricsPermission,
                            },
                        ]}
                    />
                }
                center={false}
                loadingOverlayActive={deleting || exporting}
            >
                {dataSourceErrored ? (
                    <DataSourceErrorNotice />
                ) : null}

                <MetricViewer
                    config={metricSettings.config}
                    data={filteredData}
                    yKeys={yKeys}
                    colours={metricSettings.config.colours || coloursState}
                    axisColorMode={theme.dark ? "dark" : "light"}
                    availableYears={availableYears}
                    selectedYear={selectedYear}
                    onYearChange={refetchForYear}
                    loading={refreshing}
                    aliases={metricSettings.config.fieldAliases || {}}
                    aggregationPeriod={aggregationPeriod}
                    onAggregationPeriodChange={cycleAggregationPeriod}
                    showAggregationToggle={USE_AGGREGATION_VIEW}
                    toggleColors={{ backgroundColor: chipBackground, textColor: chipTextColor }}
                    headerLeft={(
                        <Text
                            style={[styles.lastUpdateText, { color: theme.colors.onSurfaceVariant }]}
                            numberOfLines={1}
                        >
                            {`Last updated ${formatDateTime(metricSettings.updatedAt)}`}
                        </Text>
                    )}
                    headerRight={USE_AGGREGATION_VIEW ? undefined : (
                        <Chip
                            compact
                            style={[styles.dataSourceChip, { backgroundColor: chipBackground }]}
                            textStyle={[styles.dataSourceChipText, { color: chipTextColor }]}
                        >
                            {dataSourceName}
                        </Chip>
                    )}
                    renderGraphContainer={(graphNode) => (
                        <View
                            collapsable={false}
                            style={[styles.graphContainer, { aspectRatio: graphAspectRatio }]}
                            pointerEvents="box-none"
                        >
                            {graphNode}
                        </View>
                    )}
                />

                {canViewDetails ? (
                <View style={styles.metaContainer}>
                    <View style={styles.metaGrid}>
                        {metaItems.map(({ label, value }) => (
                            <View style={styles.metaItem} key={label}>
                                <Text style={[styles.metaLabel, { color: theme.colors.onSurfaceVariant }]}>
                                    {label}
                                </Text>
                                <Text
                                    style={[styles.metaValue, { color: theme.colors.onSurface }]}
                                    numberOfLines={2}
                                >
                                    {value}
                                </Text>
                            </View>
                        ))}
                    </View>

                    {(yKeys.length > 0 || summaries.length > 0) ? (
                        <List.AccordionGroup>
                            <List.Accordion
                                id="metric-values"
                                title="Values tracked & averages"
                                titleStyle={styles.accordionTitle}
                                style={styles.accordion}
                            >
                                {yKeys.length > 0 ? (
                                    <View style={styles.accordionContent}>
                                        <Text style={[styles.metaLabel, { color: theme.colors.onSurfaceVariant }]}>
                                            Values tracked
                                        </Text>
                                        <View style={styles.chipRow}>
                                            {yKeys.map(variable => {
                                                const aliasName = metricSettings.config.fieldAliases?.[variable];
                                                return (
                                                    <Chip
                                                        key={`var-${variable}`}
                                                        mode="outlined"
                                                        compact
                                                        style={styles.chip}
                                                    >
                                                        {aliasName || variable}
                                                    </Chip>
                                                );
                                            })}
                                        </View>
                                    </View>
                                ) : null}

                                {summaries.length > 0 ? (
                                    <View style={styles.accordionContent}>
                                        <Text style={[styles.metaLabel, { color: theme.colors.onSurfaceVariant }]}>
                                            Averages
                                        </Text>
                                        <View style={styles.chipRow}>
                                            {summaries.map(({ variable, summary }) => {
                                                const aliasName = metricSettings.config.fieldAliases?.[variable] || variable;
                                                return (
                                                    <Chip
                                                        key={`avg-${variable}`}
                                                        mode="outlined"
                                                        compact
                                                        style={styles.chip}
                                                        accessibilityLabel={`${aliasName} average: ${formatMetricValue(summary.avg)}`}
                                                    >
                                                        {`${aliasName}: avg ${formatMetricValue(summary.avg)}`}
                                                    </Chip>
                                                );
                                            })}
                                        </View>
                                    </View>
                                ) : null}
                            </List.Accordion>
                        </List.AccordionGroup>
                    ) : null}
                </View>
                ) : null}

                <View style={styles.buttonRow}>
                    <PermissionGate
                        allowed={manageMetricsPermission}
                    >
                        <BasicButton
                            label="Delete"
                            onPress={deleteMetric}
                            style={styles.button}
                            danger
                        />
                    </PermissionGate>
                    
                    <PermissionGate
                        allowed={manageMetricsPermission}
                    >
                        <BasicButton
                            label="Export"
                            onPress={() => setExportModalVisible(true)}
                            style={styles.button}
                            disabled={exporting}
                        />
                    </PermissionGate>
                </View>

                {/* Export Preview Modal */}
                <Modal
                    animationType="slide"
                    transparent={true}
                    visible={exportModalVisible}
                    onRequestClose={() => setExportModalVisible(false)}
                >
                    <View style={styles.modalOverlay}>
                        <View style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}>
                            <Text variant="titleMedium" style={styles.modalTitle}>Export Preview</Text>

                            {/* Graph Preview */}
                            <Card style={[styles.modalCard]}>
                                <Card.Title title={metricSettings.name} />
                                <Card.Content>
                                    <ViewShot
                                        ref={viewShotRef}
                                        options={{ format: "png", quality: 1.0, result: "tmpfile" }}
                                        style={{ backgroundColor: backgroundMode === "transparent" ? "transparent" : backgroundMode }}
                                    >
                                        <View
                                            style={[
                                                styles.graphCardContainer,
                                                {
                                                    backgroundColor:
                                                        backgroundMode === "transparent"
                                                            ? "transparent"
                                                            : backgroundMode,
                                                    padding: 10,
                                                },
                                            ]}
                                        >
                                            <MetricGraph
                                                config={metricSettings.config}
                                                data={filteredData}
                                                yKeys={yKeys}
                                                colours={metricSettings.config.colours || coloursState}
                                                axisColorMode={axisColorModeState}
                                                compact
                                            />
                                        </View>
                                    </ViewShot>
                                </Card.Content>
                            </Card>

                            <ExportChipGroup
                                backgroundMode={backgroundMode}
                                onBackgroundChange={setBackgroundMode}
                                axisColorMode={axisColorModeState}
                                onAxisColorChange={setAxisColorModeState}
                            />

                            <View style={styles.buttonRow}>
                                <BasicButton
                                    label="Cancel"
                                    onPress={() => setExportModalVisible(false)}
                                    style={styles.modalCloseButtonBottom}
                                    danger
                                />

                                <BasicButton 
                                    label="Export" 
                                    onPress={exportGraphToCameraRoll} 
                                    style={styles.exportButton} 
                                    disabled={exporting} 
                                />
                            </View>
                        </View>
                    </View>
                </Modal>
            </ResponsiveScreen>
        );
    };
};

export default ViewMetric;

const styles = StyleSheet.create({
    container: { 
        flex: 1 
    },
    subheadingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 12,
    },
    lastUpdateText: {
        flex: 1,
        fontSize: 13,
    },
    dataSourceChip: {
        alignSelf: 'center',
    },
    dataSourceChipText: {
        fontSize: 12,
    },
    graphContainer: {
        // Pull the chart toward the screen edges so the y-axis labels sit
        // closer to the left without being clipped. ResponsiveScreen adds
        // 20px horizontal padding; we reclaim most of the left side and a
        // small amount on the right to keep the chart balanced.
        marginLeft: -20,
        marginRight: -4,
        marginBottom: 4,
    },
    metaContainer: {
        marginTop: 4,
        marginBottom: 8,
    },
    metaGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 8,
    },
    metaItem: {
        width: '50%',
        marginBottom: 12,
    },
    metaSection: {
        marginTop: 8,
    },
    accordion: {
        paddingHorizontal: 0,
    },
    accordionTitle: {
        fontSize: 14,
        fontWeight: '600',
    },
    accordionContent: {
        paddingHorizontal: 16,
        paddingBottom: 12,
    },
    metaLabel: {
        fontSize: 11,
        textTransform: 'uppercase',
        opacity: 0.7,
        marginBottom: 4,
        fontWeight: '600',
    },
    metaValue: {
        fontSize: 14,
        fontWeight: '500',
    },
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 8,
    },
    chip: {
        marginBottom: 0,
    },
    card: { 
        marginTop: 20, 
        alignSelf: "center" 
    },
    graphCardContainer: { 
        aspectRatio: 3 / 2, 
        width: "100%" 
    },
    button: { 
        alignSelf: "flex-end" },
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.6)",
        justifyContent: "center",
        alignItems: "center",
    },
    modalContainer: {
        width: "90%",
        borderRadius: 16,
        padding: 20,
        alignItems: "center",
    },
    modalTitle: {
        marginBottom: 12,
    },
    modalCard: {
        width: "100%",
        marginBottom: 20,
    },
    modalCloseButton: {
        alignSelf: "center",
        marginTop: 10,
    },
    buttonRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        marginTop: 16,
    },
    exportButton: {
        flex: 1,
        marginRight: 8,
    },
    modalCloseButtonBottom: {
        flex: 1,
        marginLeft: 8,
    },
});
