import React from 'react';
import { View, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Text, Card, Button, IconButton, Divider, useTheme } from 'react-native-paper';
import { router } from 'expo-router';
import DropDown from '../common/input/DropDown';
import useMetricPicker from '../../hooks/boards/useMetricPicker';

const MetricPicker = ({ onSelect, onCancel, multiSelect = false }) => {
    const theme = useTheme();
    const outlineColor = theme.colors?.outline ?? '#e0e0e0';
    const primaryColor = theme.colors?.primary ?? '#6200ee';
    const mutedTextColor = theme.colors?.lowOpacityText
        ?? theme.colors?.onSurfaceVariant
        ?? 'rgba(0,0,0,0.6)';
    const surfaceAltColor = theme.colors?.buttonBackground
        ?? theme.colors?.surfaceVariant
        ?? '#f5f5f5';
    const dividerColor = theme.colors?.divider ?? outlineColor;

    const {
        searchQuery,
        setSearchQuery,
        metrics,
        selectedMetrics,
        setSelectedMetrics,
        loading,
        error,
        loadMetrics,
        metricsDropdownItems,
        handleToggleMetric,
        handleConfirm,
    } = useMetricPicker({ multiSelect, onSelect });

    const handleCreateMetric = () => {
        router.push('/modules/day-book/metrics/create-metric');
    };

    return (
        <View style={styles.container}>
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={primaryColor} />
                    <Text style={[styles.loadingText, { color: mutedTextColor }]}>Loading metrics...</Text>
                </View>
            ) : error ? (
                <View style={styles.errorContainer}>
                    <Text variant="bodyLarge" style={[styles.errorText, { color: theme.colors?.error ?? '#d32f2f' }]}>{error}</Text>
                    <Button mode="contained" onPress={loadMetrics} style={styles.retryButton}>
                        Retry
                    </Button>
                </View>
            ) : (
                <>
                    <View style={styles.searchContainer}>
                        <DropDown
                            title="Search metrics..."
                            items={metricsDropdownItems}
                            showRouterButton={false}
                            onSelect={(_, item) => {
                                if (item?.metric) {
                                    handleToggleMetric(item.metric);
                                }
                            }}
                            onSearchChange={setSearchQuery}
                            searchQueryValue={searchQuery}
                            searchPlaceholder="Search metrics..."
                            clearOnSelect
                        />
                    </View>

                    {/* Create New Metric Option - Only show if there are metrics or if searching */}
                    {(metrics.length > 0 || searchQuery) && (
                        <>
                            <TouchableOpacity onPress={handleCreateMetric}>
                                <Card style={[styles.createMetricCard, { backgroundColor: surfaceAltColor }]}>
                                    <Card.Content style={styles.createMetricContent}>
                                        <IconButton
                                            icon="plus-circle"
                                            size={24}
                                            style={styles.createMetricIcon}
                                            iconColor={primaryColor}
                                        />
                                        <View style={styles.createMetricText}>
                                            <Text variant="titleMedium" style={[styles.createMetricTitle, { color: primaryColor }]}>
                                                Create New Metric
                                            </Text>
                                            <Text variant="bodySmall" style={[styles.createMetricHint, { color: mutedTextColor }]}>
                                                Go to Day Book to create a new metric
                                            </Text>
                                        </View>
                                    </Card.Content>
                                </Card>
                            </TouchableOpacity>

                            <Divider style={[styles.divider, { backgroundColor: dividerColor }]} />
                        </>
                    )}

                    {multiSelect && selectedMetrics.length > 0 && (
                        <View style={styles.selectionBar}>
                            <Text variant="bodyMedium">
                                {selectedMetrics.length} selected
                            </Text>
                            <Button onPress={() => setSelectedMetrics([])}>
                                Clear
                            </Button>
                        </View>
                    )}

                    {multiSelect && selectedMetrics.length > 0 && (
                        <View style={styles.selectedMetricsContainer}>
                            <Text variant="titleSmall" style={styles.selectedMetricsTitle}>
                                Selected Metrics
                            </Text>
                            {selectedMetrics.map((metric) => (
                                <Card
                                    key={metric.id}
                                    style={styles.selectedMetricCard}
                                >
                                    <Card.Content style={styles.selectedMetricContent}>
                                        <View style={styles.selectedMetricLeft}>
                                            <Text variant="titleSmall">{metric.name}</Text>
                                            <Text variant="bodySmall" style={[styles.selectedMetricHint, { color: mutedTextColor }]}>
                                                {metric.chartType} • {metric.dependentVariables?.length || 0} variable{metric.dependentVariables?.length !== 1 ? 's' : ''}
                                            </Text>
                                        </View>
                                        <IconButton
                                            icon="close"
                                            size={20}
                                            onPress={() => handleToggleMetric(metric)}
                                            iconColor={theme.colors?.error ?? '#d32f2f'}
                                        />
                                    </Card.Content>
                                </Card>
                            ))}
                        </View>
                    )}

                    {metrics.length === 0 && !loading && (
                        <View style={styles.emptyState}>
                            <IconButton icon="chart-box-outline" size={64} iconColor={theme.colors?.icon} />
                            <Text variant="titleLarge" style={styles.emptyTitle}>
                                No Metrics Created Yet
                            </Text>
                            <Text variant="bodyMedium" style={[styles.emptyHint, { color: mutedTextColor }]}>
                                You haven&apos;t created any metrics yet. Create your first metric to add it to this board.
                            </Text>
                            <Button
                                mode="contained"
                                onPress={handleCreateMetric}
                                style={styles.createButton}
                                icon="plus"
                            >
                                Create Your First Metric
                            </Button>
                        </View>
                    )}

                    {multiSelect && (
                        <View style={[styles.footer, { borderTopColor: dividerColor }]}>
                            <Button
                                mode="outlined"
                                onPress={onCancel}
                                style={styles.footerButton}
                            >
                                Cancel
                            </Button>
                            <Button
                                mode="contained"
                                onPress={handleConfirm}
                                style={styles.footerButton}
                                disabled={selectedMetrics.length === 0}
                            >
                                Add {selectedMetrics.length > 0 ? `(${selectedMetrics.length})` : ''}
                            </Button>
                        </View>
                    )}
                </>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32
    },
    loadingText: {
        marginTop: 16,
        opacity: 0.7
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32
    },
    errorText: {
        marginBottom: 16,
        textAlign: 'center'
    },
    retryButton: {
        marginTop: 8
    },
    searchContainer: {
        margin: 16,
        marginBottom: 8
    },
    createMetricCard: {
        marginHorizontal: 16,
        marginBottom: 8
    },
    createMetricContent: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8
    },
    createMetricIcon: {
        margin: 0,
        marginRight: 8
    },
    createMetricText: {
        flex: 1
    },
    createMetricTitle: {
        fontWeight: '600'
    },
    createMetricHint: {
        opacity: 0.7,
        marginTop: 2
    },
    divider: {
        marginHorizontal: 16,
        marginVertical: 8
    },
    selectionBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8
    },
    selectedMetricsContainer: {
        paddingHorizontal: 16,
        paddingBottom: 16
    },
    selectedMetricsTitle: {
        marginBottom: 8,
        fontWeight: '600'
    },
    selectedMetricCard: {
        marginBottom: 8
    },
    selectedMetricContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 4
    },
    selectedMetricLeft: {
        flex: 1
    },
    selectedMetricHint: {
        opacity: 0.7,
        marginTop: 2
    },
    emptyState: {
        padding: 32,
        alignItems: 'center'
    },
    emptyTitle: {
        marginTop: 16,
        marginBottom: 8,
        fontWeight: '600'
    },
    emptyHint: {
        opacity: 0.6,
        marginTop: 8,
        textAlign: 'center',
        marginBottom: 16
    },
    createButton: {
        marginTop: 8
    },
    footer: {
        flexDirection: 'row',
        gap: 12,
        padding: 16,
        borderTopWidth: 1
    },
    footerButton: {
        flex: 1
    }
});

export default MetricPicker;
