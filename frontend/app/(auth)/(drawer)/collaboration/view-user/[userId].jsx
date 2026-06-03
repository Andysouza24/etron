// Author(s): Rhys Cleary

import { useState, useEffect, useCallback } from "react";
import { View, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { Text, TextInput, RadioButton, Dialog, Portal, Button, useTheme, Divider, List, Icon, Avatar} from "react-native-paper";
import { useLocalSearchParams, useRouter } from "expo-router";

import Header from "../../../../../components/layout/Header";
import { commonStyles } from "../../../../../assets/styles/stylesheets/common";
import { apiGet } from "../../../../../utils/api/apiClient";
import endpoints from "../../../../../utils/api/endpoints";
import { getWorkspaceId } from "../../../../../storage/workspaceStorage";
import TextField from "../../../../../components/common/input/TextField";
import AvatarButton from "../../../../../components/common/buttons/AvatarButton";
import { updateUserAttribute } from "aws-amplify/auth";
import StackLayout from "../../../../../components/layout/StackLayout";
import ResponsiveScreen from "../../../../../components/layout/ResponsiveScreen";
import formatDateTime from "../../../../../utils/format/formatISODate";
import { useFocusEffect } from "@react-navigation/native";
import DescriptiveButton from "../../../../../components/common/buttons/DescriptiveButton";
import AvatarDisplay from "../../../../../components/icons/AvatarDisplay";
import ItemNotFound from "../../../../../components/common/errors/MissingItem";
import { hasPermission } from "../../../../../utils/permissions";
import PermissionGate from "../../../../../components/common/PermissionGate";
import { useHasPermission } from "../../../../../hooks/useHasPermission";

const ViewUser = () => {
	const { userId } = useLocalSearchParams();
	const router = useRouter();
	const theme = useTheme();

	const [firstName, setFirstName] = useState("");
	const [lastName, setLastName] = useState("");
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
	const [roleName, setRoleName] = useState("");
    const [joinDate, setJoinDate] = useState("");
	const [profilePicture, setProfilePicture] = useState(null);
    const [loading, setLoading] = useState(true);
    const [userExists, setUserExists] = useState(true);
    const { allowed: manageUserPermission } = useHasPermission("app.collaboration.manage_users");
    const { allowed: viewUserLogPermission } = useHasPermission("app.audit.view_user_audit_log");

    useFocusEffect(
        useCallback(() => {
            loadUser();
        }, [loadUser])
    );

    const loadUser = useCallback(async () => {
        setLoading(true);
        const workspaceId = await getWorkspaceId();

        let user = {};
        try {
            const result = await apiGet(endpoints.workspace.users.getUser(workspaceId, userId));
            user = result.data;
        } catch (error) {
            console.error("Error fetching user:", error);
            setLoading(false);
            return;
        }
        
        if (!user) {
            setUserExists(false);
            setLoading(false);
            return;
        }
        
        let roleName;
        try {
            const result = await apiGet(endpoints.workspace.roles.getRole(workspaceId, user.roleId));
            roleName = result.data.name;
        } catch (error) {
            console.error("Error fetching role details:", error);
            setLoading(false);
            return;
        }

        setFirstName(user.given_name);
        setLastName(user.family_name);
        setName(user.given_name + " " + user.family_name);
        setEmail(user.email);
        setRoleName(roleName);
        setJoinDate(formatDateTime(user.joinedAt));
        
        setLoading(false);
    });

	return (
		<ResponsiveScreen
			header={
                <Header 
                    title={"User"} 
                    showBack 
                    showEdit 
                    onRightIconPress={() => router.navigate(`/collaboration/edit-user/${userId}`)} 
                    rightIconPermission={manageUserPermission}
                />
            }
			center={userExists ? false : true}
            scroll={false}
		>

            { loading ? (
                <View style={commonStyles.centeredContainer}>
                    <ActivityIndicator size="large" />
                </View>
            ) : ( userExists ? (
                <StackLayout>
                    <View style={{ alignItems: "center"}}>
                        <AvatarDisplay
                            imageSource={profilePicture ? { uri: profilePicture } : null}
                            firstName={firstName}
                            lastName={lastName}
                        />
                    </View>

                    <StackLayout>
                        <List.Section>
                            <List.Item title="Name" description={name} />
                            <List.Item title="Email" description={email} />
                            <List.Item title="Role" description={roleName} />
                            <List.Item title="Joined" description={joinDate} />
                        </List.Section>

                        <PermissionGate
                            allowed={viewUserLogPermission}
                            onAllowed={() => router.navigate(`/collaboration/user-log/${userId}`)}
                        >
                            <DescriptiveButton label="User Activity Log" />
                        </PermissionGate>
                    </StackLayout>
                </StackLayout>
            ) : (
                <ItemNotFound
                    icon="account-cancel-outline"
                    item="user"
                    itemId={userId}
                    listRoute="/collaboration/users"
                />
            ))}
		</ResponsiveScreen>
	);
};

export default ViewUser;
