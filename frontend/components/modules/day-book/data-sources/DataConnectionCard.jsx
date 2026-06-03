// Author(s): Holly Wyatt, Noah Bradley
// Card for non-dashboard data sources (API, database, local CSV, etc.).
// Per data-source UX refactor:
//   - test-connection lives on the view-data-source / edit screens only
//   - settings (cog) lives on the view-data-source screen only
//   - refresh/rescan is dashboard-only (see DashboardConnectionCard)
//   - subtitle shows last sync time instead of source type

import { View } from "react-native";
import { Card, IconButton } from "react-native-paper";
import PermissionGate from "../../../common/PermissionGate";
import StatusChip from "../../../common/StatusChip";

const DataConnectionCard = ({
    label,
    subtitle,
    status,
    progressPercent,
    onNavigate,
    onDelete,
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
                right={() => (
                    <StatusChip
                        status={status}
                        progressPercent={progressPercent}
                        style={{ marginRight: 16 }}
                    />
                )}
            />
            <Card.Actions style={{ justifyContent: "space-between", paddingHorizontal: 8, paddingBottom: 8 }}>
                <View style={{ flexDirection: "row" }}>
                    {status === "active" && (
                        <PermissionGate allowed={viewDataAllowed} onAllowed={onViewData}>
                            <IconButton icon="table-eye" accessibilityLabel="View Data" />
                        </PermissionGate>
                    )}
                    {onUpload && (
                        <IconButton
                            icon={uploading ? "progress-upload" : "upload"}
                            accessibilityLabel="Upload CSV"
                            onPress={onUpload}
                            disabled={uploading}
                        />
                    )}
                </View>
                {onDelete && (
                    <PermissionGate allowed={manageDataSourceAllowed}>
                        <IconButton icon="delete-outline" accessibilityLabel="Delete" onPress={onDelete} />
                    </PermissionGate>
                )}
            </Card.Actions>
        </Card>
    );
};

export default DataConnectionCard;
