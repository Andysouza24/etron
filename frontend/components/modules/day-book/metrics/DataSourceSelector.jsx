import React from "react";
import { ActivityIndicator, Button, Text } from "react-native-paper";
import DropDown from "../../../common/input/DropDown";
import PermissionGate from "../../../common/PermissionGate";

export default function DataSourceSelector({
    dropdownItems,
    selectedValue,
    onSelect,
    downloadStatus,
    viewDataPermission,
    onViewData,
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
                    <PermissionGate allowed={viewDataPermission}>
                        <Button icon="file" mode="text" onPress={onViewData}>
                            View Data
                        </Button>
                    </PermissionGate>
                    {children}
                </>
            )}
        </>
    );
}
