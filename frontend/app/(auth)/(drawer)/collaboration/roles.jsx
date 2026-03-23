// Author(s): Matthew Page, Noah Bradley

import { View, FlatList, RefreshControl } from "react-native";
import Header from "../../../../components/layout/Header";
import { Text, TextInput, TouchableRipple, useTheme, ActivityIndicator } from "react-native-paper";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getWorkspaceId } from "../../../../storage/workspaceStorage";
import { apiGet } from "../../../../utils/api/apiClient";
import endpoints from "../../../../utils/api/endpoints";
import ResponsiveScreen from "../../../../components/layout/ResponsiveScreen";
import { hasPermission } from "../../../../utils/permissions";


const Roles = () => {
    const theme = useTheme();

    const [roles, setRoles] = useState([]);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [manageRolePermission, setManageRolePermission] = useState(false);

    const loadRoles = useCallback(async () => {
        try {
            const workspaceId = await getWorkspaceId();
            const result = await apiGet(endpoints.workspace.roles.getRoles(workspaceId));
            setRoles(Array.isArray(result?.data) ? result.data : []);
        } catch (error) {
            console.error("Error fetching roles:", error);
            setRoles([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        setLoading(true);
        loadPermission();
        loadRoles();
    }, [loadRoles]);

    async function loadPermission() {
        const manageRolePermission = await hasPermission("app.collaboration.manage_roles")
        setManageRolePermission(manageRolePermission);
    }

    useFocusEffect(
        useCallback(() => {
            setRefreshing(true);
                loadRoles();
        }, [loadRoles])
    );

    const filtered = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return roles;
        return roles.filter(role => (role.name || "").toLowerCase().includes(query));
    }, [roles, search]);

    const renderItem = ({ item, index }) => {
        const isLast = index === filtered.length - 1;
        const permissionCount = Array.isArray(item?.permissions) ? item.permissions.length : 0;

        return (<>
            <TouchableRipple
                borderless={false}
                onPress={() => router.navigate(`/collaboration/view-role/${item.roleId}`)}
                style={{
                    backgroundColor: theme.colors.surface,
                    borderRadius: 12,
                    paddingVertical: 14,
                    paddingHorizontal: 16,
                    marginTop: index === 0 ? 12 : 8,
                    borderWidth: 1,
                    borderColor: theme.isV3
                    ? theme.colors.outlineVariant
                    : theme.colors.backdrop?.concat("33") || "#E0E0E0",
                }}
            >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <Text variant="titleMedium" style={{ flex: 1 }}>
                        {item.name}
                    </Text>
                    {!item.owner && (
                        <Text variant="labelMedium" style={{ opacity: 0.6 }}>
                            {permissionCount} perms
                        </Text>
                    )}
                </View>
            </TouchableRipple>
        </>);
    };

    return (
		<ResponsiveScreen
			header={
                <Header
                    title="Roles"
                    showBack
                    showPlus
                    onRightIconPress={() => router.navigate("/collaboration/create-role")}
                    rightIconPermission={manageRolePermission}
                />             
            }
			center={false}
            scroll={false}
            tapToDismissKeyboard={false}
		>
            <View style={{  paddingTop: 8 }}>
                <TextInput
                    mode="outlined"
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Search roles…"
                    left={<TextInput.Icon icon="magnify" />}
                />
            </View>
            {loading ? (
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                    <ActivityIndicator size="large" />
                    <Text style={{ marginTop: 12, opacity: 0.6 }}>Loading roles…</Text>
                </View>
            ) : (
                <FlatList
                    data={filtered}
                    keyExtractor={(item) => item.roleId}
                    renderItem={renderItem}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadRoles(); }} />}
                    ListEmptyComponent={
                        <View style={{ alignItems: "center", marginTop: 48 }}>
                            <Text variant="titleMedium" style={{ marginBottom: 6 }}>
                                {search ? "No matching roles" : "No roles yet"}
                            </Text>
                            <Text style={{ textAlign: "center", opacity: 0.6 }}>
                                {search
                                    ? "Try a different search."
                                    : "Tap the plus button in the header to create a role."}
                            </Text>
                        </View>
                    }
                    contentContainerStyle={{ paddingBottom: 24 }}
                />
            )}
        </ResponsiveScreen>
    );
};

export default Roles;
