import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Chip, useTheme } from 'react-native-paper';
import MetricCard from './MetricCard';

const MetricListCard = ({
    item,
    metricState,
    onPress,
    dataSourceName,
    dataSourceColor,
    dataSourceErrored = false,
    height,
}) => {
    const theme = useTheme();
    const metricStyles = React.useMemo(() => createMetricStyles(theme), [theme]);

    const chipBackground = dataSourceColor || theme.colors.secondaryContainer;
    const chipTextColor = dataSourceColor
        ? theme.colors.onSecondary
        : theme.colors.onSecondaryContainer;

    const displayYear = (() => {
        if (metricState?.selectedYear != null) return metricState.selectedYear;
        const years = Array.isArray(metricState?.availableYears) ? metricState.availableYears : [];
        if (years.length > 0) return Math.max(...years.map(Number).filter(Number.isFinite));
        const xKey = item?.config?.independentVariable ?? item?.config?.xKey;
        const data = Array.isArray(metricState?.data) ? metricState.data : [];
        if (!xKey || data.length === 0) return null;
        let latest = null;
        for (const row of data) {
            const t = new Date(row?.[xKey]).getTime();
            if (!Number.isNaN(t) && (latest == null || t > latest)) latest = t;
        }
        return latest != null ? new Date(latest).getFullYear() : null;
    })();

    const renderRight = dataSourceName
        ? () => (
            <Chip
                compact
                style={[styles.chip, { backgroundColor: chipBackground }]}
                textStyle={[styles.chipText, { color: chipTextColor }]}
            >
                {dataSourceName}
            </Chip>
        )
        : undefined;

    return (
        <Card
            mode="elevated"
            style={styles.card}
            onPress={() => onPress?.(item.id)}
        >
            <Card.Title
                title={item?.name ?? 'Untitled metric'}
                titleVariant="titleMedium"
                titleNumberOfLines={1}
                subtitle={displayYear != null ? String(displayYear) : undefined}
                subtitleVariant="bodySmall"
                right={renderRight}
                rightStyle={styles.rightStyle}
            />
            <Card.Content style={styles.content}>
                <View style={[styles.graphWrapper, { height: height ?? 180 }]} pointerEvents="none">
                    <MetricCard
                        item={item}
                        metricState={metricState}
                        styles={metricStyles}
                        height={height}
                        hideYearFilter
                        compactBottom
                        dataSourceErrored={dataSourceErrored}
                    />
                </View>
            </Card.Content>
        </Card>
    );
};

export default React.memo(MetricListCard, (prev, next) => (
    prev.item === next.item &&
    prev.metricState === next.metricState &&
    prev.dataSourceName === next.dataSourceName &&
    prev.dataSourceColor === next.dataSourceColor &&
    prev.dataSourceErrored === next.dataSourceErrored &&
    prev.height === next.height &&
    prev.onPress === next.onPress
));

const styles = StyleSheet.create({
    card: {
        width: '100%',
    },
    content: {
        paddingTop: 0,
    },
    rightStyle: {
        marginRight: 16,
    },
    chip: {
        alignSelf: 'center',
    },
    chipText: {
        fontSize: 12,
    },
    graphWrapper: {
        width: '100%',
    },
});

const createMetricStyles = (theme) => {
    const colors = theme?.colors ?? {};
    return StyleSheet.create({
        metricCardTouchable: {
            flex: 1,
            width: '100%',
            height: '100%',
        },
        metricGraphCardWrapper: {
            flex: 1,
            width: '100%',
            height: '100%',
        },
        metricGraphCard: {
            flex: 1,
            borderRadius: 8,
            overflow: 'hidden',
            backgroundColor: colors.surface ?? '#1a1d2e',
            position: 'relative',
        },
        metricGraphCardEditing: {
            opacity: 0.7,
        },
        metricEditOverlay: {
            position: 'absolute',
            top: 4,
            right: 4,
            zIndex: 10,
        },
        removeButton: {
            margin: 0,
            borderRadius: 16,
        },
        metricPreviewChart: {
            flex: 1,
            width: '100%',
            height: '100%',
        },
        metricPreviewChartInner: {
            flex: 1,
            paddingTop: 8,
        },
        metricPreviewPlaceholder: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 16,
        },
        metricPreviewPlaceholderText: {
            fontSize: 12,
            textAlign: 'center',
            opacity: 0.75,
            marginTop: 8,
            color: colors.onSurfaceVariant ?? colors.onSurface ?? undefined,
        },
        metricCompactStatusErrorText: {
            color: colors.error ?? '#ff8a80',
        },
    });
};
