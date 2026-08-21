// Author(s): Holly Wyatt, Noah Bradley
// Card variant for dashboard data sources (micromax-dashboard files, etc.).
// Replaces the regular DataConnectionCard for dashboard-category sources:
//   - no test-connection / settings / view-data icons
//   - refresh/rescan icon sits on the very right
//   - delete is replaced by an enable/disable toggle switch
// Disabled sources still ingest in the background but every user action is
// blocked server-side; the card surfaces the state via the toggle and a muted
// appearance.

import { View, StyleSheet } from "react-native";
import { Card, IconButton, Switch, useTheme } from "react-native-paper";
import PermissionGate from "../../../common/PermissionGate";
import StatusChip from "../../../common/StatusChip";

const DashboardConnectionCard = ({
    label,
    subtitle,
    status,
    progressPercent,
    enabled = true,
    onNavigate,
    onSync,
    onToggleEnabled,
    onViewData,
    viewDataAllowed = false,
    syncing = false,
    manageDataSourceAllowed = false,
}) => {
    const theme = useTheme();
    const isDisabled = enabled === false;
    const isActive = status === "active" || status === "connected";

    return (
        <Card
            style={[
                styles.card,
                isDisabled && { opacity: 0.6 },
            ]}
            onPress={onNavigate}
        >
            <Card.Title
                title={label}
                subtitle={subtitle}
                right={() => (
                    <StatusChip
                        status={status}
                        progressPercent={progressPercent}
                        style={{ marginRight: 16 }}
                    />
                )}
            />
            <Card.Actions style={styles.actions}>
                <View style={styles.leftGroup}>
                    {isActive && onViewData && (
                        <PermissionGate allowed={viewDataAllowed} onAllowed={onViewData}>
                            <IconButton icon="table-eye" accessibilityLabel="View Data" />
                        </PermissionGate>
                    )}
                </View>
                <View style={styles.rightGroup}>
                    {onSync && (
                        <PermissionGate allowed={manageDataSourceAllowed}>
                            <IconButton
                                icon={syncing ? "progress-clock" : "refresh"}
                                accessibilityLabel="Refresh data source"
                                onPress={onSync}
                                disabled={syncing || isDisabled}
                            />
                        </PermissionGate>
                    )}
                    {onToggleEnabled && (
                        <PermissionGate allowed={manageDataSourceAllowed}>
                            <Switch
                                value={!isDisabled}
                                onValueChange={(next) => onToggleEnabled?.(next)}
                                accessibilityLabel={
                                    isDisabled
                                        ? "Enable data source"
                                        : "Disable data source"
                                }
                                color={theme.colors.primary}
                            />
                        </PermissionGate>
                    )}
                </View>
            </Card.Actions>
        </Card>
    );
};

export default DashboardConnectionCard;

const styles = StyleSheet.create({
    card: {
        borderRadius: 12,
        overflow: "hidden",
    },
    actions: {
        justifyContent: "space-between",
        paddingHorizontal: 8,
        paddingBottom: 8,
    },
    leftGroup: {
        flexDirection: "row",
        alignItems: "center",
    },
    rightGroup: {
        flexDirection: "row",
        alignItems: "center",
    },
});
