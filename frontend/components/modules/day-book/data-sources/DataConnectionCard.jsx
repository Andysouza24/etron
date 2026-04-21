// Author(s): Holly Wyatt, Noah Bradley

import { View } from "react-native";
import { Card, IconButton } from "react-native-paper";
import PermissionGate from "../../../common/PermissionGate";
import StatusChip from "../../../common/StatusChip";

const DataConnectionCard = ({
    label,
    subtitle,
    status,
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
    return (
        <Card style={{ borderRadius: 12, overflow: "hidden" }} onPress={onNavigate}>
            <Card.Title
                title={label}
                subtitle={subtitle}
                right={() => <StatusChip status={status} style={{ marginRight: 16 }} />}
            />
            <Card.Actions style={{ justifyContent: "space-between", paddingHorizontal: 8, paddingBottom: 8 }}>
                <View style={{ flexDirection: "row" }}>
                    {onSync && <IconButton icon="play-circle" accessibilityLabel="Sync" onPress={onSync} />}
                    <PermissionGate allowed={manageDataSourceAllowed}>
                        <IconButton icon="cog" accessibilityLabel="Settings" onPress={onSettings} />
                    </PermissionGate>
                    <PermissionGate allowed={manageDataSourceAllowed}>
                        <IconButton icon="lan-pending" accessibilityLabel="Test Connection" onPress={onTest} />
                    </PermissionGate>
                    <PermissionGate allowed={viewDataAllowed} onAllowed={onViewData}>
                        <IconButton icon="table-eye" accessibilityLabel="View Data" />
                    </PermissionGate>
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
