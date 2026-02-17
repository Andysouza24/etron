// Author(s): Matthew Page

import React, { useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import Header from "../../../../../../components/layout/Header";
import StackLayout from "../../../../../../components/layout/StackLayout";
import DescriptiveButton from "../../../../../../components/common/buttons/DescriptiveButton";
import ResponsiveScreen from "../../../../../../components/layout/ResponsiveScreen";
import PermissionGate from "../../../../../../components/common/PermissionGate";
import { hasPermission } from "../../../../../../utils/permissions";
import { useHasPermission } from "../../../../../../hooks/useHasPermission";

const ReportsMenuItem = ({ item }) => {
    const allowed = hasPermission(item.permKey);
    return (
        <PermissionGate
            key={item.label}
            allowed={allowed}
            onAllowed={item.onPress}
        >
            <DescriptiveButton
                icon={item.icon}
                label={item.label}
                description={item.description}
            />
        </PermissionGate>
    );
}

const ReportsAndExportsManagement = () => {
    const menuButtonMap = useMemo(() => [
        {
            permKey: "modules.daybook.reports.view_reports",
            icon: "",
            label: "Reports",
            description: "Create, manage and export reports",
            onPress: () => router.navigate("/modules/day-book/reports/reports"),
        },
        {
            permKey: "modules.daybook.reports.manage_templates",
            icon: "",
            label: "View Templates",
            description: "View and edit all created templates",
            onPress: () => router.navigate("/modules/day-book/reports/templates"),
        },
        {
            permKey: "modules.daybook.reports.manage_exports",
            icon: "",
            label: "Export Metrics",
            description: "Export selected metrics as an image",
            onPress: () => router.navigate("/modules/day-book/reports/metric-selection"),
        },
        {
            permKey: "modules.daybook.reports.view_exports",
            icon: "",
            label: "View Exports",
            description: "View all past exported reports and metrics (up to 1 year prior)",
            onPress: () => router.navigate("/modules/day-book/reports/exports"),
        },
    ], []);
    return (
        <ResponsiveScreen
            header={<Header title="Reports and Exports" showMenu />}
            center={false}
            scroll={true}
        >
            <StackLayout spacing={12}>
                {menuButtonMap.map((item) => {
                    <ReportsMenuItem key={item.label} item={item} />
                })}
            </StackLayout>
            </ResponsiveScreen>
    );
};

export default ReportsAndExportsManagement;