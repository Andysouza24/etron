// Author(s): Noah Bradley

import { View, ScrollView, StyleSheet, Alert, ActivityIndicator, Modal, TouchableOpacity } from "react-native";
import { Card, Text, Chip, useTheme } from "react-native-paper";
import Header from "../../../../../../../components/layout/Header";
import { commonStyles } from "../../../../../../../assets/styles/stylesheets/common";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState, useRef } from "react";
import { getWorkspaceId } from "../../../../../../../storage/workspaceStorage";
import GraphTypes from '../graph-types';
import inter from "../../../../../../../assets/styles/fonts/Inter_18pt-Regular.ttf";
import BasicButton from "../../../../../../../components/common/buttons/BasicButton";
import endpoints from "../../../../../../../utils/api/endpoints";
import { apiGet, apiDelete } from "../../../../../../../utils/api/apiClient";
import ResponsiveScreen from "../../../../../../../components/layout/ResponsiveScreen";
import ItemNotFound from "../../../../../../../components/common/errors/MissingItem";
import ViewShot from "react-native-view-shot";
import * as MediaLibrary from "expo-media-library";
import { hasPermission } from "../../../../../../../utils/permissions";
import PermissionGate from "../../../../../../../components/common/PermissionGate";
import { captureRef } from "react-native-view-shot";
import { useHasPermission } from "../../../../../../../hooks/useHasPermission";


const ViewMetric = () => {
    const { metricId } = useLocalSearchParams();
    const [loading, setLoading] = useState(true);
    const [metricSettings, setMetricSettings] = useState(null);
    const [metricData, setMetricData] = useState(null);
    const [metricExists, setMetricExists] = useState(true);
    const [deleting, setDeleting] = useState(false);
    const [coloursState, setColoursState] = useState(["red", "blue", "green", "purple"]);
    const [exporting, setExporting] = useState(false);
    const [exportModalVisible, setExportModalVisible] = useState(false);
    const [backgroundMode, setBackgroundMode] = useState("white");
    const [axisColorModeState, setAxisColorModeState] = useState("dark");
    const { allowed: manageMetricsPermission } = useHasPermission("modules.daybook.metrics.manage_metrics");

    const router = useRouter();
    const viewShotRef = useRef();
    const theme = useTheme();

    useEffect(() => {
        getMetricSettings();
    }, [metricId]);


    async function getMetricSettings() {
        setLoading(true);
        const workspaceId = await getWorkspaceId();

        try {
            const result = await apiGet(endpoints.modules.day_book.metrics.getMetric(metricId), { workspaceId });
            const metricSettings = result.data;
            setMetricSettings(metricSettings);
            if (!metricSettings) {
                setMetricExists(false);
                setLoading(false);
                return;
            }

            const dataResult = await apiGet(
                endpoints.modules.day_book.data_sources.viewDataForMetric(metricSettings.dataSourceId, metricId),
                { workspaceId }
            );
            setMetricData(dataResult.data.data);
        } catch (error) {
            console.error("Error downloading metric:", error);
            setMetricExists(false);
        } finally {
            setLoading(false);
        }
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

    const graphDef = GraphTypes[metricSettings.config.type];
    let filteredData = convertToGraphData(metricData);
    if (metricSettings.config.selectedRows?.length > 0) {
        filteredData = filteredData.filter((row) =>
            metricSettings.config.selectedRows.includes(row[metricSettings.config.independentVariable])
        );
    }

    if (!loading) {
        return (
            <ResponsiveScreen
                header={
                    <Header
                        title="View Metric"
                        showBack
                        showEdit
                        onRightIconPress={() =>
                            router.navigate(`/modules/day-book/metrics/edit-metric/${metricId}`)
                        }
                        rightIconPermission={manageMetricsPermission}
                    />
                }
                center={false}
                loadingOverlayActive={deleting || exporting}
            >
                <Card style={[styles.card]}>
                    <Card.Title title={metricSettings.name} />
                    <Card.Content>
                        <View
                            collapsable={false}
                            style={[styles.graphCardContainer, { backgroundColor: "transparent", padding: 10 }]}
                        >
                            {graphDef.render({
                                data: filteredData,
                                xKey: metricSettings.config.independentVariable,
                                yKeys: metricSettings.config.dependentVariables,
                                colours: metricSettings.config.colours || coloursState,
                                axisColorMode: "dark",
                            })}
                        </View>
                    </Card.Content>
                </Card>

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
                            <Text style={styles.modalTitle}>Export Preview</Text>

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
                                            {graphDef.render({
                                                data: filteredData,
                                                xKey: metricSettings.config.independentVariable,
                                                yKeys: metricSettings.config.dependentVariables,
                                                colours: metricSettings.config.colours || coloursState,
                                                axisColorMode: axisColorModeState,
                                            })}
                                        </View>
                                    </ViewShot>
                                </Card.Content>
                            </Card>

                            {/* Background Selector */}
                            <View style={styles.backgroundSelectorContainer}>
                                <Text style={styles.sectionHeader}>Choose Background</Text>
                                <View style={styles.chipRow}>
                                    {["white", "black", "transparent"].map((color) => (
                                        <Chip
                                            key={color}
                                            selected={backgroundMode === color}
                                            onPress={() => setBackgroundMode(color)}
                                            style={{
                                                marginHorizontal: 4,
                                                backgroundColor: backgroundMode === color ? theme.colors.primary : "transparent",
                                            }}
                                        >
                                            {color.charAt(0).toUpperCase() + color.slice(1)}
                                        </Chip>
                                    ))}
                                </View>
                            </View>

                            {/* Axis Colour Selector */}
                            <View style={styles.axisSelectorContainer}>
                                <Text style={styles.sectionHeader}>Axis Colours</Text>
                                <View style={styles.chipRow}>
                                    {["dark", "light"].map((mode) => (
                                        <Chip
                                            key={mode}
                                            selected={axisColorModeState === mode}
                                            onPress={() => setAxisColorModeState(mode)}
                                            style={{
                                                marginHorizontal: 4,
                                                backgroundColor: axisColorModeState === mode ? theme.colors.primary : "transparent",
                                            }}
                                        >
                                            {mode === "dark" ? "White" : "Black"}
                                        </Chip>
                                    ))}
                                </View>
                            </View>

                            <View style={styles.buttonRow}>
                                <BasicButton
                                    label="Cancel"
                                    onPress={() => setExportModalVisible(false)}
                                    style={styles.modalCloseButton}
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
        fontSize: 18,
        fontWeight: "bold",
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
    backgroundSelectorContainer: {
        width: "100%",
        alignItems: "Left",
        marginBottom: 16,
    },
    sectionHeader: {
        fontSize: 16,
        fontWeight: "600",
        marginBottom: 8,
    },
    chipRow: {
        flexDirection: "row",
        justifyContent: "left",
        flexWrap: "wrap",
        gap: 8,
    },
    axisSelectorContainer: {
        width: "100%",
        alignItems: "left",
        marginBottom: 16,
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
    modalCloseButton: {
        flex: 1,
        marginLeft: 8,
    },
});
