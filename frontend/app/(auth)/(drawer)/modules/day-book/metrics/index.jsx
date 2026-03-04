// Author(s): Matthew Parkinson, Noah Bradley

import SearchBar from "../../../../../../components/common/input/SearchBar.jsx";
import Divider from "../../../../../../components/layout/Divider.jsx";
import { View, Flatlist, ActivityIndicator, ScrollView, TouchableOpacity, StyleSheet, RefreshControl } from "react-native";
import Header from "../../../../../../components/layout/Header.jsx";
import { useRouter } from "expo-router";
import { Text, useTheme, Card } from "react-native-paper";
import { useEffect, useState, useCallback, useMemo } from "react";
import { getWorkspaceId } from "../../../../../../storage/workspaceStorage.jsx";
import GraphTypes from "./graph-types.jsx";
import endpoints from "../../../../../../utils/api/endpoints.js";
import { apiGet } from "../../../../../../utils/api/apiClient.jsx";
import { getCurrentUser } from "aws-amplify/auth";
import ResponsiveScreen from "../../../../../../components/layout/ResponsiveScreen.jsx";
import { hasPermission } from "../../../../../../utils/permissions.js";
import { FlatList } from "react-native-gesture-handler";

const MetricManagement = () => {
    const router = useRouter();
    const theme = useTheme();
    const [metricsUser, setMetricsUser] = useState([]);
    const [metricsOther, setMetricsOther] = useState([]);
    const [loadingMetrics, setLoadingMetrics] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [refreshing, setRefreshing] = useState(false);
    const [manageMetricsPermission, setManageMetricsPermission] = useState(false);

    const getWorkspaceMetrics = useCallback(async () => {
        const workspaceId = await getWorkspaceId();

        let metricData;
        try {
            const metricDataResult = await apiGet(
                endpoints.modules.day_book.metrics.getMetrics,
                { workspaceId }
            );
            metricData = metricDataResult.data;
        } catch (error) {
            console.error("Error getting workspace metrics:", error);
            return;
        }

        const { userId } = await getCurrentUser();
        setMetricsUser(metricData.filter(metric => metric.createdBy == userId))
        setMetricsOther(metricData.filter(metric => metric.createdBy != userId))

        setLoadingMetrics(false);
        setRefreshing(false);
    }, []);

    const filteredUser = useMemo(() => {
        const query = (searchQuery || "").trim().toLowerCase();
        if (!query) return metricsUser;
        return metricsUser.filter(metric => (metric.name ?? "").toLowerCase().includes(query));
    }, [metricsUser, searchQuery]);

    const filteredOther = useMemo(() => {
        const query = (searchQuery || "").trim().toLowerCase();
        if (!query) return metricsOther;
        return metricsOther.filter(metric => (metric.name ?? "").toLowerCase().includes(query));
    }, [metricsOther, searchQuery]);

    useEffect(() => {
        loadPermission();
        getWorkspaceMetrics();
    }, [])

    async function loadPermission() {
        const manageMetricsPermission = await hasPermission("modules.daybook.metrics.manage_metrics");
        setManageMetricsPermission(manageMetricsPermission);
    }

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        getWorkspaceMetrics();
    }, [getWorkspaceMetrics]);

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

                <ScrollView
                    style = {{ flex: 1 }}
                    refreshControl = {<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                    contentContainerStyle= {{ paddingBottom: 40 }}
                    bounces = {true}
                    alwaysBounceVertical = {true}
                    overScrollMode = "always"
                >
                    {loadingMetrics ? <ActivityIndicator size={"large"}/> :
                        <View style={{ paddingHorizontal: 20, gap: 30 }}>
                            <Text style={{ fontSize: 16, color: theme.colors.placeholderText}}>
                                Created by you
                            </Text>
                            <MetricCardList metrics={filteredUser} searchQuery={searchQuery} />

                            {filteredOther.length > 0 && (
                                <>
                                    <Divider />
                                    <Text style={{ fontSize: 16, color: theme.colors.placeholderText }}>
                                        Created by others
                                    </Text>
                                    <MetricCardList metrics={filteredOther} searchQuery={searchQuery} />
                                </>
                            )}
                        </View>
                    }
                </ScrollView>
            </View>
        </ResponsiveScreen>
    )
}

const MetricCardList = ({ metrics, searchQuery }) => {
    const theme = useTheme();
    const router = useRouter();

    if (metrics.length === 0) {
        const query = (searchQuery || "").trim();
        return (
            <Text style={{ color: theme.colors.onSurfaceVariant }}>
                {query ? `No metrics found for "${query}".` : "No metrics to display."}
            </Text>
        );
    }

    const rows = [];
    for (let i = 0; i < metrics.length; i += 2) {
        rows.push(metrics.slice(i, i + 2));
    }

    return (
        <View style={{ gap: 14 }}>
            {rows.map((row, rowIdx) => (
                <View
                    key={`row-${rowIdx}`}
                    style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}
                >
                    {row.map((metric) => {
                        const previewImage = (GraphTypes[metric.config?.type] || GraphTypes[metric.config?.graphType])?.previewImage;
                        return (
                            <TouchableOpacity
                                key={metric.metricId}
                                style={{ flex: 1 }}
                                onPress={() =>
                                    router.navigate(`/modules/day-book/metrics/view-metric/${metric.metricId}`)
                                }
                            >
                                <Card style={{ borderRadius: 6, overflow: "hidden" }}>
                                    {previewImage && (
                                        <Card.Cover
                                            source={previewImage}
                                            style={{
                                                height: 120,
                                                backgroundColor: theme.colors.placeholder,
                                                opacity: 0.5,
                                            }}
                                        />
                                    )}
                                    <Card.Content style={{ paddingVertical: 10 }}>
                                        <Text
                                            style={{
                                                color: theme.colors.onSurface,
                                                fontSize: 16,
                                                fontWeight: "bold",
                                            }}
                                            numberOfLines={1}
                                        >
                                            {metric.name}
                                        </Text>
                                    </Card.Content>
                                </Card>
                            </TouchableOpacity>
                        );
                    })}
                    {row.length === 1 && <View style={{ flex: 1 }} />}
                </View>
            ))}
        </View>
    );
};

export default MetricManagement;

const styles = StyleSheet.create({
    card: {
        overflow: "hidden",
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