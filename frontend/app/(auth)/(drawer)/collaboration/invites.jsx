// Author(s): Matthew Page

import { useEffect, useState, useCallback } from "react";
import { View, FlatList, Pressable, StyleSheet, TouchableOpacity } from "react-native";
import { ActivityIndicator, Card, Text, useTheme, List, Divider, IconButton, Dialog, Portal, Button, Snackbar } from "react-native-paper";
import { router } from "expo-router";

import Header from "../../../../components/layout/Header";
import { commonStyles } from "../../../../assets/styles/stylesheets/common";
import { apiGet, apiDelete } from "../../../../utils/api/apiClient";
import endpoints from "../../../../utils/api/endpoints";
import { getWorkspaceId } from "../../../../storage/workspaceStorage";
import ResponsiveScreen from "../../../../components/layout/ResponsiveScreen";
import ThemedRefreshControl from "../../../../components/common/ThemedRefreshControl";
import formatTTLDate from "../../../../utils/format/formatTTLDate";
import { useFocusEffect } from "@react-navigation/native";
import { hasPermission } from "../../../../utils/permissions";


const Invites = () => {
	const theme = useTheme();
	const [invites, setInvites] = useState([]);
	const [roles, setRoles] = useState([]);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(true);
	const [workspaceId, setWorkspaceId] = useState("");
	const [inviteUserPermission, setInviteUserPermission] = useState(false);

	useEffect(() => {
		loadInvitesAndRoles();
		loadPermission();
	}, []);

	async function loadPermission() {
		const inviteUserPermission = await hasPermission("app.collaboration.invite_user");
		setInviteUserPermission(inviteUserPermission);
	}

	useFocusEffect(
		useCallback(() => {
			setRefreshing(true);
			loadInvitesAndRoles();
		}, [loadInvitesAndRoles])
	)

	const loadInvitesAndRoles = useCallback(async () => {
		const workspaceId = await getWorkspaceId();
		setWorkspaceId(workspaceId);

		try {
			const result = await apiGet(endpoints.workspace.invites.getInvitesSent(workspaceId));
			const invites = result.data;
			setInvites(Array.isArray(invites) ? invites : []);
		} catch (error) {
			console.error("Failed to fetch invites:", error);
		}

		try {
			const result = await apiGet(endpoints.workspace.roles.getRoles(workspaceId));
			const roles = result.data;
			setRoles(roles);
		} catch (error) {
			console.error("Failed to fetch roles:", error);
		}

		setLoading(false);
		setRefreshing(false)
	}, []);

	const handleDelete = async (inviteId) => {
		setRefreshing(true);
		try {
			await apiDelete(endpoints.workspace.invites.cancelInvite(workspaceId, inviteId));
		} catch (error) {
			console.error("Failed to delete invite:", error);
		}
		loadInvitesAndRoles();
	};

	const renderInviteItem = ({ item }) => (<>
		<List.Item
			title={item.email}
			description={`Role: ${roles.find(role => role.roleId == item.roleId).name}\nExpiry: ${formatTTLDate(
				item.expireAt
			)}`}
			right={(props) => (
				<IconButton
					{...props}
					icon="delete"
					onPress={() => handleDelete(item.inviteId)}
					accessibilityLabel="Delete invite"
				/>
			)}
			style={styles.listItem}
			titleStyle={commonStyles.listItemText}
			descriptionNumberOfLines={2}
		/>
		<Divider />
    </>
	);

	return (
		<ResponsiveScreen
			header={
				<Header
					title="Invites"
					showBack
					showPlus
					onRightIconPress={() => router.navigate({ pathname: "/collaboration/invite-user", params: { navigatedFrom: "invites" } })}
					rightIconPermission={inviteUserPermission}
				/>			
			}
			center={false}
			padded={false}
			scroll={false}
		>

			{loading ? (<>
				<ActivityIndicator size="large" />
				<Text style={{ textAlign: "center", marginTop: 20, color: "#999" }}>
					Loading Invites...
				</Text>
			</>) : (
				<FlatList
					data={invites}
					keyExtractor={(item) => item.inviteId}
					refreshControl = {
						<ThemedRefreshControl refreshing={refreshing} onRefresh={loadInvitesAndRoles} />
					}
					contentContainerStyle={{ paddingVertical: 16 }}
					renderItem={renderInviteItem}
					ListEmptyComponent={
						<Text style={{ textAlign: "center", marginTop: 20 }}>
							No invites sent.
						</Text>
					}
				/>
			)}
		</ResponsiveScreen>
	);
};

const styles = StyleSheet.create({
	inviteBox: {
		borderWidth: 1,
		borderColor: "#ccc",
		borderRadius: 4,
		padding: 16,
		marginVertical: 2,
		marginHorizontal: 12,
	},
	centered: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
	},
});

export default Invites;
