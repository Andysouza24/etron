// Author(s): Matthew Parkinson, Noah Bradley

import { View, ScrollView, ActivityIndicator, StyleSheet, Alert } from "react-native";
import { Text, useTheme, Card } from "react-native-paper";
import Header from "../../../../../../components/layout/Header.jsx";
import ResponsiveScreen from "../../../../../../components/layout/ResponsiveScreen.jsx";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState, useRef, forwardRef, useImperativeHandle } from "react";
import { apiGet } from "../../../../../../utils/api/apiClient.jsx";
import endpoints from "../../../../../../utils/api/endpoints.js";
import GraphTypes from "../../../../../../components/modules/day-book/metrics/graph-types";
import { getWorkspaceId } from "../../../../../../storage/workspaceStorage.jsx";
import ViewShot from "react-native-view-shot";
import * as MediaLibrary from "expo-media-library";
import * as FileSystem from "expo-file-system";
import BasicButton from "../../../../../../components/common/buttons/BasicButton.jsx";
import ExportChipGroup from "../../../../../../components/common/ExportChipGroup";

const ViewMetrics = () => {
    const { ids } = useLocalSearchParams();
    const router = useRouter();
    const theme = useTheme();
    const [loading, setLoading] = useState(true);
    const [metricsData, setMetricsData] = useState([]);
    const [hasPermission, setHasPermission] = useState(null);
    const [imageUrls, setImageUrls] = useState([]);
    const selectedIds = ids ? JSON.parse(ids) : [];
    const [backgroundMode, setBackgroundMode] = useState("white");
    const [axisColorModeState, setAxisColorModeState] = useState("dark");

    const metricRefs = useRef([]);

    useEffect(() => {
        const requestPermission = async () => {
            const { status } = await MediaLibrary.requestPermissionsAsync();
            setHasPermission(status === "granted");
        };
        requestPermission();

        const fetchAllMetrics = async () => {
            if (selectedIds.length === 0) {
                setLoading(false);
                return;
            }

            try {
                const workspaceId = await getWorkspaceId();
                const metricsPromises = selectedIds.map(async (id) => {
                    const metricResult = await apiGet(
                        endpoints.modules.day_book.metrics.getMetric(id),
                        { workspaceId }
                    );
                    const settings = metricResult.data;

                    const dataResult = await apiGet(
                        endpoints.modules.day_book.data_sources.viewDataForMetric(
                            settings.dataSourceId,
                            id
                        ),
                        { workspaceId }
                    );

                    let filteredData = convertToGraphData(dataResult.data.data, settings);

                    const selRows = settings?.config?.selectedRows;
                    const indep = settings?.config?.independentVariable;
                    if (Array.isArray(selRows) && selRows.length > 0 && indep) {
                        filteredData = filteredData.filter((row) =>
                            selRows.includes(row[indep])
                        );
                    }

                    return { metricId: id, settings, filteredData };
                });

                const results = await Promise.all(metricsPromises);
                setMetricsData(results);
            } catch (error) {
                console.error("Error fetching metrics:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchAllMetrics();
    }, [ids]);

    const handleExportAll = async () => {
        if (!hasPermission) {
            Alert.alert("Permission required", "Please allow access to save images.");
            return;
        }

        const urls = [];

        for (const ref of metricRefs.current) {
            if (ref?.exportGraph) {
                const url = await ref.exportGraph();
                if (url) urls.push(url);
            }
        }

        setImageUrls(urls);
        Alert.alert("Success", "All graphs exported and URLs generated!");

        console.log("Image URLs:", urls);
    };

    if (loading) {
        return (
            <ResponsiveScreen
                header={<Header title="Selected Metrics" showBack onBack={() => router.back()} />}
                padded
            >
                <View style={styles.centered}>
                    <ActivityIndicator />
                    <Text style={{ marginTop: 10, color: theme.colors.placeholderText }}>
                        Loading graphs...
                    </Text>
                </View>
            </ResponsiveScreen>
        );
    }

    if (metricsData.length === 0) {
        return (
            <ResponsiveScreen
                header={<Header title="Selected Metrics" showBack onBack={() => router.back()} />}
                padded
            >
                <View style={styles.centered}>
                    <Text style={{ color: theme.colors.placeholderText }}>
                        No metrics selected or found.
                    </Text>
                </View>
            </ResponsiveScreen>
        );
    }

    return (
        <ResponsiveScreen
            header={<Header title="Selected Metrics" showBack onBack={() => router.back()} />}
            padded
        >
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ gap: 25, paddingVertical: 20 }}
            >
                <ExportChipGroup
                    backgroundMode={backgroundMode}
                    onBackgroundChange={setBackgroundMode}
                    axisColorMode={axisColorModeState}
                    onAxisColorChange={setAxisColorModeState}
                />
                
                {metricsData.map((metric, index) => (
                    <MetricCard
                        key={metric.metricId}
                        ref={(el) => (metricRefs.current[index] = el)}
                        metricSettings={metric.settings}
                        filteredData={metric.filteredData}
                        backgroundMode={backgroundMode}
                        axisColorModeState={axisColorModeState}
                    />
                ))}

                <BasicButton
                    label="Export All Graphs"
                    onPress={handleExportAll}
                    style={styles.button}
                />
            </ScrollView>
        </ResponsiveScreen>
    );
};

export default ViewMetrics;

// --- MetricCard Component ---
const MetricCard = forwardRef(function MetricCard({ metricSettings, filteredData, backgroundMode, axisColorModeState }, ref) {
    const theme = useTheme();
    const viewShotRef = useRef();
    const coloursState = ["red", "blue", "green", "purple"];

    useImperativeHandle(ref, () => ({
        exportGraph: async () => {
            try {
                const uri = await viewShotRef.current.capture({ format: "png", quality: 1 });
                if (uri) {
                    const asset = await MediaLibrary.createAssetAsync(uri);
                    await MediaLibrary.createAlbumAsync("My Metrics", asset, false);

                    const newPath = `${FileSystem.documentDirectory}${Date.now()}_metric.png`;
                    await FileSystem.copyAsync({ from: uri, to: newPath });

                    console.log("Image saved to Camera Roll and accessible at:", newPath);
                    return newPath;
                }
            } catch (error) {
                console.error("Error exporting graph:", error);
            }
            return null;
        },
    }));

    const graphType = metricSettings?.config?.type;
    const graphDef = graphType ? GraphTypes[graphType] : null;

    if (!graphDef) {
        return (
            <Card style={styles.metricCard}>
                <Card.Content>
                    <Text style={{ color: theme.colors.placeholderText }}>Unsupported graph type.</Text>
                </Card.Content>
            </Card>
        );
    }

    return (
        <Card style={styles.metricCard}>
            <Card.Content>
                <Text
                    style={{
                        fontSize: 18,
                        fontWeight: "bold",
                        marginBottom: 10,
                        color: theme.colors.onSurface,
                    }}
                >
                    {metricSettings.name}
                </Text>

                <ViewShot ref={viewShotRef} options={{ format: "png", quality: 1.0, result: "tmpfile" }}>
                    <View
                        style={[
                            styles.graphCardContainer,
                            {
                                backgroundColor:
                                    backgroundMode === "transparent"
                                        ? "transparent"
                                        : backgroundMode,
                                borderRadius: 6,
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
    );
});

// Utility to convert rows to numeric graph data
function convertToGraphData(rows, metricSettings) {
    if (!metricSettings?.config) return [];
    const { independentVariable, dependentVariables } = metricSettings.config;
    if (!Array.isArray(rows)) return [];

    return rows.map((row) => {
        const newRow = {};
        newRow[independentVariable] =
            Number(row[independentVariable]) || row[independentVariable];
        for (const key of (dependentVariables || [])) {
            const valueAsNumber = Number(row[key]);
            newRow[key] = !isNaN(valueAsNumber) ? valueAsNumber : row[key];
        }
        return newRow;
    });
}

const styles = StyleSheet.create({
    metricCard: {
        borderRadius: 8,
        padding: 10,
        overflow: "hidden",
        elevation: 2,
    },
    centered: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    graphCardContainer: {
        height: 200,
        width: "100%",
    },
    button: {
        alignSelf: "center",
        marginVertical: 20,
    },
});
