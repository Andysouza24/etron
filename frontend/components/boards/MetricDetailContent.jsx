import React, { useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Text, Chip, useTheme } from 'react-native-paper';
import GraphTypes from '../modules/day-book/metrics/graph-types';
import MetricViewer from '../modules/day-book/metrics/MetricViewer';
import { resolveAppearance, mergeAppearance, formatMetricValue, formatRangeValue } from '../../utils/boards/boardUtils';
import { DEFAULT_CHART_COLOURS } from '../../utils/boards/boardConstants';
import metricDataService from '../../services/MetricDataService';
import { ScrollView } from 'react-native-gesture-handler';
import DataSourceErrorNotice from './DataSourceErrorNotice';
import { useMetricContext } from '../../contexts/MetricContext';
import { useHasPermission } from '../../hooks/useHasPermission';

const MetricDetailContent = ({ item, metricState, onYearChange, styles, metricAppearance, dataSourceErrored = false }) => {
    const theme = useTheme();
    const { metrics } = useMetricContext();
    const [aggregationPeriod, setAggregationPeriod] = useState('daily');
    const { allowed: manageMetricsPermission } = useHasPermission('modules.daybook.metrics.manage_metrics');
    const { allowed: viewDataPermission } = useHasPermission('modules.daybook.datasources.view_data');
    // metadata + variable chips are gated behind either permission so users
    // without data access don't see derived statistics about it.
    const canViewDetails = manageMetricsPermission || viewDataPermission;

    if (!item) {
        return null;
    }

    const snapshotConfig = item.config || {};
    const liveMetric = Array.isArray(metrics)
        ? metrics.find((m) => m?.metricId === snapshotConfig.metricId)
        : null;
    const liveThresholds = Array.isArray(liveMetric?.config?.thresholds)
        ? liveMetric.config.thresholds
        : null;
    // Always use freshest fieldAliases (liveMetric preferred)
    const liveFieldAliases = liveMetric?.config?.fieldAliases;
    const config = liveThresholds
        ? { ...snapshotConfig, thresholds: liveThresholds, fieldAliases: liveFieldAliases ?? snapshotConfig.fieldAliases }
        : { ...snapshotConfig, fieldAliases: liveFieldAliases ?? snapshotConfig.fieldAliases };
    const configDependentVariables = Array.isArray(config.dependentVariables) ? config.dependentVariables : [];
    const dependentVariables = Array.isArray(metricState?.yKeys) && metricState.yKeys.length > 0
        ? metricState.yKeys
        : configDependentVariables;
    const colours = Array.isArray(config.colours) && config.colours.length > 0 ? config.colours : DEFAULT_CHART_COLOURS;
    const graphDef = config.chartType ? GraphTypes[config.chartType] : null;
    const isLoading = metricState ? metricState.loading : true;
    const errorMessage = metricState?.error;
    // When the backend shipped all four aggregation views in one bundle,
    // swap the displayed rows to the currently selected period so toggling
    // never triggers a refetch. Falls back to the default `data` slice for
    // legacy or non-bucketable responses.
    const periodSlice = metricState?.periods?.[aggregationPeriod];
    const data = Array.isArray(periodSlice)
        ? periodSlice
        : (Array.isArray(metricState?.data) ? metricState.data : []);
    const hasData = data.length > 0 && dependentVariables.length > 0;
    const dataCount = data.length;
    const appearance = resolveAppearance(mergeAppearance(metricAppearance, config.appearance));
    const axisColorMode = appearance.background && appearance.background !== 'transparent'
        ? (appearance.background.toLowerCase() === '#ffffff' || appearance.background.toLowerCase() === 'white' ? 'light' : 'dark')
        : (theme.dark ? 'light' : 'light');
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
    const axisLabel = (config.independentVariable && config.fieldAliases?.[config.independentVariable])
        ? config.fieldAliases[config.independentVariable]
        : (config.independentVariable || 'Not set');

    return (
        <View style={styles.metricDetailContainer}>
            {dataSourceErrored ? (
                <DataSourceErrorNotice />
            ) : null}
            {!isLoading && !errorMessage && graphDef && hasData && (
                <MetricViewer
                    config={config}
                    data={data}
                    yKeys={dependentVariables}
                    colours={colours}
                    axisColorMode={axisColorMode}
                    availableYears={metricState?.availableYears}
                    selectedYear={metricState?.selectedYear}
                    onYearChange={onYearChange}
                    loading={!!metricState?.loading}
                    aliases={config.fieldAliases || {}}
                    aggregationPeriod={aggregationPeriod}
                    onAggregationPeriodChange={setAggregationPeriod}
                    compactBottom={true}
                    renderGraphContainer={(graphNode) => (
                        <View
                            collapsable={false}
                            style={[styles.metricDetailChart, { backgroundColor: chartBackground }]}
                            pointerEvents="box-none"
                        >
                            {graphNode}
                        </View>
                    )}
                />
            )}
            {(isLoading || errorMessage || !graphDef || !hasData) && (
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
                </View>
            )}

            <View style={styles.metricDetailInfo}>
                {canViewDetails ? (
                <>
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
                                accessibilityLabel={`${variable} average: ${formatMetricValue(summary.avg)}`}
                            >
                                {`${variable}: avg ${formatMetricValue(summary.avg)}`}
                            </Chip>
                        ))}
                        {remainingSummaries > 0 && (
                            <Chip mode="outlined" compact style={styles.metricDetailSummaryChip} accessibilityLabel={`${remainingSummaries} more variables`}>
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
                                <Chip key={`${item.id}-${variable}`} mode="outlined" compact style={styles.metricDetailChip} accessibilityLabel={`Variable: ${variable}`}>
                                    {variable}
                                </Chip>
                            ))}
                        </View>
                    </View>
                )}
                </>
                ) : null}
            </View>
        </View>
    );
};

export default MetricDetailContent;
