// Author(s): Matthew Page, Noah Bradley

import { View, StyleSheet, Alert } from "react-native";
import Header from "../../../../../components/layout/Header";
import { ActivityIndicator, Card, Checkbox, Chip, List, Snackbar, Text, Portal, Dialog, Button } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { getWorkspaceId } from "../../../../../storage/workspaceStorage";
import { apiGet, apiPatch } from "../../../../../utils/api/apiClient";
import endpoints from "../../../../../utils/api/endpoints";
import { router, useLocalSearchParams } from "expo-router";
import ResponsiveScreen from "../../../../../components/layout/ResponsiveScreen";
import TextField from "../../../../../components/common/input/TextField";
import ItemNotFound from "../../../../../components/common/errors/MissingItem";
import StackLayout from "../../../../../components/layout/StackLayout";

const MANAGE_ROLES = "app.collaboration.manage_roles";

const normalizePermissionKeys = (list) => {
	if (!Array.isArray(list)) return [];
	const keys = list
		.map((entry) => {
			if (!entry) return null;
			if (typeof entry === "string") return entry;
			if (typeof entry === "object") {
				if (typeof entry.key === "string") return entry.key;
				if (typeof entry.permission === "string") return entry.permission;
			}
			return null;
		})
		.filter(Boolean);

	return Array.from(new Set(keys));
};

function buildPermissionGroups(tree) {
	const permissionGroups = [];

	if (tree.app?.categories) {
		const appCategories = tree.app.categories;
		const categories = Object.keys(appCategories).map((key) => {
			const category = appCategories[key];
			return {
				section: tree.app.label,
				categoryKey: key,
				categoryLabel: category.label,
				permissions: (category.permissions).map((permission) => ({
					key: permission.key,
					label: permission.label,
					description: permission.description,
					defaultStatus: permission.defaultStatus,
				})),
			};
		});
		permissionGroups.push(...categories);
	}

	// "modules.daybook.*" (Data Sources, Metrics, Reports)
	if (tree.modules?.daybook?.categories) {
		const daybookCats = tree.modules.daybook.categories;
		const categories = Object.keys(daybookCats).map((catKey) => {
			const cat = daybookCats[catKey];
			return {
				section: tree.modules.daybook.label || "Day Book",
				categoryKey: `daybook.${catKey}`,
				categoryLabel: cat.label || catKey,
				permissions: (cat.permissions || []).map((p) => ({
				key: p.key,
				label: p.label || p.key,
				description: p.description || "",
				defaultStatus: !!p.defaultStatus,
				})),
			};
		});
		permissionGroups.push(...categories);
	}

	return permissionGroups; // [{ section, categoryKey, categoryLabel, permissions:[{key,label,description,defaultStatus}]}...]
}

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
	const [selectedBoards, setSelectedBoards] = useState([]);

	const [permissions, setPermissions] = useState([]);
	const [boards, setBoards] = useState([]);

	const [openAccordions, setOpenAccordions] = useState({});
	const [currentUserRoleId, setCurrentUserRoleId] = useState(null);
	const [confirmSelfLock, setConfirmSelfLock] = useState(false);

	const initialRef = useRef({ name: "", perms: [], boards: [] });

	const [showDeleteDialog, setShowDeleteDialog] = useState(false);

	const initialValuesChanged = (() => {
		const initial = initialRef.current;
		if ((name || "").trim() !== (initial.name || "").trim()) return true;

		const selPerms = new Set(selectedPerms);
		const initPerms = new Set(initial.perms || []);
		if (selPerms.size !== initPerms.size) return true;
		for (const permission of selPerms) if (!initPerms.has(permission)) return true;

		const selBoards = new Set(selectedBoards);
		const initBoards = new Set(initial.boards || []);
		if (selBoards.size !== initBoards.size) return true;
		for (const board of selBoards) if (!initBoards.has(board)) return true;

		return false;
	})();

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
			console.log("Role:", role);

			result = await apiGet(endpoints.workspace.core.getDefaultPermissions);
			const allCategories = buildPermissionGroups(result?.data || {});
			setPermissions(allCategories);
			
			result = await apiGet(endpoints.workspace.boards.getBoards(workspaceId));
			setBoards(Array.isArray(result?.data) ? result.data : []);

			try {
				result = await apiGet(endpoints.workspace.roles.getRoleOfUser(workspaceId));
				setCurrentUserRoleId(result.data.roleId);
			} catch (error) {
				console.warn("Could not determine current user's role:", error);
			}

			const initialName = role.name || "";
			const initialPerms = normalizePermissionKeys(role.permissions);
			const initialBoardsRaw = Array.isArray(role.hasAccess?.boards) ? role.hasAccess.boards : [];
			const initialBoards = Array.from(new Set(initialBoardsRaw.map((board) => String(board))));

			setName(initialName);
			setSelectedPerms(initialPerms);
			setSelectedBoards(initialBoards);

			initialRef.current = {
				name: initialName,
				perms: initialPerms,
				boards: initialBoards,
			};

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

	const togglePerm = (permission) => {
		setSelectedPerms((selected) => {
			const permissionKey = typeof permission === "string" ? permission : permission?.key;
			if (!permissionKey) return selected;

			return selected.includes(permissionKey)
				? selected.filter((prevPermission) => prevPermission !== permissionKey)
				: [...selected, permissionKey];
		});
	};

	const toggleBoard = (boardId) => {
		const boardKey = String(boardId);
		setSelectedBoards((selected) =>
			selected.includes(boardKey) ? selected.filter((prevBoard) => prevBoard !== boardKey) : [...selected, boardKey]
		);
	};

	const willSelfLoseManageRoles = useMemo(() => {
		if (!currentUserRoleId) return false;
		if (currentUserRoleId !== roleId) return false;
		const hadManage = (initialRef.current.perms).includes(MANAGE_ROLES);
		const willHaveManage = selectedPerms.includes(MANAGE_ROLES);
		return hadManage && !willHaveManage;
	}, [currentUserRoleId, roleId, selectedPerms]);


	const handleSave = async () => {
		try {
			if (willSelfLoseManageRoles) {
				setConfirmSelfLock(true);
				return;
			}
			
			setSaving(true);
			const uniquePermissions = normalizePermissionKeys(selectedPerms);
			const uniqueBoards = Array.from(new Set((selectedBoards || []).map((board) => String(board))));

			await apiPatch(endpoints.workspace.roles.update(workspaceId, roleId), {
				name: name.trim(),
				permissions: uniquePermissions,
				hasAccess: { boards: uniqueBoards },
			});

			// Update initial values
			initialRef.current = {
				name: name.trim(),
				perms: normalizePermissionKeys(selectedPerms),
				boards: Array.from(new Set((selectedBoards || []).map((board) => String(board)))),
			};

			setSnack({ visible: true, text: "Role updated" });
		} catch (error) {
			console.error("Error saving role:", error);
			setSnack({ visible: true, text: "Failed to save role" });
		} finally {
			setSaving(false);
		}
	};

	const confirmProceedSelfLock = async () => {
		setConfirmSelfLock(false);
		await (async () => {
		try {
			setSaving(true);
			const uniquePermissions = normalizePermissionKeys(selectedPerms);
			const uniqueBoards = Array.from(new Set((selectedBoards || []).map((board) => String(board))));

			await apiPatch(endpoints.workspace.roles.update(workspaceId, roleId), {
				name: name.trim(),
				permissions: uniquePermissions,
				hasAccess: { boards: uniqueBoards },
			});
			initialRef.current = { name: name.trim(), perms: uniquePermissions, boards: uniqueBoards };
			setSnack({ visible: true, text: "Role updated" });
		} catch (error) {
			console.error("Error saving role (confirmed):", error);
			setSnack({ visible: true, text: "Failed to save role" });
		} finally {
			setSaving(false);
		}
		})();
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
			) : (<StackLayout spacing={16}>
				{willSelfLoseManageRoles && (
					<Chip icon="alert" style={{ marginBottom: 16 }} selected>
						You're removing your own “Manage Roles” permission.
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

				{!role.owner && (<>
					<Card style={styles.card}>
						<Card.Title title="Board Access"/>
						<Card.Content>
						{boards.length > 0 ? (
							<View style={styles.chipsWrap}>
								{boards.map((board) => {
									const boardKey = String(board.boardId ?? board.id);
									const active = selectedBoards.includes(boardKey);
									return (
										<Chip
											key={boardKey}
											mode={active ? "flat" : "outlined"}
											selected={active}
											onPress={() => toggleBoard(boardKey)}
											style={styles.chip}
										>
											{board.name}
										</Chip>
									);
								})}
							</View>
						) : (
							<Text>The workspace has no boards.</Text>
						)}
						</Card.Content>
					</Card>

					<Card style={styles.card}>
						<Card.Title title={`Permissions (${selectedPerms.length})`} />
						<Card.Content>
							{Object.entries(permissions.reduce((acc, category) => {
								(acc[category.section] ||= []).push(category);
								return acc;
							}, {})).map(([sectionLabel, categories]) => (
								<View key={sectionLabel} style={{ marginBottom: 8 }}>
									<Text style={{ marginBottom: 6 }}>{sectionLabel}</Text>

									{categories.map((category) => {
										const open = !!openAccordions[category.categoryKey];
										const keys = category.permissions.map((permission) => permission.key);
										const allSelected = keys.every((key) => selectedPerms.includes(key));

										const handleBulkToggle = () => {
											if (allSelected) setSelectedPerms(prev => prev.filter(key => !keys.includes(key)));
											else setSelectedPerms(prev => Array.from(new Set([...prev, ...keys])));
										};

										return (
											<View key={category.categoryKey} style={{ marginBottom: 6 }}>
												<List.Accordion
													title={category.categoryLabel}
													expanded={open}
													onPress={() => setOpenAccordions(s => ({ ...s, [category.categoryKey]: !s[category.categoryKey] }))}
												>
													<View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 4 }}>
														<Chip compact onPress={handleBulkToggle}>
															{allSelected ? 'Clear' : 'Select All'}
														</Chip>
													</View>

													<View style={{ paddingLeft: 4 }}>
														{category.permissions.map(perm => {
															const checked = selectedPerms.includes(perm.key);
															return (
																<Checkbox.Item
																	key={perm.key}
																	status={checked ? 'checked' : 'unchecked'}
																	onPress={() => setSelectedPerms(prev => checked ? prev.filter(k => k !== perm.key) : [...prev, perm.key] )}
																	label={perm.label}
																	position="leading"
																	labelVariant="bodyMedium"
																	description={perm.description || undefined}
																/>
															);
														})}
													</View>
												</List.Accordion>
											</View>
										);
									})}
								</View>
							))}

							{permissions.length === 0 && (
								<Text>No available permissions.</Text>
							)}
						</Card.Content>
					</Card>
				</>)}
			</StackLayout>)}

			<Portal>
				<Snackbar
					visible={snack.visible}
					onDismiss={() => setSnack((s) => ({ ...s, visible: false }))}
					duration={2200}
					wrapperStyle={{
						bottom: (insets?.bottom ?? 0) + 12, // keep above the home indicator on iOS
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
							You’re removing the “Manage Roles” permission from the role you currently hold. After saving, you won't able to continue editing roles.
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
	chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
	chip: { marginBottom: 8 },
});