import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, IconButton, useTheme } from 'react-native-paper';

// Renders in place of a metric board item whose backing metric or data
// source has been deleted on another device. Keeps the grid layout intact
// and explains why the chart no longer renders.
const DeletedItemCard = ({
    reason = 'metric',
    isEditing = false,
    styles,
    onEdit,
    item,
    disableEditActions = false,
}) => {
    const theme = useTheme();

    const editIconColor = theme.colors?.primary ?? theme.colors?.icon ?? '#118AB2';
    const editContainerColor = theme.colors?.lowOpacityButton
        ?? theme.colors?.buttonBackground
        ?? theme.colors?.surfaceVariant
        ?? (theme.dark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.08)');

    const surface = theme.colors?.surfaceVariant ?? theme.colors?.surface ?? '#F2F2F2';
    const border = theme.colors?.outlineVariant ?? theme.colors?.outline ?? 'rgba(0,0,0,0.12)';
    const titleColor = theme.colors?.onSurface ?? '#1B1B1B';
    const subtitleColor = theme.colors?.onSurfaceVariant ?? 'rgba(0,0,0,0.6)';
    const iconColor = theme.colors?.error ?? '#B3261E';

    const copy = reason === 'dataSource'
        ? {
            icon: 'database-off',
            title: 'Data source deleted',
            body: "This metric's data source is no longer available. Remove the item or reconnect a data source.",
        }
        : {
            icon: 'chart-line-variant',
            title: 'Metric deleted',
            body: 'This metric was removed. Replace or delete this item from the board.',
        };

    return (
        <View style={[styles?.metricGraphCardWrapper, localStyles.wrapper]}>
            <View
                style={[
                    styles?.metricGraphCard,
                    isEditing && styles?.metricGraphCardEditing,
                    localStyles.card,
                    { backgroundColor: surface, borderColor: border },
                ]}
            >
                {isEditing && !disableEditActions && (
                    <View style={styles?.metricEditOverlay}>
                        <IconButton
                            icon="pencil"
                            size={18}
                            onPress={() => onEdit?.(item)}
                            style={styles?.removeButton}
                            iconColor={editIconColor}
                            containerColor={editContainerColor}
                            accessibilityLabel="Edit board item"
                        />
                    </View>
                )}
                <View style={localStyles.body} pointerEvents="none">
                    <IconButton
                        icon={copy.icon}
                        iconColor={iconColor}
                        size={28}
                        disabled
                        style={localStyles.icon}
                    />
                    <Text
                        variant="titleSmall"
                        style={[localStyles.title, { color: titleColor }]}
                        numberOfLines={1}
                    >
                        {copy.title}
                    </Text>
                    <Text
                        variant="bodySmall"
                        style={[localStyles.subtitle, { color: subtitleColor }]}
                        numberOfLines={3}
                    >
                        {copy.body}
                    </Text>
                </View>
            </View>
        </View>
    );
};

const localStyles = StyleSheet.create({
    wrapper: {
        flex: 1,
    },
    card: {
        flex: 1,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderRadius: 12,
        padding: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    body: {
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
    },
    icon: {
        margin: 0,
    },
    title: {
        marginTop: 4,
        textAlign: 'center',
        fontWeight: '600',
    },
    subtitle: {
        marginTop: 4,
        textAlign: 'center',
    },
});

export default DeletedItemCard;
