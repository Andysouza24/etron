import React from 'react';
import { View } from 'react-native';
import { Text, IconButton } from 'react-native-paper';

const MetricDetailHeader = ({ 
    item, 
    onEdit, 
    onDelete, 
    onClose, 
    styles 
}) => {
    if (!item) {
        return null;
    }

    const config = item.config || {};
    const metricId = config.metricId;
    const titleText = config.label || config.name || 'Metric';
    const chartLabel = config.chartType
        ? `${config.chartType.charAt(0).toUpperCase()}${config.chartType.slice(1)}`
        : undefined;

    return (
        <View style={styles.metricDetailHeader}>
            <View style={styles.metricDetailHeaderText}>
                <Text style={styles.metricDetailHeaderTitle} numberOfLines={1}>
                    {titleText}
                </Text>
                {chartLabel ? (
                    <Text style={styles.metricDetailHeaderSubtitle} numberOfLines={1}>
                        {chartLabel}
                    </Text>
                ) : null}
            </View>
            <View style={styles.metricDetailHeaderActions}>
                <IconButton
                    icon="pencil"
                    size={20}
                    onPress={() => onEdit(metricId)}
                    disabled={!metricId}
                    style={styles.metricDetailHeaderIcon}
                    accessibilityLabel="Edit metric"
                />
                <IconButton
                    icon="delete-outline"
                    size={20}
                    onPress={() => onDelete(item.id)}
                    style={styles.metricDetailHeaderIcon}
                    accessibilityLabel="Remove from board"
                />
                <IconButton
                    icon="close"
                    size={20}
                    onPress={onClose}
                    style={styles.metricDetailHeaderIcon}
                    accessibilityLabel="Close details"
                />
            </View>
        </View>
    );
};

export default MetricDetailHeader;
