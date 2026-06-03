import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Card, Chip, Icon, IconButton, Menu, useTheme } from "react-native-paper";
import formatLastUpdated from "../../../../../utils/format/formatLastUpdated";
import { useHasPermission } from "../../../../../hooks/useHasPermission";

// Toggle to show or hide the trend direction icon (chevron) on the value
// chip. Applies to both the board card and the metrics list view.
const SHOW_TREND_ICON = true;

const SimpleMetricCard = ({
    item,
    metricState,
    dataSourceErrored = false,
    desiredTrend = null,
    showActions = true,
    isEditing = false,
    disableEditActions = false,
    onPress,
    onEdit,
    onDelete,
    onAddToBoard,
}) => {
    const theme = useTheme();
    const [menuVisible, setMenuVisible] = React.useState(false);
    const { allowed: canManageMetrics } = useHasPermission(
        "modules.daybook.metrics.manage_metrics",
    );

    const showMenu = showActions && canManageMetrics;
    const editIconColor = theme.colors?.primary ?? theme.colors?.icon;
    const editContainerColor = theme.colors?.lowOpacityButton
        ?? theme.colors?.buttonBackground
        ?? theme.colors?.surfaceVariant;

    const loading = metricState?.loading === true;
    const stateErrored = metricState?.error != null;

    const xKey = item?.config?.independentVariable ?? item?.config?.xKey;
    const yKey = Array.isArray(metricState?.yKeys) && metricState.yKeys.length > 0
        ? metricState.yKeys[0]
        : null;
    const data = Array.isArray(metricState?.data) ? metricState.data : [];

    const { latestValue, previousValue, latestTimestamp } = React.useMemo(() => {
        if (!xKey || !yKey || data.length === 0) {
            return { latestValue: null, previousValue: null, latestTimestamp: null };
        }
        const sorted = [...data]
            .map((row) => ({
                value: Number(row?.[yKey]),
                ts: new Date(row?.[xKey]).getTime(),
            }))
            .filter((r) => Number.isFinite(r.ts) && Number.isFinite(r.value))
            .sort((a, b) => a.ts - b.ts);
        if (sorted.length === 0) {
            return { latestValue: null, previousValue: null, latestTimestamp: null };
        }
        const last = sorted[sorted.length - 1];
        const prev = sorted.length > 1 ? sorted[sorted.length - 2] : null;
        return {
            latestValue: last.value,
            previousValue: prev ? prev.value : null,
            latestTimestamp: last.ts,
        };
    }, [data, xKey, yKey]);

    const direction = React.useMemo(() => {
        if (latestValue == null || previousValue == null) return 0;
        if (latestValue > previousValue) return 1;
        if (latestValue < previousValue) return -1;
        return 0;
    }, [latestValue, previousValue]);

    const trendStatus = React.useMemo(() => {
        if (desiredTrend !== "up" && desiredTrend !== "down") return "flat";
        if (direction === 0) return "flat";
        const desiredDir = desiredTrend === "up" ? 1 : -1;
        return direction === desiredDir ? "positive" : "negative";
    }, [desiredTrend, direction]);

    const trendPalette = theme.colors.trend ?? {};
    const chipBackground = trendStatus === "positive"
        ? trendPalette.positiveSurface
        : trendStatus === "negative"
            ? trendPalette.negativeSurface
            : trendPalette.flatSurface;
    const chipIconColor = trendStatus === "positive"
        ? trendPalette.positiveOnSurface
        : trendStatus === "negative"
            ? trendPalette.negativeOnSurface
            : trendPalette.flatOnSurface;
    const chipTextColor = trendStatus === "positive"
        ? trendPalette.positiveOnSurfaceText
        : trendStatus === "negative"
            ? trendPalette.negativeOnSurfaceText
            : trendPalette.flatOnSurfaceText;

    const subtitle = React.useMemo(
        () => formatLastUpdated(latestTimestamp),
        [latestTimestamp],
    );

    const trendIcon = direction > 0
        ? "chevron-up"
        : direction < 0
            ? "chevron-down"
            : "minus";

    const renderChip = React.useCallback(() => {
        if (loading) {
            return (
                <Chip
                    compact
                    icon={() => (
                        <ActivityIndicator
                            size={14}
                            color={trendPalette.flatOnSurface}
                        />
                    )}
                    style={{ backgroundColor: trendPalette.flatSurface }}
                    textStyle={{ color: trendPalette.flatOnSurfaceText }}
                >
                    Loading
                </Chip>
            );
        }

        if (dataSourceErrored || stateErrored) {
            return (
                <Chip
                    compact
                    icon="alert-circle-outline"
                    style={{ backgroundColor: theme.colors.errorContainer }}
                    textStyle={{ color: theme.colors.onErrorContainer }}
                >
                    Error
                </Chip>
            );
        }

        if (latestValue == null) {
            return (
                <Chip
                    compact
                    icon="minus-circle-outline"
                    style={{ backgroundColor: trendPalette.flatSurface }}
                    textStyle={{ color: trendPalette.flatOnSurfaceText }}
                >
                    No data
                </Chip>
            );
        }

        return (
            <Chip
                compact
                icon={SHOW_TREND_ICON
                    ? () => (
                        <Icon
                            source={trendIcon}
                            size={16}
                            color={chipIconColor}
                        />
                    )
                    : undefined}
                style={{ backgroundColor: chipBackground }}
                textStyle={[styles.chipText, { color: chipTextColor }]}
            >
                {formatValue(latestValue)}
            </Chip>
        );
    }, [
        loading,
        dataSourceErrored,
        stateErrored,
        latestValue,
        trendIcon,
        chipBackground,
        chipIconColor,
        chipTextColor,
        trendPalette.flatSurface,
        trendPalette.flatOnSurfaceText,
        trendPalette.flatOnSurface,
        theme.colors.errorContainer,
        theme.colors.onErrorContainer,
    ]);

    const openMenu = React.useCallback(() => setMenuVisible(true), []);
    const closeMenu = React.useCallback(() => setMenuVisible(false), []);

    const handleMenuAction = (action) => () => {
        closeMenu();
        action?.(item?.id);
    };

    const renderRight = React.useCallback(
        () => (
            <View style={styles.rightSlot}>
                {renderChip()}
                {showMenu ? (
                    <Menu
                        visible={menuVisible}
                        onDismiss={closeMenu}
                        anchor={
                            <IconButton
                                icon="dots-vertical"
                                size={20}
                                onPress={openMenu}
                                accessibilityLabel="Metric options"
                            />
                        }
                    >
                        <Menu.Item
                            leadingIcon="pencil-outline"
                            onPress={handleMenuAction(onEdit)}
                            title="Edit metric"
                        />
                        <Menu.Item
                            leadingIcon="view-dashboard-outline"
                            onPress={handleMenuAction(onAddToBoard)}
                            title="Add metric to board"
                        />
                        <Menu.Item
                            leadingIcon="delete-outline"
                            onPress={handleMenuAction(onDelete)}
                            title="Delete metric"
                            titleStyle={{ color: theme.colors.error }}
                        />
                    </Menu>
                ) : null}
            </View>
        ),
        [
            renderChip,
            showMenu,
            menuVisible,
            openMenu,
            closeMenu,
            onEdit,
            onDelete,
            onAddToBoard,
            theme.colors.error,
        ],
    );

    return (
        <Card
            mode="elevated"
            style={styles.card}
            onPress={onPress ? () => onPress(item?.id) : undefined}
        >
            <Card.Title
                title={item?.name ?? "Untitled metric"}
                titleVariant="titleMedium"
                titleNumberOfLines={1}
                subtitle={subtitle}
                subtitleVariant="bodySmall"
                right={renderRight}
                rightStyle={showMenu ? styles.rightStyleWithMenu : styles.rightStyle}
            />
            {isEditing && !disableEditActions ? (
                <View style={styles.editOverlay} pointerEvents="box-none">
                    <IconButton
                        icon="pencil"
                        size={18}
                        onPress={() => onEdit?.(item)}
                        iconColor={editIconColor}
                        containerColor={editContainerColor}
                        accessibilityLabel="Edit board item"
                    />
                </View>
            ) : null}
        </Card>
    );
};

const formatValue = (value) => {
    if (!Number.isFinite(value)) return "—";
    const abs = Math.abs(value);
    if (abs >= 1000) return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
    if (Number.isInteger(value)) return String(value);
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
};

const styles = StyleSheet.create({
    card: {
        flex: 1,
        justifyContent: "center",
    },
    rightStyle: {
        marginRight: 16,
    },
    rightStyleWithMenu: {
        marginRight: 0,
    },
    rightSlot: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 4,
    },
    chipIcon: {
        margin: 0,
    },
    chipText: {
        fontWeight: "600",
    },
    editOverlay: {
        position: "absolute",
        top: 4,
        right: 4,
        zIndex: 2,
    },
});

export default SimpleMetricCard;