import React from "react";
import { View } from "react-native";
import { ActivityIndicator, Button, Text } from "react-native-paper";
import DropDown from "../../../../common/input/DropDown";
import PermissionGate from "../../../../common/PermissionGate";

export default function DataSourceSelector({
    dropdownItems,
    selectedValue,
    onSelect,
    downloadStatus,
    viewDataPermission,
    onViewData,
    onViewExistingMetrics,
    dataSourceId,
    children,
}) {
    return (
        <>
            <DropDown
                title="Select Data Source"
                items={dropdownItems}
                onSelect={onSelect}
                value={selectedValue}
            />

            {downloadStatus === "unstarted" && <Text>No data source selected</Text>}
            {downloadStatus === "downloading" && <ActivityIndicator size="large" />}
            {downloadStatus === "downloaded" && (
                <>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center" }}>
                        <PermissionGate allowed={viewDataPermission}>
                            <Button icon="file" mode="text" onPress={onViewData}>
                                View Data
                            </Button>
                        </PermissionGate>

                        {dataSourceId && (
                            <Button icon="chart-box-outline" mode="text" onPress={onViewExistingMetrics}>
                                View Existing Metrics
                            </Button>
                        )}
                    </View>

                    {children}
                </>
            )}
        </>
    );
}
