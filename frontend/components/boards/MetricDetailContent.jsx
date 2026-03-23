import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Text, Chip, useTheme } from 'react-native-paper';
import GraphTypes from '../../app/(auth)/(drawer)/modules/day-book/metrics/graph-types';
import { resolveAppearance, buildAxisOptionsFromAppearance, formatMetricValue, formatRangeValue } from '../../utils/boards/boardUtils';
import { DEFAULT_CHART_COLOURS } from '../../utils/boards/boardConstants';
import metricDataService from '../../services/MetricDataService';
import { ScrollView } from 'react-native-gesture-handler';

const MetricDetailContent = ({ item, metricState, styles }) => {
    if (!item) {
        return null;
    }

    const theme = useTheme();

    const config = item.config || {};
    const dependentVariables = Array.isArray(config.dependentVariables) ? config.dependentVariables : [];
    const colours = Array.isArray(config.colours) && config.colours.length > 0 ? config.colours : DEFAULT_CHART_COLOURS;
    const graphDef = config.chartType ? GraphTypes[config.chartType] : null;
    const isLoading = metricState ? metricState.loading : true;
    const errorMessage = metricState?.error;
    const data = Array.isArray(metricState?.data) ? metricState.data : [];
    const hasData = data.length > 0 && dependentVariables.length > 0;
    const dataCount = data.length;
    const appearance = resolveAppearance(config.appearance);
    const axisOptions = buildAxisOptionsFromAppearance(appearance);
    const statusTextColor = appearance.tickLabelColor
        || theme.colors?.textAlt
        || theme.colors?.icon
        || '#f4f7ff';
    const statusMutedColor = theme.colors?.lowOpacityText
        || theme.colors?.onSurfaceVariant
        || 'rgba(255,255,255,0.75)';
    const chartBackground = appearance.background
        || theme.colors?.surface
        || theme.colors?.background;
    const selectedRows = Array.isArray(config.selectedRows) ? config.selectedRows : [];
    const dataSummaryText = selectedRows.length > 0
        ? `${dataCount} pts · ${selectedRows.length} selected`
        : `${dataCount} pts`;
    const xValues = hasData
        ? data
            .map(entry => entry?.[config.independentVariable])
            .filter(value => value !== undefined && value !== null)
        : [];
    const rangeText = (() => {
        if (xValues.length === 0) return 'Not available';
        if (xValues.length === 1) return formatRangeValue(xValues[0]);
        const firstValue = xValues[0];
        const lastValue = xValues[xValues.length - 1];
        return `${formatRangeValue(firstValue)} to ${formatRangeValue(lastValue)}`;
    })();
    const dataSourceLabel = config.dataSourceName || config.dataSourceLabel || (config.dataSourceId ? 'Linked data source' : 'No data source configured');
    const dependentSummaries = hasData
        ? dependentVariables
            .map(variable => ({ variable, summary: metricDataService.getMetricSummary(data, variable) }))
            .filter(entry => entry.summary.count > 0)
        : [];
    const summaryDisplay = dependentSummaries.slice(0, 2);
    const remainingSummaries = Math.max(dependentSummaries.length - summaryDisplay.length, 0);
    const axisLabel = config.independentVariable || 'Not set';

    return (
        <View style={styles.metricDetailContainer}>
            <View style={[styles.metricDetailChart, { backgroundColor: chartBackground }]}> 
                {isLoading && (
                    <View style={styles.metricStatus}>
                        <ActivityIndicator color={statusTextColor} />
                        <Text style={[styles.metricStatusText, { color: statusMutedColor }]}>Syncing data...</Text>
                    </View>
                )}

                {!isLoading && errorMessage && (
                    <View style={styles.metricStatus}>
                        <Text
                            style={[styles.metricErrorText, { color: theme.colors?.error ?? '#ff8a80' }]}
                            numberOfLines={3}
                        >
                            {errorMessage}
                        </Text>
                    </View>
                )}

                {!isLoading && !errorMessage && !graphDef && (
                    <View style={styles.metricStatus}>
                        <Text style={[styles.metricErrorText, { color: theme.colors?.error ?? '#ff8a80' }]}>Unsupported chart type.</Text>
                    </View>
                )}

                {!isLoading && !errorMessage && graphDef && !hasData && (
                    <View style={styles.metricStatus}>
                        <Text style={[styles.metricEmptyText, { color: statusMutedColor }]}>No metric data available.</Text>
                    </View>
                )}

                {!isLoading && !errorMessage && graphDef && hasData && (
                    <View style={styles.metricDetailChartInner}>
                        {graphDef.render({
                            data,
                            xKey: config.independentVariable,
                            yKeys: dependentVariables,
                            colours,
                            axisOptions
                        })}
                    </View>
                )}
            </View>

            <View style={styles.metricDetailInfo}>
                <View style={styles.metricDetailMetaGrid}>
                    <View style={styles.metricDetailMetaItem}>
                        <Text style={styles.metricDetailMetaLabel}>Data</Text>
                        <Text style={styles.metricDetailMetaValue} numberOfLines={1}>{dataSummaryText}</Text>
                    </View>
                    <View style={styles.metricDetailMetaItem}>
                        <Text style={styles.metricDetailMetaLabel}>Range</Text>
                        <Text style={styles.metricDetailMetaValue} numberOfLines={1}>{rangeText}</Text>
                    </View>
                    <View style={styles.metricDetailMetaItem}>
                        <Text style={styles.metricDetailMetaLabel}>Axis</Text>
                        <Text style={styles.metricDetailMetaValue} numberOfLines={1}>{axisLabel}</Text>
                    </View>
                    <View style={styles.metricDetailMetaItem}>
                        <Text style={styles.metricDetailMetaLabel}>Source</Text>
                        <Text style={styles.metricDetailMetaValue} numberOfLines={1}>{dataSourceLabel}</Text>
                    </View>
                </View>

                {summaryDisplay.length > 0 && (
                    <View style={styles.metricDetailSummaryRow}>
                        {summaryDisplay.map(({ variable, summary }) => (
                            <Chip
                                key={`${item.id}-${variable}-summary`}
                                mode="outlined"
                                compact
                                style={styles.metricDetailSummaryChip}
                            >
                                {`${variable}: avg ${formatMetricValue(summary.avg)}`}
                            </Chip>
                        ))}
                        {remainingSummaries > 0 && (
                            <Chip mode="outlined" compact style={styles.metricDetailSummaryChip}>
                                {`+ ${remainingSummaries} more`}
                            </Chip>
                        )}
                    </View>
                )}

                {dependentVariables.length > 0 && (
                    <View style={styles.metricDetailVariables}>
                        <Text style={styles.metricDetailMetaLabel}>Variables</Text>
                        <View style={styles.metricDetailChipsRow}>
                            {dependentVariables.map(variable => (
                                <Chip key={`${item.id}-${variable}`} mode="outlined" compact style={styles.metricDetailChip}>
                                    {variable}
                                </Chip>
                            ))}
                        </View>
                    </View>
                )}
            </View>
        </View>
    );
};

export default MetricDetailContent;
