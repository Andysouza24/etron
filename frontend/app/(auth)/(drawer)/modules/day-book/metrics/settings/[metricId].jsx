import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import {
    Text,
    List,
    Divider,
    ActivityIndicator,
    Avatar,
    Button,
    useTheme,
    Chip,
} from 'react-native-paper';
import { router, useLocalSearchParams } from 'expo-router';
import Header from '../../../../../../../components/layout/Header';
import ResponsiveScreen from '../../../../../../../components/layout/ResponsiveScreen';
import BasicButton from '../../../../../../../components/common/buttons/BasicButton';
import SearchableList from '../../../../../../../components/collaboration/SearchableList';
import apiClient from '../../../../../../../utils/api/apiClient';
import endpoints from '../../../../../../../utils/api/endpoints';
import { getWorkspaceId } from '../../../../../../../storage/workspaceStorage';
import { useHasPermission } from '../../../../../../../hooks/useHasPermission';
import metricService from '../../../../../../../services/MetricService';

const MANAGE_METRICS_PERM = 'modules.daybook.metrics.manage_metrics';

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

const MetricSettings = () => {
    const { metricId } = useLocalSearchParams();
    const theme = useTheme();
    const { allowed: canManageMetrics, loading: permLoading } = useHasPermission(MANAGE_METRICS_PERM);

    const [saving, setSaving] = useState(false);

    // Access state
    // 'workspace' = all members can see this metric
    // 'specific'  = only listed users / roles
    const [accessType, setAccessType] = useState('workspace');
    const [collaborators, setCollaborators] = useState([]); // [{ userId }]
    const [roleAccess, setRoleAccess] = useState([]);       // [{ roleId }]

    // Workspace data
    const [workspaceUsers, setWorkspaceUsers] = useState([]);
    const [workspaceRoles, setWorkspaceRoles] = useState([]);
    const [collaborationLoading, setCollaborationLoading] = useState(true);
    const [collaborationError, setCollaborationError] = useState(null);

    // Accordion open state
    const [openSections, setOpenSections] = useState(new Set(['access-type', 'users', 'roles']));

    // Progressive disclosure
    const [showUserAdd, setShowUserAdd] = useState(false);
    const [showRoleAdd, setShowRoleAdd] = useState(false);

    const toggleSection = useCallback((key) => {
        setOpenSections((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    }, []);

    // Permission guard
    useEffect(() => {
        if (!permLoading && !canManageMetrics) router.back();
    }, [permLoading, canManageMetrics]);

    // Load collaboration data on mount
    useEffect(() => {
        fetchCollaborationData();
        loadMetricAccess();
    }, [metricId]);

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
            console.error('[MetricSettings] fetchCollaborationData:', error);
            setCollaborationError('Unable to load workspace members right now.');
        } finally {
            setCollaborationLoading(false);
        }
    };

    const loadMetricAccess = async () => {
        if (!metricId) return;
        try {
            const access = await metricService.getMetricCollaboration(metricId);
            setAccessType(access.accessType || 'workspace');
            setCollaborators(Array.isArray(access.collaborators) ? access.collaborators : []);
            setRoleAccess(Array.isArray(access.roleAccess) ? access.roleAccess : []);
        } catch (err) {
            console.error('[MetricSettings] loadMetricAccess:', err);
        }
    };

    // Computed
    const collaboratorCount = collaborators.length;
    const roleCount = roleAccess.length;

    const userAddCandidates = useMemo(
        () => workspaceUsers.filter((u) => !collaborators.some((c) => c.userId === u.userId)),
        [workspaceUsers, collaborators]
    );

    const roleAddCandidates = useMemo(
        () => workspaceRoles.filter((r) => !roleAccess.some((ra) => ra.roleId === r.roleId)),
        [workspaceRoles, roleAccess]
    );

    // Handlers
    const toggleUser = (userId) => {
        const idStr = String(userId);
        setCollaborators((prev) => {
            if (prev.some((c) => c.userId === idStr)) return prev.filter((c) => c.userId !== idStr);
            return [...prev, { userId: idStr }];
        });
    };

    const removeUser = (userId) => {
        Alert.alert('Remove Access', 'Remove this user from the metric?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Remove',
                style: 'destructive',
                onPress: () => setCollaborators((prev) => prev.filter((c) => c.userId !== String(userId))),
            },
        ]);
    };

    const toggleRole = (roleId) => {
        const idStr = String(roleId);
        setRoleAccess((prev) => {
            if (prev.some((r) => r.roleId === idStr)) return prev.filter((r) => r.roleId !== idStr);
            return [...prev, { roleId: idStr }];
        });
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            await metricService.updateMetricCollaboration(metricId, {
                accessType,
                collaborators,
                roleAccess,
            });
            Alert.alert('Saved', 'Collaboration settings updated.', [
                { text: 'OK', onPress: () => router.back() },
            ]);
        } catch (error) {
            console.error('[MetricSettings] handleSave:', error);
            Alert.alert('Error', 'Failed to save collaboration settings.');
        } finally {
            setSaving(false);
        }
    };

    // Access type description
    const accessTypeDescription =
        accessType === 'workspace'
            ? 'All workspace members can see this metric'
            : `${collaboratorCount} user${collaboratorCount !== 1 ? 's' : ''} · ${roleCount} role${roleCount !== 1 ? 's' : ''}`;

    return (
        <ResponsiveScreen
            scroll={true}
            padded={false}
            center={false}
            tapToDismissKeyboard={false}
            header={
                <Header
                    title="Metric Settings"
                    showBack
                    showCheck
                    onRightIconPress={handleSave}
                />
            }
        >
            <ScrollView style={styles.container}>
                {/* ── Collaboration ── */}
                <View style={styles.section}>
                    <Text variant="titleMedium" style={styles.sectionTitle}>Collaboration</Text>
                    <Text style={[styles.sectionDescription, { color: theme.colors.onSurfaceVariant }]}>
                        Control who can see this metric. By default all workspace members have access.
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

                            {/* ── Access Type ── */}
                            <CollabAccordion
                                id="access-type"
                                label="Access Level"
                                description={accessTypeDescription}
                                icon="lock-outline"
                                openSections={openSections}
                                onToggle={toggleSection}
                            >
                                <Text style={[styles.accordionHint, { color: theme.colors.onSurfaceVariant }]}>
                                    Choose who can see this metric.
                                </Text>

                                <List.Item
                                    title="All workspace members"
                                    description="Anyone in the workspace can view this metric"
                                    left={() => <List.Icon icon={accessType === 'workspace' ? 'radiobox-marked' : 'radiobox-blank'} />}
                                    onPress={() => setAccessType('workspace')}
                                    style={styles.listItem}
                                />
                                <List.Item
                                    title="Specific users or roles"
                                    description="Only selected users and roles can view this metric"
                                    left={() => <List.Icon icon={accessType === 'specific' ? 'radiobox-marked' : 'radiobox-blank'} />}
                                    onPress={() => setAccessType('specific')}
                                    style={styles.listItem}
                                />
                            </CollabAccordion>

                            {/* ── Users ── */}
                            {accessType === 'specific' && (
                                <>
                                    <CollabAccordion
                                        id="users"
                                        label="Users"
                                        description={`${collaboratorCount} user${collaboratorCount !== 1 ? 's' : ''} with access`}
                                        icon="account-multiple"
                                        openSections={openSections}
                                        onToggle={toggleSection}
                                    >
                                        {/* Current collaborators */}
                                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                                            {collaborators.length === 0 ? (
                                                <Text variant="bodySmall" style={[styles.chipEmptyText, { color: theme.colors.onSurfaceVariant }]}>
                                                    No users added
                                                </Text>
                                            ) : (
                                                collaborators.map(({ userId }) => {
                                                    const user = workspaceUsers.find((u) => u.userId === userId);
                                                    const displayName = user?.name || userId;
                                                    return (
                                                        <Chip
                                                            key={userId}
                                                            mode="flat"
                                                            avatar={<Avatar.Text size={18} label={buildInitials(displayName)} />}
                                                            onClose={() => removeUser(userId)}
                                                            style={{ backgroundColor: theme.colors.secondaryContainer }}
                                                            textStyle={{ color: theme.colors.onSecondaryContainer }}
                                                        >
                                                            {displayName}
                                                        </Chip>
                                                    );
                                                })
                                            )}
                                        </View>

                                        {/* Add section */}
                                        <List.Item
                                            title="Add users"
                                            left={(props) => <List.Icon {...props} icon="plus" />}
                                            right={(props) => <List.Icon {...props} icon={showUserAdd ? 'chevron-up' : 'chevron-down'} />}
                                            onPress={() => setShowUserAdd((v) => !v)}
                                            style={styles.addRow}
                                        />
                                        {showUserAdd && (
                                            userAddCandidates.length === 0 ? (
                                                <Text style={[styles.emptyHint, { color: theme.colors.onSurfaceVariant }]}>
                                                    All workspace members already have access, or there are no other members.
                                                </Text>
                                            ) : (
                                                <SearchableList
                                                    items={userAddCandidates}
                                                    getKey={(u) => `user_add_${u.userId}`}
                                                    getLabel={(u) => u.name}
                                                    getSubtitle={(u) => u.email}
                                                    filterItem={(u, q) =>
                                                        toSafeLower(u.name).includes(q) || toSafeLower(u.email).includes(q)
                                                    }
                                                    renderItem={(user) => {
                                                        const isSelected = collaborators.some((c) => c.userId === user.userId);
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
                                                                onPress={() => toggleUser(user.userId)}
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

                                    {/* ── Roles ── */}
                                    <CollabAccordion
                                        id="roles"
                                        label="Roles"
                                        description={`${roleCount} role${roleCount !== 1 ? 's' : ''} with access`}
                                        icon="shield-account"
                                        openSections={openSections}
                                        onToggle={toggleSection}
                                    >
                                        {/* Current roles */}
                                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                                            {roleAccess.length === 0 ? (
                                                <Text variant="bodySmall" style={[styles.chipEmptyText, { color: theme.colors.onSurfaceVariant }]}>
                                                    No roles added
                                                </Text>
                                            ) : (
                                                roleAccess.map(({ roleId }) => {
                                                    const role = workspaceRoles.find((r) => r.roleId === roleId);
                                                    return (
                                                        <Chip
                                                            key={roleId}
                                                            mode="flat"
                                                            icon="account-group"
                                                            onClose={() => toggleRole(roleId)}
                                                            style={{ backgroundColor: theme.colors.secondaryContainer }}
                                                            textStyle={{ color: theme.colors.onSecondaryContainer }}
                                                        >
                                                            {role?.name || roleId}
                                                        </Chip>
                                                    );
                                                })
                                            )}
                                        </View>

                                        {/* Add section */}
                                        <List.Item
                                            title="Add roles"
                                            left={(props) => <List.Icon {...props} icon="plus" />}
                                            right={(props) => <List.Icon {...props} icon={showRoleAdd ? 'chevron-up' : 'chevron-down'} />}
                                            onPress={() => setShowRoleAdd((v) => !v)}
                                            style={styles.addRow}
                                        />
                                        {showRoleAdd && (
                                            roleAddCandidates.length === 0 ? (
                                                <Text style={[styles.emptyHint, { color: theme.colors.onSurfaceVariant }]}>
                                                    All workspace roles already have access.
                                                </Text>
                                            ) : (
                                                <SearchableList
                                                    items={roleAddCandidates}
                                                    getKey={(r) => `role_add_${r.roleId}`}
                                                    getLabel={(r) => r.name}
                                                    filterItem={(r, q) => toSafeLower(r.name).includes(q)}
                                                    renderItem={(role) => {
                                                        const isSelected = roleAccess.some((ra) => ra.roleId === role.roleId);
                                                        return (
                                                            <List.Item
                                                                title={role.name}
                                                                left={() => <List.Icon icon="shield-account" />}
                                                                right={() => <List.Icon icon={isSelected ? 'check' : 'plus'} />}
                                                                onPress={() => toggleRole(role.roleId)}
                                                                style={[styles.listItem, isSelected && { opacity: 0.5 }]}
                                                            />
                                                        );
                                                    }}
                                                    maxHeight={220}
                                                    emptyText="No workspace roles found."
                                                    searchPlaceholder="Search roles…"
                                                    style={styles.listSpacing}
                                                />
                                            )
                                        )}
                                    </CollabAccordion>
                                </>
                            )}
                        </View>
                    )}
                </View>

                <Divider style={styles.divider} />

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

    section: { marginBottom: 24 },
    sectionTitle: { marginBottom: 12 },
    sectionDescription: { marginBottom: 16, fontSize: 14 },

    divider: { marginVertical: 20 },

    collabLoading: { paddingVertical: 20, alignItems: 'center', gap: 12 },
    collabError: { gap: 8 },

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

    listSpacing: { marginTop: 4 },
    emptyHint: { fontSize: 13, paddingVertical: 8 },
    listItem: { paddingLeft: 0, paddingRight: 0 },
    avatarCell: { justifyContent: 'center', alignItems: 'center', marginRight: 10 },

    chipEmptyText: { fontSize: 12, fontStyle: 'italic', paddingTop: 4 },
    addRow: { paddingLeft: 0, paddingRight: 0, marginTop: 4 },

    buttonRow: { flexDirection: 'row', gap: 12, marginTop: 16, marginBottom: 32 },
    halfBtn: { flex: 1 },
});

export default MetricSettings;
