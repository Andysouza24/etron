import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, ScrollView, StyleSheet, Alert, Pressable } from 'react-native';
import {
    Text,
    TextInput,
    List,
    Divider,
    ActivityIndicator,
    Avatar,
    RadioButton,
    Button,
    useTheme,
    Chip,
} from 'react-native-paper';
import { router, useLocalSearchParams } from 'expo-router';
import Header from '../../../../../components/layout/Header';
import BoardService from '../../../../../services/BoardService';
import ResponsiveScreen from '../../../../../components/layout/ResponsiveScreen';
import BasicButton from '../../../../../components/common/buttons/BasicButton';
import SearchableList from '../../../../../components/collaboration/SearchableList';
import apiClient from '../../../../../utils/api/apiClient';
import endpoints from '../../../../../utils/api/endpoints';
import { getWorkspaceId } from '../../../../../storage/workspaceStorage';
import { useHasPermission } from '../../../../../hooks/useHasPermission';

const MANAGE_BOARDS_PERM = 'app.workspace.manage_boards';

const toSafeLower = (v) => (v ? String(v).toLowerCase() : '');

const buildInitials = (label) => {
    if (!label) return '?';
    const parts = String(label).trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
};

const UserAvatar = ({ user, size = 34 }) => {
    if (user?.picture) return <Avatar.Image size={size} source={{ uri: user.picture }} />;
    return <Avatar.Text size={size} label={buildInitials(user?.name || user?.email || '?')} />;
};

// ─── Accordion wrapper ─────────────────────────────────────────────────────────
// Each collaboration group is an independently togglable accordion. We track
// which sections are open in a Set so multiple can be open simultaneously.

const CollabAccordion = ({ id, label, description, icon, openSections, onToggle, children }) => {
    const theme = useTheme();
    const isOpen = openSections.has(id);
    return (
        <View style={[styles.accordionWrapper, { borderColor: theme.colors.outlineVariant ?? theme.colors.outline }]}>
            <List.Accordion
                title={label}
                description={description}
                left={(props) => <List.Icon {...props} icon={icon} />}
                expanded={isOpen}
                onPress={() => onToggle(id)}
                style={[styles.accordionHeader, { backgroundColor: theme.colors.surface }]}
                titleStyle={styles.accordionTitle}
                descriptionStyle={[styles.accordionDesc, { color: theme.colors.onSurfaceVariant }]}
            >
                <View style={styles.accordionContent}>{children}</View>
            </List.Accordion>
        </View>
    );
};

// ─── Component ─────────────────────────────────────────────────────────────────

const BoardSettings = () => {
    const { id } = useLocalSearchParams();
    const theme = useTheme();
    const { allowed: canManageBoards, loading: permLoading } = useHasPermission(MANAGE_BOARDS_PERM);

    // ── Core board state ──
    const [board, setBoard] = useState(null);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [saving, setSaving] = useState(false);

    // ── Access state ──
    const [ownerId, setOwnerId] = useState(null);
    const [collaborators, setCollaborators] = useState({}); // { userId: 'view'|'edit' }

    // ── Dashboard assignment state ──
    const [dashboardUserIds, setDashboardUserIds] = useState([]);
    const [dashboardRoleIds, setDashboardRoleIds] = useState([]);

    // ── Data ──
    const [workspaceUsers, setWorkspaceUsers] = useState([]);
    const [workspaceRoles, setWorkspaceRoles] = useState([]);
    const [allBoards, setAllBoards] = useState([]);

    // ── Loading / error ──
    const [collaborationLoading, setCollaborationLoading] = useState(true);
    const [collaborationError, setCollaborationError] = useState(null);
    const [dashboardDataLoading, setDashboardDataLoading] = useState(false);
    const [dashboardDataLoaded, setDashboardDataLoaded] = useState(false);

    // ── Accordion open state ──
    const [openSections, setOpenSections] = useState(new Set(['owner', 'collaborators', 'dashboard']));

    // ── Progressive disclosure state ──
    const [showDashboardAdd, setShowDashboardAdd] = useState(false);
    const [dashboardAddTab, setDashboardAddTab] = useState('roles'); // 'roles' | 'users'
    const [showCollabAdd, setShowCollabAdd] = useState(false);
    const [showOwnerSearch, setShowOwnerSearch] = useState(false);

    const toggleSection = useCallback((key) => {
        setOpenSections((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    }, []);

    // ─── Permission guard ─────────────────────────────────────────────────────
    useEffect(() => {
        if (!permLoading && !canManageBoards) router.back();
    }, [permLoading, canManageBoards]);

    // ─── Data loading ─────────────────────────────────────────────────────────
    useEffect(() => { loadBoard(); }, [id]);
    useEffect(() => { fetchCollaborationData(); }, []);

    const loadBoard = async () => {
        if (!id) return;
        const boardData = await BoardService.getBoard(id);
        if (boardData) {
            setBoard(boardData);
            setName(boardData.name);
            setDescription(boardData.description || '');
            hydrateAccessState(boardData);
        }
    };

    const fetchCollaborationData = async () => {
        try {
            setCollaborationLoading(true);
            setCollaborationError(null);
            const workspaceId = await getWorkspaceId();
            if (!workspaceId) throw new Error('No workspace selected');

            const [usersRes, rolesRes] = await Promise.all([
                apiClient.get(endpoints.workspace.users.getUsers(workspaceId)),
                apiClient.get(endpoints.workspace.roles.getRoles(workspaceId)),
            ]);

            const users = (Array.isArray(usersRes?.data) ? usersRes.data : [])
                .map((u) => {
                    const userId = u?.userId ? String(u.userId) : null;
                    if (!userId) return null;
                    const nameParts = [u?.given_name, u?.family_name].filter(Boolean);
                    return {
                        userId,
                        name: nameParts.length ? nameParts.join(' ') : (u?.email || 'Workspace Member'),
                        email: u?.email || null,
                        picture: u?.picture || u?.avatarUrl || null,
                        roleId: u?.roleId ? String(u.roleId) : null,
                    };
                })
                .filter(Boolean)
                .sort((a, b) => toSafeLower(a.name).localeCompare(toSafeLower(b.name)));

            const roles = (Array.isArray(rolesRes?.data) ? rolesRes.data : [])
                .filter((r) => r?.roleId)
                .map((r) => ({ roleId: String(r.roleId), name: r.name || 'Unnamed Role' }))
                .sort((a, b) => toSafeLower(a.name).localeCompare(toSafeLower(b.name)));

            setWorkspaceUsers(users);
            setWorkspaceRoles(roles);
        } catch (error) {
            console.error('Failed to load collaboration data:', error);
            setCollaborationError('Unable to load workspace members right now.');
        } finally {
            setCollaborationLoading(false);
        }
    };

    const fetchAllBoards = useCallback(async () => {
        if (dashboardDataLoaded || dashboardDataLoading) return;
        try {
            setDashboardDataLoading(true);
            const boards = await BoardService.getAllBoards();
            setAllBoards(Array.isArray(boards) ? boards : []);
            setDashboardDataLoaded(true);
        } catch (e) {
            console.error('Failed to load boards for dashboard preview:', e);
            setAllBoards([]);
        } finally {
            setDashboardDataLoading(false);
        }
    }, [dashboardDataLoaded, dashboardDataLoading]);

    // Fetch allBoards when the dashboard accordion is first opened
    useEffect(() => {
        if (openSections.has('dashboard') && !dashboardDataLoaded) {
            fetchAllBoards();
        }
    }, [openSections, dashboardDataLoaded, fetchAllBoards]);

    // ─── State hydration ──────────────────────────────────────────────────────
    const hydrateAccessState = (boardData) => {
        if (!boardData) return;

        const inferredOwnerId = boardData.access?.ownerId || boardData.metadata?.createdBy || null;
        const ownerStr = inferredOwnerId ? String(inferredOwnerId) : null;
        setOwnerId(ownerStr);

        const nextCollaborators = {};
        (Array.isArray(boardData.access?.collaborators) ? boardData.access.collaborators : []).forEach((entry) => {
            if (!entry || entry.userId == null) return;
            const cId = String(entry.userId);
            if (ownerStr && cId === ownerStr) return;
            nextCollaborators[cId] = entry.permission === 'edit' ? 'edit' : 'view';
        });
        setCollaborators(nextCollaborators);

        const assignments = boardData.dashboardAssignments || {};
        setDashboardUserIds(Array.isArray(assignments.userIds) ? assignments.userIds.map(String) : []);
        setDashboardRoleIds(Array.isArray(assignments.roleIds) ? assignments.roleIds.map(String) : []);
    };

    useEffect(() => { if (board) hydrateAccessState(board); }, [board]);

    // ─── Computed values ──────────────────────────────────────────────────────
    const ownerOptions = useMemo(() => {
        const opts = [...workspaceUsers];
        if (ownerId && !workspaceUsers.some((u) => u.userId === ownerId)) {
            opts.push({ userId: ownerId, name: 'Current Owner', email: board?.access?.ownerEmail || null, picture: null, roleId: null, missing: true });
        }
        return opts;
    }, [workspaceUsers, ownerId, board]);

    const collaboratorCandidates = useMemo(
        () => workspaceUsers.filter((u) => u.userId !== ownerId),
        [workspaceUsers, ownerId]
    );

    // "Current dashboard" label per user and per role, derived from allBoards.
    const userDashboardLabel = useMemo(() => {
        if (!allBoards.length) return {};
        const workspaceDefault = allBoards.find((b) => b.isDashboard);
        return Object.fromEntries(
            workspaceUsers.map((u) => {
                const userBoard = allBoards.find((b) => (b.dashboardAssignments?.userIds || []).includes(u.userId));
                if (userBoard) return [u.userId, `Dashboard: ${userBoard.name}`];
                if (u.roleId) {
                    const roleBoard = allBoards.find((b) => (b.dashboardAssignments?.roleIds || []).includes(u.roleId));
                    if (roleBoard) return [u.userId, `Dashboard: ${roleBoard.name}`];
                }
                return [u.userId, workspaceDefault ? `Workspace default: ${workspaceDefault.name}` : 'No dashboard set'];
            })
        );
    }, [allBoards, workspaceUsers]);

    const roleDashboardLabel = useMemo(() => {
        if (!allBoards.length) return {};
        const workspaceDefault = allBoards.find((b) => b.isDashboard);
        return Object.fromEntries(
            workspaceRoles.map((r) => {
                const roleBoard = allBoards.find((b) => (b.dashboardAssignments?.roleIds || []).includes(r.roleId));
                return [
                    r.roleId,
                    roleBoard
                        ? `Dashboard: ${roleBoard.name}`
                        : workspaceDefault
                            ? `Workspace default: ${workspaceDefault.name}`
                            : 'No dashboard set',
                ];
            })
        );
    }, [allBoards, workspaceRoles]);

    // Accordion description summaries
    const ownerName = useMemo(() => {
        if (!ownerId) return 'Not assigned';
        return workspaceUsers.find((u) => u.userId === ownerId)?.name || 'Current Owner';
    }, [ownerId, workspaceUsers]);

    const collaboratorCount = Object.keys(collaborators).length;

    const dashboardAssignmentCount = dashboardUserIds.length + dashboardRoleIds.length;

    // Count selections that will replace an already-set dashboard
    const overrideCount = useMemo(() => {
        const userOverrides = dashboardUserIds.filter((uid) => {
            const label = userDashboardLabel[uid] ?? '';
            return label.startsWith('Dashboard:');
        }).length;
        const roleOverrides = dashboardRoleIds.filter((rid) => {
            const label = roleDashboardLabel[rid] ?? '';
            return label.startsWith('Dashboard:');
        }).length;
        return userOverrides + roleOverrides;
    }, [dashboardUserIds, dashboardRoleIds, userDashboardLabel, roleDashboardLabel]);

    // ─── Access handlers ──────────────────────────────────────────────────────
    const handleOwnerChange = (nextId) => {
        const idStr = String(nextId);
        setOwnerId(idStr);
        setShowOwnerSearch(false);
        setCollaborators((prev) => {
            if (!prev[idStr]) return prev;
            const next = { ...prev };
            delete next[idStr];
            return next;
        });
    };

    const toggleCollaborator = (userId) => {
        const idStr = String(userId);
        setCollaborators((prev) => {
            const next = { ...prev };
            if (next[idStr]) delete next[idStr];
            else next[idStr] = 'view';
            return next;
        });
    };

    const setCollaboratorPermission = (userId, permission) => {
        const idStr = String(userId);
        setCollaborators((prev) => {
            if (!prev[idStr] || prev[idStr] === permission) return prev;
            return { ...prev, [idStr]: permission === 'edit' ? 'edit' : 'view' };
        });
    };

    // ─── Dashboard assignment handlers ────────────────────────────────────────
    const toggleDashboardUser = (userId) => {
        const idStr = String(userId);
        setDashboardUserIds((prev) =>
            prev.includes(idStr) ? prev.filter((x) => x !== idStr) : [...prev, idStr]
        );
    };

    const toggleDashboardRole = (roleId) => {
        const idStr = String(roleId);
        setDashboardRoleIds((prev) =>
            prev.includes(idStr) ? prev.filter((x) => x !== idStr) : [...prev, idStr]
        );
    };

    // ─── Save / actions ───────────────────────────────────────────────────────
    const doSave = async () => {
        try {
            setSaving(true);
            const collaboratorPayload = Object.entries(collaborators).map(([userId, permission]) => ({
                userId,
                permission: permission === 'edit' ? 'edit' : 'view',
            }));

            const updated = await BoardService.updateBoard(board.id, {
                name: name.trim(),
                description: description.trim(),
                access: { ownerId, collaborators: collaboratorPayload },
                dashboardAssignments: { userIds: dashboardUserIds, roleIds: dashboardRoleIds },
            });

            if (updated) {
                setBoard(updated);
                setName(updated.name);
                setDescription(updated.description || '');
                hydrateAccessState(updated);
                Alert.alert('Saved', 'Board settings have been updated.', [
                    { text: 'OK', onPress: () => router.back() },
                ]);
            }
        } catch (error) {
            console.error('Error saving settings:', error);
            Alert.alert('Error', 'Failed to save settings.');
        } finally {
            setSaving(false);
        }
    };

    const handleSave = () => {
        if (!name.trim()) {
            Alert.alert('Error', 'Board name is required.');
            return;
        }
        if (!ownerId) {
            Alert.alert('Error', 'Please assign a board owner.');
            return;
        }

        const hasNewAssignments = dashboardUserIds.length > 0 || dashboardRoleIds.length > 0;
        if (hasNewAssignments) {
            const parts = [];
            if (dashboardUserIds.length) parts.push(`${dashboardUserIds.length} user${dashboardUserIds.length !== 1 ? 's' : ''}`);
            if (dashboardRoleIds.length) parts.push(`${dashboardRoleIds.length} role${dashboardRoleIds.length !== 1 ? 's' : ''}`);
            Alert.alert(
                'Override Dashboards?',
                `This will set this board as the dashboard for ${parts.join(' and ')}, replacing their current dashboard. Continue?`,
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Save', onPress: doSave },
                ]
            );
        } else {
            doSave();
        }
    };

    const handleDelete = () => {
        Alert.alert(
            'Delete Board',
            `Are you sure you want to delete "${board.name}"? This cannot be undone.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const ok = await BoardService.deleteBoard(board.id);
                            if (ok) Alert.alert('Deleted', 'Board removed.', [{ text: 'OK', onPress: () => router.replace('/boards') }]);
                        } catch {
                            Alert.alert('Error', 'Failed to delete board.');
                        }
                    },
                },
            ]
        );
    };

    const handleDuplicate = async () => {
        try {
            const copy = await BoardService.duplicateBoard(board.id);
            if (copy) {
                Alert.alert('Duplicated', 'Board copied.', [
                    { text: 'View Copy', onPress: () => router.replace(`/boards/${copy.id}`) },
                    { text: 'Stay Here' },
                ]);
            }
        } catch {
            Alert.alert('Error', 'Failed to duplicate board.');
        }
    };

    // ─── Render helpers ───────────────────────────────────────────────────────

    const renderOwnerItem = (user) => {
        const isSelected = ownerId === user.userId;
        return (
            <List.Item
                title={user.name}
                description={user.missing ? 'Not currently in this workspace' : (user.email ?? undefined)}
                left={() => (
                    <View style={styles.avatarCell}>
                        <UserAvatar user={user} size={34} />
                    </View>
                )}
                right={() => (
                    <RadioButton
                        value={user.userId}
                        status={isSelected ? 'checked' : 'unchecked'}
                        onPress={() => handleOwnerChange(user.userId)}
                    />
                )}
                onPress={() => handleOwnerChange(user.userId)}
                style={styles.listItem}
            />
        );
    };


    // ─── Early returns ────────────────────────────────────────────────────────
    if (!board) {
        return (
            <ResponsiveScreen
                scroll={false}
                padded={false}
                center={false}
                tapToDismissKeyboard={false}
                header={<Header title="Settings" showBack />}
            >
                <View style={styles.loadingContainer}>
                    <ActivityIndicator />
                </View>
            </ResponsiveScreen>
        );
    }

    // ─── Main render ──────────────────────────────────────────────────────────
    return (
        <ResponsiveScreen
            scroll={true}
            padded={false}
            center={false}
            tapToDismissKeyboard={false}
            header={
                <Header
                    title="Board Settings"
                    showBack
                    showCheck
                    onRightIconPress={handleSave}
                />
            }
        >
            <ScrollView style={styles.container}>
                {/* ── Basic Information ── */}
                <View style={styles.section}>
                    <Text variant="titleMedium" style={styles.sectionTitle}>Basic Information</Text>
                    <TextInput
                        mode="outlined"
                        label="Board Name"
                        value={name}
                        onChangeText={setName}
                        style={styles.input}
                    />
                    <TextInput
                        mode="outlined"
                        label="Description"
                        value={description}
                        onChangeText={setDescription}
                        multiline
                        numberOfLines={3}
                        style={styles.input}
                    />
                </View>

                <Divider style={styles.divider} />

                {/* ── Board Information ── */}
                <View style={styles.section}>
                    <Text variant="titleMedium" style={styles.sectionTitle}>Board Information</Text>
                    <List.Item title="Created" description={new Date(board.metadata?.createdAt).toLocaleString()} left={() => <List.Icon icon="calendar-plus" />} />
                    <List.Item title="Last Updated" description={new Date(board.metadata?.updatedAt).toLocaleString()} left={() => <List.Icon icon="calendar-edit" />} />
                    <List.Item title="Items" description={`${board.items?.length || 0} items`} left={() => <List.Icon icon="grid" />} />
                    <List.Item title="Version" description={`v${board.metadata?.version || 1}`} left={() => <List.Icon icon="tag" />} />
                </View>

                <Divider style={styles.divider} />

                {/* ── Collaboration ── */}
                <View style={styles.section}>
                    <Text variant="titleMedium" style={styles.sectionTitle}>Collaboration</Text>
                    <Text style={[styles.sectionDescription, { color: theme.colors.onSurfaceVariant }]}>
                        Manage who owns, can access, and is assigned this board as their dashboard.
                    </Text>

                    {collaborationLoading ? (
                        <View style={styles.collabLoading}>
                            <ActivityIndicator />
                            <Text style={{ color: theme.colors.onSurfaceVariant }}>Loading workspace members…</Text>
                        </View>
                    ) : collaborationError ? (
                        <View style={styles.collabError}>
                            <Text style={{ color: theme.colors.error }}>{collaborationError}</Text>
                            <BasicButton label="Try Again" mode="outlined" onPress={fetchCollaborationData} fullWidth style={{ marginTop: 8 }} />
                        </View>
                    ) : (
                        <View style={styles.accordionGroup}>

                            {/* ── Board Owner ── */}
                            <CollabAccordion
                                id="owner"
                                label="Board Owner"
                                description={`Who manages and is responsible for this board · ${ownerName}`}
                                icon="shield-account"
                                openSections={openSections}
                                onToggle={toggleSection}
                            >
                                {/* A. Current owner display */}
                                {(() => {
                                    const currentOwnerUser = ownerOptions.find((u) => u.userId === ownerId);
                                    return (
                                        <List.Item
                                            title={currentOwnerUser?.name || 'Not assigned'}
                                            description={currentOwnerUser?.email ?? undefined}
                                            left={() => (
                                                <View style={styles.avatarCell}>
                                                    <UserAvatar user={currentOwnerUser || { name: '?' }} size={34} />
                                                </View>
                                            )}
                                            right={() => (
                                                <Button mode="outlined" compact onPress={() => setShowOwnerSearch((v) => !v)}>
                                                    Change
                                                </Button>
                                            )}
                                            style={styles.ownerDisplayRow}
                                        />
                                    );
                                })()}

                                {/* B. Hint text */}
                                <Text style={[styles.accordionHint, { color: theme.colors.onSurfaceVariant }]}>
                                    The owner has full control. Changing the owner transfers all board management responsibilities.
                                </Text>

                                {/* C. Toggled search list */}
                                {showOwnerSearch && (
                                    ownerOptions.length === 0 ? (
                                        <Text style={[styles.emptyHint, { color: theme.colors.onSurfaceVariant }]}>
                                            Add members to this workspace to assign an owner.
                                        </Text>
                                    ) : (
                                        <SearchableList
                                            items={ownerOptions}
                                            getKey={(u) => `owner_${u.userId}`}
                                            getLabel={(u) => u.name}
                                            getSubtitle={(u) => u.email}
                                            filterItem={(u, q) =>
                                                toSafeLower(u.name).includes(q) || toSafeLower(u.email).includes(q)
                                            }
                                            renderItem={renderOwnerItem}
                                            maxHeight={240}
                                            emptyText="No workspace members found."
                                            searchPlaceholder="Search members…"
                                            style={styles.listSpacing}
                                        />
                                    )
                                )}
                            </CollabAccordion>

                            {/* ── Collaborators ── */}
                            <CollabAccordion
                                id="collaborators"
                                label="Collaborators"
                                description={`Who can view or edit this board · ${collaboratorCount} member${collaboratorCount !== 1 ? 's' : ''}`}
                                icon="account-group"
                                openSections={openSections}
                                onToggle={toggleSection}
                            >
                                {/* A. Chip row for current collaborators */}
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                                    {Object.keys(collaborators).length === 0 ? (
                                        <Text variant="bodySmall" style={[styles.chipEmptyText, { color: theme.colors.onSurfaceVariant }]}>
                                            No collaborators added
                                        </Text>
                                    ) : (
                                        Object.entries(collaborators).map(([userId, permission]) => {
                                            const user = workspaceUsers.find((u) => u.userId === userId);
                                            const displayName = user?.name || userId;
                                            // TODO: role permission toggle
                                            return (
                                                <Chip
                                                    key={userId}
                                                    mode="flat"
                                                    avatar={<Avatar.Text size={18} label={buildInitials(displayName)} />}
                                                    onClose={() => toggleCollaborator(userId)}
                                                    style={{ backgroundColor: theme.colors.secondaryContainer }}
                                                    textStyle={{ color: theme.colors.onSecondaryContainer }}
                                                >
                                                    {`${displayName} · Can ${permission}`}
                                                </Chip>
                                            );
                                        })
                                    )}
                                </View>

                                {/* B. Add section */}
                                <List.Item
                                    title="Add collaborators"
                                    left={(props) => <List.Icon {...props} icon="plus" />}
                                    right={(props) => <List.Icon {...props} icon={showCollabAdd ? 'chevron-up' : 'chevron-down'} />}
                                    onPress={() => setShowCollabAdd((v) => !v)}
                                    style={styles.addRow}
                                />
                                {showCollabAdd && (
                                    collaboratorCandidates.length === 0 ? (
                                        <Text style={[styles.emptyHint, { color: theme.colors.onSurfaceVariant }]}>
                                            Invite more workspace members to add collaborators.
                                        </Text>
                                    ) : (
                                        <SearchableList
                                            items={collaboratorCandidates}
                                            getKey={(u) => `collab_add_${u.userId}`}
                                            getLabel={(u) => u.name}
                                            getSubtitle={(u) => u.email}
                                            filterItem={(u, q) =>
                                                toSafeLower(u.name).includes(q) || toSafeLower(u.email).includes(q)
                                            }
                                            renderItem={(user) => {
                                                const isSelected = Boolean(collaborators[user.userId]);
                                                return (
                                                    <List.Item
                                                        title={user.name}
                                                        description={user.email ?? undefined}
                                                        left={() => (
                                                            <View style={styles.avatarCell}>
                                                                <UserAvatar user={user} size={32} />
                                                            </View>
                                                        )}
                                                        right={() => <List.Icon icon={isSelected ? 'check' : 'plus'} />}
                                                        onPress={() => toggleCollaborator(user.userId)}
                                                        style={[styles.listItem, isSelected && { opacity: 0.5 }]}
                                                    />
                                                );
                                            }}
                                            maxHeight={220}
                                            emptyText="No workspace members found."
                                            searchPlaceholder="Search members…"
                                            style={styles.listSpacing}
                                        />
                                    )
                                )}
                            </CollabAccordion>

                            {/* ── Set as Dashboard ── */}
                            <CollabAccordion
                                id="dashboard"
                                label="Set as Dashboard"
                                description={
                                    dashboardAssignmentCount > 0
                                        ? `Assigned to ${dashboardAssignmentCount} user${dashboardAssignmentCount !== 1 ? 's' : ''} or role${dashboardAssignmentCount !== 1 ? 's' : ''}`
                                        : 'Assign this board as the home screen for specific people or roles'
                                }
                                icon="view-dashboard"
                                openSections={openSections}
                                onToggle={toggleSection}
                            >
                                {/* A. Chip row — roles | divider | users */}
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScrollRow}>
                                    <View style={styles.chipSplitRow}>
                                        <View style={styles.chipGroup}>
                                            {dashboardRoleIds.length === 0 ? (
                                                <Text variant="bodySmall" style={[styles.chipEmptyText, { color: theme.colors.onSurfaceVariant }]}>
                                                    No roles
                                                </Text>
                                            ) : (
                                                dashboardRoleIds.map((roleId) => {
                                                    const role = workspaceRoles.find((r) => r.roleId === roleId);
                                                    return (
                                                        <Chip
                                                            key={roleId}
                                                            mode="flat"
                                                            icon="account-group"
                                                            onClose={() => toggleDashboardRole(roleId)}
                                                            style={{ backgroundColor: theme.colors.secondaryContainer }}
                                                            textStyle={{ color: theme.colors.onSecondaryContainer }}
                                                        >
                                                            {role?.name || roleId}
                                                        </Chip>
                                                    );
                                                })
                                            )}
                                        </View>
                                        {dashboardRoleIds.length > 0 && dashboardUserIds.length > 0 && (
                                            <View style={[styles.verticalDivider, { backgroundColor: theme.colors.outlineVariant ?? theme.colors.outline }]} />
                                        )}
                                        <View style={styles.chipGroup}>
                                            {dashboardUserIds.length === 0 ? (
                                                <Text variant="bodySmall" style={[styles.chipEmptyText, { color: theme.colors.onSurfaceVariant }]}>
                                                    No users
                                                </Text>
                                            ) : (
                                                dashboardUserIds.map((userId) => {
                                                    const user = workspaceUsers.find((u) => u.userId === userId);
                                                    return (
                                                        <Chip
                                                            key={userId}
                                                            mode="flat"
                                                            avatar={<Avatar.Text size={18} label={buildInitials(user?.name)} />}
                                                            onClose={() => toggleDashboardUser(userId)}
                                                            style={{ backgroundColor: theme.colors.secondaryContainer }}
                                                            textStyle={{ color: theme.colors.onSecondaryContainer }}
                                                        >
                                                            {user?.name || userId}
                                                        </Chip>
                                                    );
                                                })
                                            )}
                                        </View>
                                    </View>
                                </ScrollView>

                                {/* B. Inline override warning */}
                                {overrideCount > 0 && (
                                    <Text variant="bodySmall" style={{ color: theme.colors.error, marginBottom: 8 }}>
                                        {overrideCount} assignment{overrideCount !== 1 ? 's' : ''} will replace an existing dashboard on save.
                                    </Text>
                                )}

                                {/* C. Add section */}
                                <List.Item
                                    title="Add users or roles"
                                    left={(props) => <List.Icon {...props} icon="plus" />}
                                    right={(props) => <List.Icon {...props} icon={showDashboardAdd ? 'chevron-up' : 'chevron-down'} />}
                                    onPress={() => setShowDashboardAdd((v) => !v)}
                                    style={styles.addRow}
                                />
                                {showDashboardAdd && (
                                    <View>
                                        <View style={[styles.tabBar, { borderBottomColor: theme.colors.outlineVariant ?? theme.colors.outline }]}>
                                            <Pressable style={styles.tabItem} onPress={() => setDashboardAddTab('roles')}>
                                                <Text style={[styles.tabLabel, { color: dashboardAddTab === 'roles' ? theme.colors.primary : theme.colors.onSurfaceVariant }]}>
                                                    Roles
                                                </Text>
                                                <View style={[styles.tabIndicator, { backgroundColor: dashboardAddTab === 'roles' ? theme.colors.primary : 'transparent' }]} />
                                            </Pressable>
                                            <Pressable style={styles.tabItem} onPress={() => setDashboardAddTab('users')}>
                                                <Text style={[styles.tabLabel, { color: dashboardAddTab === 'users' ? theme.colors.primary : theme.colors.onSurfaceVariant }]}>
                                                    Users
                                                </Text>
                                                <View style={[styles.tabIndicator, { backgroundColor: dashboardAddTab === 'users' ? theme.colors.primary : 'transparent' }]} />
                                            </Pressable>
                                        </View>
                                        {dashboardAddTab === 'roles' ? (
                                            <SearchableList
                                                items={workspaceRoles}
                                                getKey={(r) => `dash_add_role_${r.roleId}`}
                                                getLabel={(r) => r.name}
                                                filterItem={(r, q) => toSafeLower(r.name).includes(q)}
                                                renderItem={(role) => {
                                                    const isSelected = dashboardRoleIds.includes(role.roleId);
                                                    const subtitle = dashboardDataLoading ? 'Loading...' : (roleDashboardLabel[role.roleId] ?? 'No dashboard set');
                                                    return (
                                                        <List.Item
                                                            title={role.name}
                                                            description={subtitle}
                                                            left={() => <List.Icon icon="account-group" />}
                                                            right={() => <List.Icon icon={isSelected ? 'check' : 'plus'} />}
                                                            onPress={() => toggleDashboardRole(role.roleId)}
                                                            style={[styles.listItem, isSelected && { opacity: 0.5 }]}
                                                        />
                                                    );
                                                }}
                                                loading={dashboardDataLoading}
                                                maxHeight={220}
                                                emptyText="No workspace roles found."
                                                searchPlaceholder="Search roles…"
                                                style={styles.listSpacing}
                                            />
                                        ) : (
                                            <SearchableList
                                                items={workspaceUsers}
                                                getKey={(u) => `dash_add_user_${u.userId}`}
                                                getLabel={(u) => u.name}
                                                getSubtitle={(u) => u.email}
                                                filterItem={(u, q) =>
                                                    toSafeLower(u.name).includes(q) || toSafeLower(u.email).includes(q)
                                                }
                                                renderItem={(user) => {
                                                    const isSelected = dashboardUserIds.includes(user.userId);
                                                    const subtitle = dashboardDataLoading ? 'Loading...' : (userDashboardLabel[user.userId] ?? 'No dashboard set');
                                                    return (
                                                        <List.Item
                                                            title={user.name}
                                                            description={subtitle}
                                                            left={() => (
                                                                <View style={styles.avatarCell}>
                                                                    <UserAvatar user={user} size={32} />
                                                                </View>
                                                            )}
                                                            right={() => <List.Icon icon={isSelected ? 'check' : 'plus'} />}
                                                            onPress={() => toggleDashboardUser(user.userId)}
                                                            style={[styles.listItem, isSelected && { opacity: 0.5 }]}
                                                        />
                                                    );
                                                }}
                                                loading={dashboardDataLoading}
                                                maxHeight={220}
                                                emptyText="No workspace members found."
                                                searchPlaceholder="Search users…"
                                                style={styles.listSpacing}
                                            />
                                        )}
                                    </View>
                                )}
                            </CollabAccordion>

                        </View>
                    )}
                </View>

                <Divider style={styles.divider} />

                {/* ── Actions ── */}
                <View style={styles.section}>
                    <Text variant="titleMedium" style={styles.sectionTitle}>Actions</Text>
                    <BasicButton label="Duplicate Board" mode="outlined" icon="content-copy" fullWidth onPress={handleDuplicate} style={styles.actionBtn} />
                    <BasicButton label="Delete Board" mode="outlined" icon="delete" danger fullWidth onPress={handleDelete} style={styles.actionBtn} />
                </View>

                <View style={styles.buttonRow}>
                    <BasicButton label="Cancel" mode="outlined" fullWidth onPress={() => router.back()} disabled={saving} style={styles.halfBtn} />
                    <BasicButton label="Save Changes" fullWidth onPress={handleSave} loading={saving} disabled={saving} style={styles.halfBtn} />
                </View>
            </ScrollView>
        </ResponsiveScreen>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, padding: 16 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    section: { marginBottom: 24 },
    sectionTitle: { marginBottom: 12 },
    sectionDescription: { marginBottom: 16, fontSize: 14 },

    input: { marginBottom: 14 },
    divider: { marginVertical: 20 },

    collabLoading: { paddingVertical: 20, alignItems: 'center', gap: 12 },
    collabError: { gap: 8 },

    // Accordion group
    accordionGroup: { gap: 8 },
    accordionWrapper: {
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 8,
        overflow: 'hidden',
    },
    accordionHeader: { paddingHorizontal: 4 },
    accordionTitle: { fontWeight: '600' },
    accordionDesc: { fontSize: 12 },
    accordionContent: { paddingHorizontal: 12, paddingBottom: 16, paddingTop: 4 },
    accordionHint: { fontSize: 13, marginBottom: 10 },

    // Lists
    listSpacing: { marginTop: 4 },
    emptyHint: { fontSize: 13, paddingVertical: 8 },

    // List items
    listItem: { paddingLeft: 0, paddingRight: 0 },
    avatarCell: { justifyContent: 'center', alignItems: 'center', marginRight: 10 },
    roleIconCell: { marginRight: 2 },
    textBlock: { flex: 1 },
    boldLabel: { fontWeight: '600' },

    // Chip rows
    chipScrollRow: { marginBottom: 8 },
    chipSplitRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    chipGroup: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    verticalDivider: { width: StyleSheet.hairlineWidth, height: 24, alignSelf: 'center', marginTop: 6 },
    chipEmptyText: { fontSize: 12, fontStyle: 'italic', paddingTop: 4 },

    // Tab bar
    tabBar: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, marginBottom: 8 },
    tabItem: { flex: 1, alignItems: 'center', paddingVertical: 8 },
    tabIndicator: { height: 2, width: '100%', marginTop: 6 },
    tabLabel: { fontSize: 13, fontWeight: '600' },

    // Add row / owner row
    addRow: { paddingLeft: 0, paddingRight: 0, marginTop: 4 },
    ownerDisplayRow: { paddingLeft: 0, paddingRight: 0 },

    // Bottom actions
    actionBtn: { marginBottom: 10 },
    buttonRow: { flexDirection: 'row', gap: 12, marginTop: 16, marginBottom: 32 },
    halfBtn: { flex: 1 },
});

export default BoardSettings;
