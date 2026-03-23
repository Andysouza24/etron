// Author(s): Noah Bradley

import ResponsiveScreen from "../../../../../components/layout/ResponsiveScreen";
import Header from "../../../../../components/layout/Header";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useEffect, useState, useMemo, useCallback } from "react";
import { apiGet } from "../../../../../utils/api/apiClient";
import endpoints from "../../../../../utils/api/endpoints";
import { getWorkspaceId } from "../../../../../storage/workspaceStorage";
import { View, StyleSheet } from "react-native";
import { ActivityIndicator, Card, Chip, Divider, List, Text, useTheme, Button, } from "react-native-paper";
import formatDateTime from "../../../../../utils/format/formatISODate";
import ItemNotFound from "../../../../../components/common/errors/MissingItem";
import StackLayout from "../../../../../components/layout/StackLayout";
import { hasPermission } from "../../../../../utils/permissions";

function buildPermissionIndex(tree) {
    const index = {};  // key -> { label, description, section, categoryLabel }

    if (tree?.app?.categories) {
        const sectionLabel = tree.app.label || "Workspace";
        for (const [catKey, cat] of Object.entries(tree.app.categories)) {
            const categoryLabel = cat.label || catKey;
            for (const p of cat.permissions || []) {
                index[p.key] = {
                label: p.label || p.key,
                description: p.description || "",
                section: sectionLabel,
                categoryLabel,
                };
            }
        }
    }

    if (tree?.modules?.daybook?.categories) {
        const sectionLabel = tree.modules.daybook.label || "Day Book";
        for (const [catKey, cat] of Object.entries(tree.modules.daybook.categories)) {
            const categoryLabel = cat.label || catKey;
            for (const p of cat.permissions || []) {
                index[p.key] = {
                label: p.label || p.key,
                description: p.description || "",
                section: sectionLabel,
                categoryLabel,
                };
            }
        }
    }

    return index;
}

function groupSelectedPermissions(selectedKeys = [], permIndex = {}) {
    const grouped = {}; // section -> { categoryLabel -> [{key,label,description}] }
    const unknown = [];

    for (const key of selectedKeys) {
        const meta = permIndex[key];
        if (!meta) {
            unknown.push({ key, label: key, description: "" });
            continue;
        }
        const { section, categoryLabel, label, description } = meta;
        grouped[section] ||= {};
        grouped[section][categoryLabel] ||= [];
        grouped[section][categoryLabel].push({ key, label, description });
    }

    // If unknowns exist, put them in a generic section
    if (unknown.length) {
        const section = "Other";
        const category = "Unknown";
        grouped[section] ||= {};
        grouped[section][category] = unknown;
    }

    // Convert to a render-friendly array
    // [{ section, categories: [{ categoryLabel, permissions: [{key,label,description}...] }] }]
    return Object.entries(grouped).map(([section, catObj]) => ({
        section,
        categories: Object.entries(catObj).map(([categoryLabel, perms]) => ({
            categoryLabel,
            permissions: perms.sort((a, b) => a.label.localeCompare(b.label)),
        })),
    }));
}

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

export default function ViewRole() {
    const { roleId } = useLocalSearchParams();

    const [role, setRole] = useState(null)
    const [permIndex, setPermIndex] = useState({});
    const [loading, setLoading] = useState(true);
    const [roleExists, setRoleExists] = useState(true);
    const [boards, setBoards] = useState([]);
    const [openAccordions, setOpenAccordions] = useState({});
    const [manageRolePermission, setManageRolePermission] = useState(false);

    const loadRole = useCallback(async () => {
        try {
            const workspaceId = await getWorkspaceId();

            let result = await apiGet(endpoints.workspace.roles.getRole(workspaceId, roleId));
            const role = result.data;

            if (!role) {
                setRoleExists(false);
                return;
            }
            setRole(role);

            result = await apiGet(endpoints.workspace.core.getDefaultPermissions);
            setPermIndex(buildPermissionIndex(result?.data));

            result = await apiGet(endpoints.workspace.boards.getBoards(workspaceId));
			setBoards(Array.isArray(result?.data) ? result.data : []);
        } catch (error) {
            console.error("Error fetching role:", error);
            setRoleExists(false);
        } finally {
            setLoading(false);
        }
    }, [roleId])

    useEffect(() => {
        setLoading(true);
        loadPermission();
        loadRole();
    }, [loadRole]);

    async function loadPermission() {
        const manageRolePermission = await hasPermission("app.collaboration.manage_roles")
        setManageRolePermission(manageRolePermission);
    }

    const normalizedPermissions = useMemo(
        () => normalizePermissionKeys(role?.permissions),
        [role]
    );

    const groupedReadable = useMemo(
        () => groupSelectedPermissions(normalizedPermissions, permIndex),
        [normalizedPermissions, permIndex]
    );

    const accessibleBoardIds = useMemo(
        () => {
            if (!Array.isArray(role?.hasAccess?.boards)) return [];
            const ids = role.hasAccess.boards
                .map((boardId) => (boardId !== undefined && boardId !== null ? String(boardId) : null))
                .filter(Boolean);
            return Array.from(new Set(ids));
        },
        [role]
    );

    useFocusEffect(
        useCallback(() => {
            loadRole();
        }, [loadRole])
    );

    return (
        <ResponsiveScreen
            header={
                <Header
                    title="View Role"
                    showEdit={roleExists}
                    showBack
                    onRightIconPress={() => router.navigate(`/collaboration/edit-role/${roleId}`)}
                    rightIconPermission={manageRolePermission}
                />
            }
            center={!roleExists}
        >
            {loading ? (
                <View style={styles.loadingWrap}>
                    <ActivityIndicator size="large" />
                </View>
            ) : roleExists ? (<StackLayout spacing={16}>
                <Card>
                    <Card.Title title={role.name} />
                    <List.Item title="Created" description={formatDateTime(role.createdAt)} />
                    <List.Item title="Last Updated" description={formatDateTime(role.updatedAt)} />
                </Card>

                {!role?.owner && (
                    <StackLayout spacing={16}>
                        <Card>
                            <Card.Title title="Board Access" />
                            <Card.Content>
                                <View style={styles.chipsWrap}>
                                    {accessibleBoardIds.map((roleBoard) => {
                                        const matchingBoard = Array.isArray(boards)
                                            ? boards.find((board) => board?.id === roleBoard)
                                            : null;
                                        const boardLabel = matchingBoard?.name || String(roleBoard);
                                        return (
                                            <Chip
                                                key={roleBoard}
                                                mode="outlined"
                                                style={styles.chip}
                                                onPress={() => router.navigate(`/boards/${roleBoard}`)}
                                            >
                                                {boardLabel}
                                            </Chip>
                                        );
                                    })}
                                    {(accessibleBoardIds.length === 0) && (
                                        <Text style={styles.muted}>No boards assigned.</Text>
                                    )}
                                </View>
                            </Card.Content>
                        </Card>

                        <Card>
                            <Card.Title title={`Permissions (${normalizedPermissions.length})`} />
                            <Card.Content>
                                {!(groupedReadable.length > 0) ? (
                                    <Text style={styles.muted}>No permissions assigned.</Text>
                                ) : (
                                    groupedReadable.map(({ section, categories }, index) => (
                                        <View key={section}>
                                            {index !== 0 && <Divider style={{ marginVertical: 8 }} />}
                                            <Text style={styles.sectionTitle}>{section}</Text>

                                            {categories.map((category) => {
                                                const accordionKey = `${section}:${category.categoryLabel}`;
                                                const open = !!openAccordions[accordionKey];
                                                return (
                                                    <View key={accordionKey} style={{ marginBottom: 6 }}>
                                                        <List.Accordion
                                                            title={category.categoryLabel}
                                                            expanded={open}
                                                            onPress={() =>
                                                                setOpenAccordions((prev) => ({
                                                                    ...prev,
                                                                    [accordionKey]: !prev[accordionKey],
                                                                }))
                                                            }
                                                        >
                                                            {category.permissions.map((permission) => (
                                                                <List.Item
                                                                    key={permission.key}
                                                                    title={permission.label}
                                                                    description={permission.description}
                                                                />
                                                            ))}
                                                        </List.Accordion>
                                                    </View>
                                                );
                                            })}
                                        </View>
                                    ))
                                )}
                            </Card.Content>
                        </Card>
                    </StackLayout>
                )}
            </StackLayout>) : (
                <View style={styles.emptyWrap}>
                    <ItemNotFound
                        icon="shield-alert-outline"
                        item="role"
                        itemId={roleId}
                        listRoute="/collaboration/roles"
                    />
                </View>
            )}
        </ResponsiveScreen>
    );
}

const styles = StyleSheet.create({
    loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
    chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: { marginBottom: 8 },
    bucketTitle: { fontWeight: "600", marginBottom: 6 },
    muted: { opacity: 0.7 },
    actionsRow: { alignItems: "flex-end", marginTop: 8 },
    emptyWrap: { alignItems: "center", paddingHorizontal: 16, gap: 8 },
    emptyTitle: { fontSize: 20, marginTop: 4, marginBottom: 2 },
    emptyBody: { textAlign: "center", marginBottom: 12 },
    emptyActions: { flexDirection: "row", gap: 12 },
});