// Author(s): Matthew Page, Noah Bradley

import { View, StyleSheet, Alert } from "react-native";
import { ActivityIndicator, Card, Checkbox, Chip, Snackbar, Text, Portal, Dialog, Button } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useEffect, useMemo, useState, useCallback } from "react";
import { router, useLocalSearchParams } from "expo-router";
import Header from "../../../../../components/layout/Header";
import ResponsiveScreen from "../../../../../components/layout/ResponsiveScreen";
import StackLayout from "../../../../../components/layout/StackLayout";
import TextField from "../../../../../components/common/input/TextField";
import ItemNotFound from "../../../../../components/common/errors/MissingItem";
import PermissionPicker from "../../../../../components/collaboration/PermissionPicker";
import { getWorkspaceId } from "../../../../../storage/workspaceStorage";
import { apiGet, apiPatch } from "../../../../../utils/api/apiClient";
import endpoints from "../../../../../utils/api/endpoints";
import { buildPermissionGroups, normalizePermissionKeys } from "../../../../../utils/permissions/permissionTree";

const MANAGE_ROLES = "app.collaboration.manage_roles";

export default function EditRole() {
	const { roleId } = useLocalSearchParams();

	const [workspaceId, setWorkspaceId] = useState(null);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);

	const [notFound, setNotFound] = useState(false);
	const [snack, setSnack] = useState({ visible: false, text: "" });

	const [role, setRole] = useState(null);
	const [name, setName] = useState("");
	const [selectedPerms, setSelectedPerms] = useState([]);
	const [hideGatedComponents, setHideGatedComponents] = useState(false);

	const [permissionGroups, setPermissionGroups] = useState([]);

	const [currentUserRoleId, setCurrentUserRoleId] = useState(null);
	const [confirmSelfLock, setConfirmSelfLock] = useState(false);

	const [initialValues, setInitialValues] = useState({ name: "", perms: [], hideGated: false });

	const initialValuesChanged = useMemo(() => {
		if ((name || "").trim() !== (initialValues.name || "").trim()) return true;
		if ((hideGatedComponents === true) !== (initialValues.hideGated === true)) return true;

		const selPerms = new Set(selectedPerms);
		const initPerms = new Set(initialValues.perms || []);
		if (selPerms.size !== initPerms.size) return true;
		for (const permission of selPerms) if (!initPerms.has(permission)) return true;
		return false;
	}, [name, selectedPerms, hideGatedComponents, initialValues]);

	const canSave = useMemo(() => {
		return !saving && initialValuesChanged && !!name.trim();
	}, [saving, initialValuesChanged, name]);

	const load = useCallback(async () => {
		try {
			const workspaceId = await getWorkspaceId();
			setWorkspaceId(workspaceId);
			if (!workspaceId) {
				setNotFound(true);
				return;
			}

			let result = await apiGet(endpoints.workspace.roles.getRole(workspaceId, roleId));
			const role = result?.data || null;
			if (!role) {
				setNotFound(true);
				return;
			}
			setRole(role);

			result = await apiGet(endpoints.workspace.core.getDefaultPermissions);
			setPermissionGroups(buildPermissionGroups(result?.data || {}));

			try {
				result = await apiGet(endpoints.workspace.roles.getRoleOfUser(workspaceId));
				setCurrentUserRoleId(result.data.roleId);
			} catch (error) {
				console.warn("Could not determine current user's role:", error);
			}

			const initialName = role.name || "";
			const initialPerms = normalizePermissionKeys(role.permissions);
			const initialHideGated = role.hideGatedComponents === true;

			setName(initialName);
			setSelectedPerms(initialPerms);
			setHideGatedComponents(initialHideGated);

			setInitialValues({
				name: initialName,
				perms: initialPerms,
				hideGated: initialHideGated,
			});

			setNotFound(false);
		} catch (error) {
			console.error("Error loading role/options:", error);
			setNotFound(true);
		} finally {
			setLoading(false);
		}
	}, [roleId]);

	useEffect(() => {
		setLoading(true);
		load();
	}, [load]);

	const willSelfLoseManageRoles = useMemo(() => {
		if (!currentUserRoleId) return false;
		if (currentUserRoleId !== roleId) return false;
		const hadManage = (initialValues.perms || []).includes(MANAGE_ROLES);
		const willHaveManage = selectedPerms.includes(MANAGE_ROLES);
		return hadManage && !willHaveManage;
	}, [currentUserRoleId, roleId, selectedPerms, initialValues]);

	const persistRole = async () => {
		const uniquePermissions = normalizePermissionKeys(selectedPerms);
		await apiPatch(endpoints.workspace.roles.update(workspaceId, roleId), {
			name: name.trim(),
			permissions: uniquePermissions,
			hideGatedComponents: hideGatedComponents === true,
		});
		setSelectedPerms(uniquePermissions);
		setInitialValues({
			name: name.trim(),
			perms: uniquePermissions,
			hideGated: hideGatedComponents === true,
		});
		setSnack({ visible: true, text: "Role updated" });
	};

	const handleSave = async () => {
		try {
			if (willSelfLoseManageRoles) {
				setConfirmSelfLock(true);
				return;
			}
			setSaving(true);
			await persistRole();
		} catch (error) {
			console.error("Error saving role:", error);
			setSnack({ visible: true, text: "Failed to save role" });
		} finally {
			setSaving(false);
		}
	};

	const confirmProceedSelfLock = async () => {
		setConfirmSelfLock(false);
		try {
			setSaving(true);
			await persistRole();
		} catch (error) {
			console.error("Error saving role (confirmed):", error);
			setSnack({ visible: true, text: "Failed to save role" });
		} finally {
			setSaving(false);
		}
	};

	const handleBack = async () => {
		if (!initialValuesChanged) return router.back();
		const proceed = await new Promise((resolve) => {
			Alert.alert(
				"Discard changes?",
				"You have unsaved changes to this role.",
				[
					{ text: "Cancel", style: "cancel", onPress: () => resolve(false) },
					{ text: "Discard", style: "destructive", onPress: () => resolve(true) },
				]
			);
		});
		if (proceed) router.back();
	};

	const insets = useSafeAreaInsets();

	return (
		<ResponsiveScreen
			header={
				<Header
					title={"Edit Role"}
					showBack
					showCheck={canSave}
					onRightIconPress={handleSave}
					onBackPress={handleBack}
				/>
			}
			center={notFound}
			tapToDismissKeyboard={false}
		>
			{loading ? (
				<View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
					<ActivityIndicator size="large" />
				</View>
			) : notFound ? (
				<ItemNotFound
					icon="shield-alert-outline"
					item="role"
					itemId={roleId}
					listRoute="/collaboration/roles"
				/>
			) : (
				<StackLayout spacing={16}>
					{willSelfLoseManageRoles && (
						<Chip icon="alert" style={{ marginBottom: 16 }} selected>
							You&apos;re removing your own &ldquo;Manage Roles&rdquo; permission.
						</Chip>
					)}
					<Card style={styles.card}>
						<TextField
							label="Role Name"
							placeholder="Role Name"
							value={name}
							onChangeText={setName}
						/>
					</Card>

					{/* TODO: Board access per role should be handled via the permission gating system in the future. */}
					{!role.owner && (
						<>
							<Card style={styles.card}>
								<Checkbox.Item
									label="Hide components users can't access"
									status={hideGatedComponents ? "checked" : "unchecked"}
									onPress={() => setHideGatedComponents((prev) => !prev)}
									position="leading"
									style={styles.toggleRow}
								/>
								<Text style={styles.toggleHelp}>
									When on, buttons, menu items, and other actions this role can&apos;t use are removed from view instead of shown as disabled.
								</Text>
							</Card>
							<PermissionPicker
								groups={permissionGroups}
								selectedPerms={selectedPerms}
								onChange={setSelectedPerms}
							/>
						</>
					)}
				</StackLayout>
			)}

			<Portal>
				<Snackbar
					visible={snack.visible}
					onDismiss={() => setSnack((s) => ({ ...s, visible: false }))}
					duration={2200}
					wrapperStyle={{
						bottom: (insets?.bottom ?? 0) + 12,
						alignItems: "center",
						justifyContent: "center",
					}}
				>
					{snack.text}
				</Snackbar>

				<Dialog visible={confirmSelfLock} onDismiss={() => setConfirmSelfLock(false)}>
					<Dialog.Icon icon="shield-alert" />
					<Dialog.Title>Remove your own ability to manage roles?</Dialog.Title>
					<Dialog.Content>
						<Text>
							You&rsquo;re removing the &ldquo;Manage Roles&rdquo; permission from the role you currently hold. After saving, you won&apos;t be able to continue editing roles.
						</Text>
					</Dialog.Content>
					<Dialog.Actions>
						<Button onPress={() => setConfirmSelfLock(false)}>Cancel</Button>
						<Button onPress={confirmProceedSelfLock} textColor="#b00020">Proceed</Button>
					</Dialog.Actions>
				</Dialog>
			</Portal>
		</ResponsiveScreen>
	);
}

const styles = StyleSheet.create({
	card: { marginTop: 16 },
	toggleRow: { paddingHorizontal: 8, paddingVertical: 4 },
	toggleHelp: { paddingHorizontal: 16, paddingBottom: 12, opacity: 0.7, fontSize: 12 },
});
