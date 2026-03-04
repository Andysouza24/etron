import { Modal, Portal, Card, Text, ActivityIndicator, useTheme } from "react-native-paper";
import { View, ScrollView, StyleSheet, TouchableOpacity } from "react-native";
import React, { useState, useEffect } from "react";
import { getWorkspaceId } from "../../../../storage/workspaceStorage";
import GraphTypes from "../../../../app/(auth)/(drawer)/modules/day-book/metrics/graph-types";
import {modalStyles} from "../../../../assets/styles/stylesheets/day-book/modules/metrics/existingMetricModal";
import metricService from "../../../../services/MetricService";
import BasicButton from "../../../common/buttons/BasicButton";

export default function ExistingMetricsModal({visible, onDismiss, dataSourceId, onMetricPress}){
    const theme = useTheme();
    const [loading, setLoading] = useState(false);
    const [metrics, setMetrics] = useState([]);
    useEffect(() => {
        if(visible && dataSourceId){
            fetchMetrics();
        }
    }, [visible, dataSourceId]);

    const fetchMetrics = async () => {
        setLoading(true);
        try {
            const result = await metricService.getMetricsByDataSource(dataSourceId);
            setMetrics(result.data ?? result ?? []);
        } catch (error) {
            console.error("[ExistingMetricsModal] Error fetching metrics:", error);
            setMetrics([]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Portal>
            <Modal
                visible={visible}
                onDismiss={onDismiss}
                contentContainerStyle={modalStyles.modal}
            >
                <Card style={modalStyles.card}>
                    <Card.Title title="Existing Metrics" />
                    <Card.Content>
                        {loading ? (
                            <ActivityIndicator size="large" />
                        ): metrics.length === 0 ? (
                            <Text>No metrics found for this data source yet.</Text>
                        ) : (
                            <ScrollView style={modalStyles.list}>
                                {metrics.map((metric) => {
                                    const graphType = GraphTypes[metric.config?.type];
                                    return (
                                        <TouchableOpacity 
                                            key={metric.metricId}
                                            onPress={() => onMetricPress(metric)}
                                            style={[
                                                modalStyles.metricRow,
                                                { borderBottomColor: theme.colors.divider },
                                            ]}
                                        >
                                            <View style={{ flex:1}}>
                                                <Text style={{ fontWeight: "600" }}>
                                                    {metric.name}
                                                </Text>
                                                <Text style={{ fontSize: 12}}>
                                                    {graphType?.label ?? metric.config?.type ?? "Unknown type"}
                                                </Text>
                                            </View>
                                        </TouchableOpacity>
                                    )
                                })}
                            </ScrollView>
                        )}
                        <BasicButton
                            label="Close"
                            onPress={onDismiss}
                            style={{ marginTop: 12, alignSelf: "center" }}
                            danger
                        />
                    </Card.Content>
                </Card>
            </Modal>
        </Portal>
    )
}