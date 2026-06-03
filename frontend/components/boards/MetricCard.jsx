import React from 'react';
import { View, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Text, IconButton, useTheme } from 'react-native-paper';
import GraphTypes from '../modules/day-book/metrics/graph-types';
import MetricGraph from '../modules/day-book/metrics/MetricGraph';
import { resolveAppearance } from '../../utils/boards/boardUtils';
import { DEFAULT_CHART_COLOURS } from '../../utils/boards/boardConstants';
import { useMetricContext } from '../../contexts/MetricContext';

const MetricCard = ({ 
    item, 
    metricState, 
    isEditing, 
    styles, 
    onEdit,
    onPress,
    disableEditActions = false,
    dataSourceErrored = false,
    compactBottom = false,
}) => {
    const theme = useTheme();
    const { metrics } = useMetricContext();
    const editIconColor = theme.colors?.primary ?? theme.colors?.icon ?? '#118AB2';
    const editContainerColor = theme.colors?.lowOpacityButton
        ?? theme.colors?.buttonBackground
        ?? theme.colors?.surfaceVariant
        ?? (theme.dark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.08)');

    const snapshotConfig = item.config || {};
    const liveMetric = Array.isArray(metrics)
        ? metrics.find((m) => m?.metricId === snapshotConfig.metricId)
        : null;
    const liveThresholds = Array.isArray(liveMetric?.config?.thresholds)
        ? liveMetric.config.thresholds
        : null;
    const config = liveThresholds
        ? { ...snapshotConfig, thresholds: liveThresholds }
        : snapshotConfig;
    const isLoading = metricState ? metricState.loading : true;
    const errorMessage = metricState?.error;
    const data = Array.isArray(metricState?.data) ? metricState.data : [];
    const dataCount = data.length;
    const configDependentVariables = Array.isArray(config.dependentVariables) ? config.dependentVariables : [];
    const dependentVariables = Array.isArray(metricState?.yKeys) && metricState.yKeys.length > 0
        ? metricState.yKeys
        : configDependentVariables;
    const colours = Array.isArray(config.colours) && config.colours.length > 0 ? config.colours : DEFAULT_CHART_COLOURS;
    const graphDef = config.chartType ? GraphTypes[config.chartType] : null;
    const appearance = resolveAppearance(config.appearance);
    const axisColorMode = appearance.background && appearance.background !== 'transparent'
        ? (appearance.background.toLowerCase() === '#ffffff' || appearance.background.toLowerCase() === 'white' ? 'light' : 'dark')
        : (theme.dark ? 'dark' : 'light');
    const statusTextColor = appearance.tickLabelColor
        || theme.colors?.textAlt
        || theme.colors?.icon
        || '#f4f7ff';
    const statusMutedColor = theme.colors?.lowOpacityText
        || theme.colors?.onSurfaceVariant
        || 'rgba(255,255,255,0.78)';
    const graphBackground = appearance.background
        || theme.colors?.surface
        || theme.colors?.background;

    const chartPreview = (() => {
        if (isLoading) {
            return (
                <View style={styles.metricPreviewPlaceholder}>
                    <ActivityIndicator size="small" color={statusTextColor} />
                    <Text style={[styles.metricPreviewPlaceholderText, { color: statusMutedColor }]}>Loading latest data...</Text>
                </View>
            );
        }

        if (errorMessage) {
            return (
                <View style={styles.metricPreviewPlaceholder}>
                    <Text style={[styles.metricPreviewPlaceholderText, styles.metricCompactStatusErrorText]}>
                        {errorMessage}
                    </Text>
                </View>
            );
        }

        if (!graphDef || !config.independentVariable || dependentVariables.length === 0) {
            return (
                <View style={styles.metricPreviewPlaceholder}>
                    <Text style={[styles.metricPreviewPlaceholderText, { color: statusMutedColor }]}>Configure this metric to view a chart.</Text>
                </View>
            );
        }

        if (dataCount === 0) {
            return (
                <View style={styles.metricPreviewPlaceholder}>
                    <Text style={[styles.metricPreviewPlaceholderText, { color: statusMutedColor }]}>No data available.</Text>
                </View>
            );
        }

        return (
            <View style={styles.metricPreviewChartInner}>
                <MetricGraph
                    config={config}
                    data={data}
                    yKeys={dependentVariables}
                    colours={colours}
                    axisColorMode={axisColorMode}
                    availableYears={metricState?.availableYears ?? null}
                    selectedYear={metricState?.selectedYear ?? null}
                    hideYearFilter
                    compactBottom={compactBottom}
                />
            </View>
        );
    })();

    const metricCard = (
        <View style={styles.metricGraphCardWrapper}>
            <View style={[
                styles.metricGraphCard,
                isEditing && styles.metricGraphCardEditing,
                { backgroundColor: graphBackground }
            ]}>
                {isEditing && !disableEditActions && (
                    <View style={styles.metricEditOverlay}>
                        <IconButton
                            icon="pencil"
                            size={18}
                            onPress={() => onEdit?.(item)}
                            style={styles.removeButton}
                            iconColor={editIconColor}
                            containerColor={editContainerColor}
                            accessibilityLabel="Edit board item"
                        />
                    </View>
                )}
                {dataSourceErrored && (
                    <View
                        pointerEvents="none"
                        style={{
                            position: 'absolute',
                            top: 6,
                            right: 6,
                            zIndex: 2,
                            backgroundColor: theme.colors.errorContainer,
                            borderRadius: 12,
                            paddingHorizontal: 6,
                            paddingVertical: 2,
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 4,
                        }}
                        accessibilityLabel="Data source has an error"
                    >
                        <IconButton
                            icon="alert-circle"
                            size={14}
                            iconColor={theme.colors.onErrorContainer}
                            style={{ margin: 0 }}
                            disabled
                        />
                    </View>
                )}
                <View pointerEvents="none" style={styles.metricPreviewChart}>
                    {chartPreview}
                </View>
            </View>
        </View>
    );

    if (isEditing) {
        return metricCard;
    }

    return (
        <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => onPress?.(item.id)}
            style={styles.metricCardTouchable}
        >
            {metricCard}
        </TouchableOpacity>
    );
};

export default MetricCard;
