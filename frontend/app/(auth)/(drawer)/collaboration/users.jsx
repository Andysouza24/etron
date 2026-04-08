// Author(s): Matthew Page

import { Pressable, View, SectionList, Text as RNText, ActivityIndicator, StyleSheet } from "react-native";
import Header from "../../../../components/layout/Header";
import { commonStyles } from "../../../../assets/styles/stylesheets/common";
import { router } from "expo-router";
import { Text, TextInput, TouchableRipple, Chip, ProgressBar } from "react-native-paper";
import { useEffect, useState, useCallback } from "react";
import { apiGet } from "../../../../utils/api/apiClient";
import { getWorkspaceId } from "../../../../storage/workspaceStorage";
import endpoints from "../../../../utils/api/endpoints";
import ResponsiveScreen from "../../../../components/layout/ResponsiveScreen";
import { useFocusEffect } from "@react-navigation/native";
import { RefreshControl } from "react-native";
import { hasPermission } from "../../../../utils/permissions";

const Users = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [allRoles, setAllRoles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedRoles, setSelectedRoles] = useState([]);
    const [groupedUsers, setGroupedUsers] = useState([]);
    const [allUsers, setAllUsers] = useState([]);
    const [inviteUserPermission, setInviteUserPermission] = useState(false);

    useEffect(() => {
        setLoading(true);
        loadPermission();
        loadUsersAndRoles();
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadUsersAndRoles();
        }, [loadUsersAndRoles])
    );

    async function loadPermission() {
        const inviteUserPermission = await hasPermission("app.collaboration.invite_user");
        setInviteUserPermission(inviteUserPermission);
    }

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            await loadUsersAndRoles();
        } finally {
            setRefreshing(false);
        }
    }, [loadUsersAndRoles]);

    const loadUsersAndRoles = useCallback(async () => {
        const workspaceId = await getWorkspaceId();

        let users = [];
        try {
            const result = await apiGet(endpoints.workspace.users.getUsers(workspaceId));
            users = Array.isArray(result?.data) ? result.data : [];
            setAllUsers(users);
        } catch (error) {
            console.error("Failed to fetch users:", error);
            users = [];
        }

        let roles = []
        try {
            const result = await apiGet(endpoints.workspace.roles.getRoles(workspaceId));
            roles = Array.isArray(result?.data) ? result.data : [];
            setAllRoles(roles);
        } catch (error) {
            console.error("Failed to fetch workspace roles:", error);
            roles = [];
        }

        sortUsers(users, roles);

        setLoading(false);
        setRefreshing(false);
    });

    function sortUsers(users = allUsers, roles = allRoles) {
        const normalizedUsers = Array.isArray(users) ? users : [];
        const normalizedRoles = Array.isArray(roles) ? roles : [];
        const normalizedSelectedRoles = Array.isArray(selectedRoles) ? selectedRoles : [];

        const filteredUsers = normalizedUsers.filter(user => {
            const matchesSearch = (user?.name || user?.email || '')
                .toLowerCase()
                .includes(searchQuery.toLowerCase());

            const matchesRole = normalizedSelectedRoles.length === 0 || normalizedSelectedRoles.some(role => role?.roleId === user?.roleId);
            return matchesSearch && matchesRole;
        });

        const rolesForSort = normalizedSelectedRoles.length > 0 ? normalizedSelectedRoles : normalizedRoles;

        if (!rolesForSort.length) {
            setGroupedUsers([
                {
                    title: 'Members',
                    data: filteredUsers
                }
            ]);
            return;
        }

        const sortedUsers = rolesForSort.map(role => {
            const roleId = role?.roleId;
            return {
                title: role?.name || 'Members',
                data: filteredUsers.filter(user => user?.roleId === roleId)
            };
        });
        setGroupedUsers(sortedUsers)
    }

    const handleSearchChange = (query) => {
        setSearchQuery(query);
    };

    const handleToggleRole = (role) => {
        setSelectedRoles(prev =>
            prev.includes(role)
                ? prev.filter(r => r !== role)
                : [...prev, role]
        );
    };

    useEffect(() => {
        sortUsers();
    }, [selectedRoles, searchQuery])

    return (
		<ResponsiveScreen
			header={
                <Header
                    title="Users"
                    showBack
                    showPlus
                    onRightIconPress={() => router.navigate({ pathname: "/collaboration/invite-user", params: { navigatedFrom: "users" } })}
                    rightIconPermission={inviteUserPermission}
                />            
            }
			center={false}
            scroll={false}
            tapToDismissKeyboard={false}
		>

            {/* Search Box */}
            <TextInput
                label="Search..."
                value={searchQuery}
                onChangeText={handleSearchChange}
                mode="outlined"
            />

            {/* Role Filters */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {allRoles.map(role => (
                    <Chip
                        key={role.roleId}
                        mode="outlined"
                        selected={selectedRoles.includes(role)}
                        onPress={() => handleToggleRole(role)}
                        style={{ marginRight: 8 }}
                    >
                        {role.name}
                    </Chip>
                ))}
            </View>

            {/* Sectioned User List */}
            <View style={{flex:1}}>
                <SectionList
                    sections={groupedUsers}
                    keyExtractor={(item) => item.userId}
                    keyboardDismissMode="on-drag"
                    keyboardShouldPersistTaps="handled"
                    stickySectionHeadersEnabled={false}
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    style={{ flex:1 }}
                    renderSectionHeader={({ section: { title } }) => (
                        <Pressable
                            onStartShouldSetResponder={() => true}
                            onMoveShouldSetResponder={() => true}
                            hitSlop={8}
                            style={{ paddingVertical: 6 }}
                        >
                            <Text style={{ fontWeight: 'bold' }}>{title}</Text>
                        </Pressable>
                    )}
                    renderItem={({ item }) => (
                        <TouchableRipple
                            style={{
                                borderWidth: 1,
                                borderColor: '#e0e0e0',
                                borderRadius: 4,
                                padding: 12,
                                marginVertical: 4
                            }}
                            onPress={() => router.navigate(`/collaboration/view-user/${item.userId}`)}
                        >
                            <>
                                <Text style={commonStyles.listItemText}>{item.given_name + " " + item.family_name}</Text>
                                <Text style={commonStyles.captionText}>{item.email}</Text>
                            </>
                        </TouchableRipple>
                    )}
                    ListEmptyComponent={
                        loading ? (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" />
                                <RNText style={{ textAlign: 'center', marginTop: 16, color: '#999' }}>
                                    Loading Users...
                                </RNText>
                            </View> 
                        ) : (
                            <RNText style={{ textAlign: 'center', marginTop: 16, color: '#999' }}>
                                No users found
                            </RNText>
                        )
                    }
                />
            </View>
        </ResponsiveScreen>
    );
};

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center"
    },
})

export default Users;
