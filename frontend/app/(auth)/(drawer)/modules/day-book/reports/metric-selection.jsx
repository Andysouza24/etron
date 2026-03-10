// Author(s): Matthew Parkinson, Noah Bradley

import SearchBar from "../../../../../../components/common/input/SearchBar.jsx";
import Divider from "../../../../../../components/layout/Divider.jsx";
import { View, Button, ActivityIndicator, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, Platform } from "react-native";
import Header from "../../../../../../components/layout/Header.jsx";
import { useRouter } from "expo-router";
import { Text, useTheme, Card } from "react-native-paper";
import { useEffect, useState, useCallback } from "react";
import { getWorkspaceId } from "../../../../../../storage/workspaceStorage.jsx";
import GraphTypes from "../../../../../../components/modules/day-book/metrics/graph-types";
import endpoints from "../../../../../../utils/api/endpoints.js";
import { apiGet } from "../../../../../../utils/api/apiClient.jsx";
import { getCurrentUser } from "aws-amplify/auth";
import ResponsiveScreen from "../../../../../../components/layout/ResponsiveScreen.jsx";

const MetricSelection = ({ asModal = false, onMetricSelect }) => {
    const router = useRouter();
    const theme = useTheme();
    const [metrics, setMetrics] = useState([]);
    const [metricsUser, setMetricsUser] = useState([]);
    const [metricsOther, setMetricsOther] = useState([]);
    const [loadingMetrics, setLoadingMetrics] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [refreshing, setRefreshing] = useState(false);
    const [selectedMetrics, setSelectedMetrics] = useState([]);

    const getWorkspaceMetrics = useCallback(async () => {
        const workspaceId = await getWorkspaceId();

        let metricData;
        try {
            const metricDataResult = await apiGet(
                endpoints.modules.day_book.metrics.getMetrics,
                { workspaceId }
            );
            metricData = metricDataResult.data;

            const { userId } = await getCurrentUser();
            setMetricsUser(metricData.filter(metric => metric.createdBy == userId))
            setMetricsOther(metricData.filter(metric => metric.createdBy != userId))
        } catch (error) {
            console.error("Error getting workspace metrics:", error);
            return;
        } finally {
            setLoadingMetrics(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        getWorkspaceMetrics();
    }, [])

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        getWorkspaceMetrics();
    }, [getWorkspaceMetrics]);

    const toggleSelectedMetric = (metricId) => {
        setSelectedMetrics((prevSelected) =>
            prevSelected.includes(metricId)
                ? prevSelected.filter((id) => id !== metricId)
                : [...prevSelected, metricId]
        );
    };

    const handleViewSelected = () => {
        if (selectedMetrics.length === 0) return;
        router.navigate(
            `/modules/day-book/reports/view-metrics?ids=${encodeURIComponent(
                JSON.stringify(selectedMetrics)
            )}`
        );
    };

    return (
        <ResponsiveScreen
            header={
                !asModal && (
                    <Header title="Select Metric" showBack showPlus onRightIconPress={handleViewSelected}/>
                )
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

                <ScrollView
                    style = {{ flex: 1 }}
                    refreshControl = {<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                    contentContainerStyle= {{ flexGrow: 1 }}
                    bounces = {true}
                    alwaysBounceVertical = {true}
                    overScrollMode = "always"
                >
                    <View style={{ paddingHorizontal: 20, gap: 30 }}>
                        <Text style={{ fontSize: 16, color: theme.colors.placeholderText}}>
                            Created by you
                        </Text>
                        {loadingMetrics && <ActivityIndicator />}
                        {metricCardList(loadingMetrics, metricsUser, selectedMetrics, toggleSelectedMetric, asModal, onMetricSelect)}

                        <Divider/>
                        
                        <Text style={{ fontSize: 16, color: theme.colors.placeholderText}}>
                            Created by others
                        </Text>
                        {loadingMetrics && <ActivityIndicator />}
                        {metricCardList(loadingMetrics, metricsOther, selectedMetrics, toggleSelectedMetric, asModal, onMetricSelect)}
                    </View>
                </ScrollView>
            </View>
        </ResponsiveScreen>
    )
}

const metricCardList = (loadingMetrics, metrics, selectedMetrics, toggleSelectedMetric, asModal, onMetricSelect) => {
    const theme = useTheme();
    return (
        <View style={{ flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: 14 }}>
            {!loadingMetrics &&
                metrics.map((metric) => {
                    const previewImage = metric?.config?.type ? GraphTypes[metric.config.type]?.previewImage : null;
                    const isSelected = selectedMetrics.includes(metric.metricId);

                    return (
                        <TouchableOpacity
                            key={metric.metricId}
                            style={{
                                width: "48%"
                            }}
                            onPress={() =>
                                asModal ? onMetricSelect(metric) : toggleSelectedMetric(metric.metricId)
                            }
                        >
                            <Card
                                style={[
                                    styles.card,
                                    isSelected && {
                                        borderWidth: 2,
                                        borderColor: theme.colors.primary,
                                    },
                                ]}
                            >
                                {previewImage && (
                                    <Card.Cover
                                        source={previewImage}
                                        style={{ height: 100, backgroundColor: theme.colors.placeholder, opacity: 0.5 }}
                                    />
                                )}
                                <Card.Content
                                    style={{
                                        position: "absolute",
                                        bottom: 10,
                                        alignItems: "baseline"
                                    }}
                                >
                                    <Text
                                        style={{
                                            color: "white",
                                            fontSize: 16,
                                            fontWeight: "bold",
                                        }}
                                    >
                                        {metric.name}
                                    </Text>
                                </Card.Content>
                            </Card>
                        </TouchableOpacity>
                    );
                })
            }
        </View>
    )
}

export default MetricSelection;

const styles = StyleSheet.create({
    card: {
        overflow: "hidden",
        borderRadius: 5,
        padding: 10,
        overflow: "hidden"
    },
    cardCover: {
        width: 120,
        height: 120,
    },
    cardContent: {
        position: "absolute",
        bottom: 10,
        left: 10,
    }
})