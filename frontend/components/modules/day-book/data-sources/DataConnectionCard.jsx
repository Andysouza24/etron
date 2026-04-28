// Author(s): Holly Wyatt, Noah Bradley

import { View } from "react-native";
import { Card, IconButton, Text, useTheme } from "react-native-paper";
import PermissionGate from "../../../common/PermissionGate";
import StatusChip from "../../../common/StatusChip";
import CircularProgress from "../../../common/CircularProgress";

const DataConnectionCard = ({
    label,
    subtitle,
    status,
    progressStage,
    progressPercent,
    onNavigate,
    onSync,
    onDelete,
    onTest,
    onSettings,
    onViewData,
    onUpload,
    uploading = false,
    viewDataAllowed = false,
    manageDataSourceAllowed = false,
}) => {
    const theme = useTheme();
    const isProcessing = (status || "").toLowerCase() === "processing";
    const showProgress = false; // moved into the StatusChip; keep section here for future re-enable
    const fraction = typeof progressPercent === "number"
        ? Math.max(0, Math.min(1, progressPercent / 100))
        : undefined;

    return (
        <Card style={{ borderRadius: 12, overflow: "hidden" }} onPress={onNavigate}>
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
            {showProgress && (
                <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 8 }}>
                    <CircularProgress
                        progress={fraction}
                        size={36}
                        strokeWidth={4}
                        accessibilityLabel={progressStage ? `Processing: ${progressStage}` : "Processing"}
                    />
                    <View style={{ marginLeft: 12, flex: 1 }}>
                        <Text variant="labelMedium" style={{ color: theme.colors.onSurface }}>
                            {progressStage || "Processing"}
                        </Text>
                        {typeof progressPercent === "number" && (
                            <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                {Math.round(progressPercent)}%
                            </Text>
                        )}
                    </View>
                </View>
            )}
            <Card.Actions style={{ justifyContent: "space-between", paddingHorizontal: 8, paddingBottom: 8 }}>
                <View style={{ flexDirection: "row" }}>
                    {onSync && (status !== "processing" || status !== "pending") &&
                        <IconButton icon="play-circle" accessibilityLabel="Sync" onPress={onSync} />
                    }
                    <PermissionGate allowed={manageDataSourceAllowed}>
                        <IconButton icon="cog" accessibilityLabel="Settings" onPress={onSettings} />
                    </PermissionGate>
                    { status !== "processing" && status !== "pending" &&
                        <PermissionGate allowed={manageDataSourceAllowed}>
                            <IconButton icon="lan-pending" accessibilityLabel="Test Connection" onPress={onTest} />
                        </PermissionGate>
                    }
                    { status === "active" &&
                        <PermissionGate allowed={viewDataAllowed} onAllowed={onViewData}>
                            <IconButton icon="table-eye" accessibilityLabel="View Data" />
                        </PermissionGate>
                    }
                    {onUpload && (
                        <IconButton
                            icon={uploading ? "progress-upload" : "upload"}
                            accessibilityLabel="Upload CSV"
                            onPress={onUpload}
                            disabled={uploading}
                        />
                    )}
                </View>
                <PermissionGate allowed={manageDataSourceAllowed}>
                    <IconButton icon="delete-outline" accessibilityLabel="Delete" onPress={onDelete} />
                </PermissionGate>
            </Card.Actions>
        </Card>
    );
};

export default DataConnectionCard;
