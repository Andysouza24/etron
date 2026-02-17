// Author(s): Rhys Cleary

import { useRouter } from "expo-router";
import { useTheme } from "react-native-paper";
import { useEffect, useState } from "react";
import Header from "../../../../components/layout/Header";
import { commonStyles } from "../../../../assets/styles/stylesheets/common";
import DescriptiveButton from "../../../../components/common/buttons/DescriptiveButton";
import StackLayout from "../../../../components/layout/StackLayout";
import ResponsiveScreen from "../../../../components/layout/ResponsiveScreen";
import { hasPermission } from "../../../../utils/permissions";
import PermissionGate from "../../../../components/common/PermissionGate";
import { useHasPermission } from "../../../../hooks/useHasPermission";

const CollaborationItem = ({ item }) => {
    const router = useRouter();
    const { allowed } = useHasPermission(item.permKey);

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
    )
}

const Collaboration = () => {

    const router = useRouter();
    const theme = useTheme();

    // container for different collaboration options
    const workspaceOptionButtons = [
        {
            label: "Users", 
            description: "Manage users in the workspace", 
            onPress: () => router.push("collaboration/users"),
            permKey: "app.collaboration.manage_users"
        },
        {
            label: "Roles",
            description: "Manage permissions in the workspace",
            onPress: () => router.navigate("collaboration/roles"),
            permKey: "app.collaboration.view_roles"
        },
        {
            label: "Invites",
            description: "Manage invites to the workspace",
            onPress: () => router.navigate("collaboration/invites"),
            permKey: "app.collaboration.view_invites"
        },
        {
            label: "Workspace Log",
            description: "Audit log of actions within the workspace",
            onPress: () => router.navigate("collaboration/workspace-log"),
            permKey: "app.collaboration.app.audit.view_workspace_audit_log"
        }
    ];  

    return (
		<ResponsiveScreen
			header={
                <Header title="Collaboration" showMenu />
            }
			center={false}
            scroll={true}
		>
            <StackLayout spacing={12}>
                {workspaceOptionButtons.map((item) => (
                    <CollaborationItem item={item}
                        key={item.label}
                        allowed={item.allowed}
                        onAllowed={item.onPress}
                    />
                ))}
            </StackLayout>
        </ResponsiveScreen>
    )
}

export default Collaboration;