import React from 'react';
import { View, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Text, IconButton, useTheme } from 'react-native-paper';
import GraphTypes from '../modules/day-book/metrics/graph-types';
import { resolveAppearance } from '../../utils/boards/boardUtils';
import { DEFAULT_CHART_COLOURS } from '../../utils/boards/boardConstants';

const MetricCard = ({ 
    item, 
    metricState, 
    isEditing, 
    styles, 
    onEdit,
    onPress,
    disableEditActions = false
}) => {
    const theme = useTheme();
    const editIconColor = theme.colors?.primary ?? theme.colors?.icon ?? '#118AB2';
    const editContainerColor = theme.colors?.lowOpacityButton
        ?? theme.colors?.buttonBackground
        ?? theme.colors?.surfaceVariant
        ?? (theme.dark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.08)');

    const config = item.config || {};
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
                {graphDef.render({
                    data,
                    xKey: config.independentVariable,
                    yKeys: dependentVariables,
                    colours,
                    axisColorMode,
                    maxValue: config.maxValue,
                    capPercentAt100: config.capPercentAt100,
                    boxGrouping: config.boxGrouping,
                    boxTimePeriod: config.boxTimePeriod,
                    pieLabelPlacement: config.pieLabelPlacement,
                    rounding: config.rounding,
                    numberFormat: config.numberFormat,
                    percentRounding: config.percentRounding,
                    axisNumberFormat: config.axisNumberFormat,
                    rawGraphData: config.rawGraphData,
                    boxUseRawData: config.boxUseRawData,
                })}
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
