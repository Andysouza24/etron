import React, { useState, useEffect, useMemo } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { Text, TextInput, List, Divider, ActivityIndicator, Avatar, RadioButton, Checkbox, Button } from 'react-native-paper';
import { router, useLocalSearchParams } from 'expo-router';
import Header from '../../../../../components/layout/Header';
import BoardService from '../../../../../services/BoardService';
import ResponsiveScreen from '../../../../../components/layout/ResponsiveScreen';
import BasicButton from '../../../../../components/common/buttons/BasicButton';
import apiClient from '../../../../../utils/api/apiClient';
import endpoints from '../../../../../utils/api/endpoints';
import { getWorkspaceId } from '../../../../../storage/workspaceStorage';

const toSafeLower = (value) => (value ? String(value).toLowerCase() : '');

const buildInitials = (label) => {
    if (!label) return '?';
    const trimmed = String(label).trim();
    if (!trimmed) return '?';
    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) {
        return parts[0].charAt(0).toUpperCase();
    }
    const first = parts[0].charAt(0);
    const last = parts[parts.length - 1].charAt(0);
    return `${first}${last}`.toUpperCase();
};

const BoardSettings = () => {
    const { id } = useLocalSearchParams();
    const [board, setBoard] = useState(null);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [saving, setSaving] = useState(false);
    const [workspaceUsers, setWorkspaceUsers] = useState([]);
    const [collaborationLoading, setCollaborationLoading] = useState(true);
    const [collaborationError, setCollaborationError] = useState(null);
    const [ownerId, setOwnerId] = useState(null);
    const [collaborators, setCollaborators] = useState({});

    useEffect(() => {
        loadBoard();
    }, [id]);

    useEffect(() => {
        fetchWorkspaceUsers();
    }, []);

    useEffect(() => {
        if (!board) return;
        hydrateAccessState(board);
    }, [board]);

    const hydrateAccessState = (boardData) => {
        if (!boardData) return;

        const inferredOwnerId = boardData.access?.ownerId || boardData.metadata?.createdBy || null;
        const ownerAsString = inferredOwnerId ? String(inferredOwnerId) : null;
        setOwnerId(ownerAsString);

        const nextCollaborators = {};
        const rawCollaborators = Array.isArray(boardData.access?.collaborators)
            ? boardData.access.collaborators
            : [];

        rawCollaborators.forEach((entry) => {
            if (!entry || entry.userId === undefined || entry.userId === null) return;
            const collaboratorId = String(entry.userId);
            if (ownerAsString && collaboratorId === ownerAsString) {
                return;
            }
            const permission = entry.permission === 'edit' ? 'edit' : 'view';
            nextCollaborators[collaboratorId] = permission;
        });

        setCollaborators(nextCollaborators);
    };

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

    const fetchWorkspaceUsers = async () => {
        try {
            setCollaborationLoading(true);
            setCollaborationError(null);

            const workspaceId = await getWorkspaceId();
            if (!workspaceId) {
                throw new Error('No workspace selected');
            }

            const response = await apiClient.get(endpoints.workspace.users.getUsers(workspaceId));
            const list = Array.isArray(response?.data) ? response.data : [];

            const normalized = list
                .map((user) => {
                    const userId = user?.userId ? String(user.userId) : null;
                    if (!userId) return null;

                    const nameParts = [user?.given_name, user?.family_name].filter(Boolean);
                    const fullName = nameParts.length ? nameParts.join(' ') : null;
                    const fallbackName = user?.email || 'Workspace Member';

                    return {
                        userId,
                        name: fullName || fallbackName,
                        email: user?.email || null,
                        picture: user?.picture || user?.avatarUrl || null,
                        roleId: user?.roleId || null
                    };
                })
                .filter(Boolean)
                .sort((a, b) => toSafeLower(a.name).localeCompare(toSafeLower(b.name)));

            setWorkspaceUsers(normalized);
        } catch (error) {
            console.error('Failed to load workspace users:', error);
            setWorkspaceUsers([]);
            setCollaborationError('Unable to load workspace members right now.');
        } finally {
            setCollaborationLoading(false);
        }
    };

    const ownerOptions = useMemo(() => {
        const options = [...workspaceUsers];
        const hasOwner = ownerId && workspaceUsers.some((user) => user.userId === ownerId);

        if (!hasOwner && ownerId) {
            options.push({
                userId: ownerId,
                name: 'Current Owner',
                email: board?.access?.ownerEmail || null,
                picture: null,
                roleId: null,
                missing: true
            });
        }

        return options;
    }, [workspaceUsers, ownerId, board]);

    const collaboratorCandidates = useMemo(() => {
        if (!workspaceUsers.length) return [];
        return workspaceUsers.filter((user) => user.userId !== ownerId);
    }, [workspaceUsers, ownerId]);

    const handleOwnerChange = (nextOwnerId) => {
        const ownerAsString = String(nextOwnerId);
        setOwnerId(ownerAsString);
        setCollaborators((prev) => {
            if (!prev) return {};
            if (!prev[ownerAsString]) return prev;
            const next = { ...prev };
            delete next[ownerAsString];
            return next;
        });
    };

    const toggleCollaborator = (userId) => {
        const collaboratorId = String(userId);
        setCollaborators((prev) => {
            const next = { ...prev };
            if (next[collaboratorId]) {
                delete next[collaboratorId];
            } else {
                next[collaboratorId] = 'view';
            }
            return next;
        });
    };

    const setCollaboratorPermission = (userId, permission) => {
        setCollaborators((prev) => {
            const collaboratorId = String(userId);
            if (!prev[collaboratorId]) {
                return prev;
            }
            if (prev[collaboratorId] === permission) {
                return prev;
            }
            return {
                ...prev,
                [collaboratorId]: permission === 'edit' ? 'edit' : 'view'
            };
        });
    };

    const renderAvatar = (user, size = 36) => {
        if (user.picture) {
            return <Avatar.Image size={size} source={{ uri: user.picture }} />;
        }

        const labelSource = user.name || user.email || 'User';
        const initials = buildInitials(labelSource);

        return <Avatar.Text size={size} label={initials || '?'} />;
    };

    const handleSave = async () => {
        if (!name.trim()) {
            Alert.alert('Error', 'Board name is required');
            return;
        }

        if (!ownerId) {
            Alert.alert('Error', 'Please choose an owner for this board.');
            return;
        }

        try {
            setSaving(true);
            const collaboratorPayload = Object.entries(collaborators).map(([userId, permission]) => ({
                userId,
                permission: permission === 'edit' ? 'edit' : 'view'
            }));

            const updated = await BoardService.updateBoard(board.id, {
                name: name.trim(),
                description: description.trim(),
                access: {
                    ownerId,
                    collaborators: collaboratorPayload
                }
            });

            if (updated) {
                setBoard(updated);
                setName(updated.name);
                setDescription(updated.description || '');
                hydrateAccessState(updated);
                Alert.alert('Success', 'Settings saved', [
                    { text: 'OK', onPress: () => router.back() }
                ]);
            }
        } catch (error) {
            console.error('Error saving settings:', error);
            Alert.alert('Error', 'Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = () => {
        Alert.alert(
            'Delete Board',
            `Are you sure you want to delete "${board.name}"? This action cannot be undone.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const success = await BoardService.deleteBoard(board.id);
                            if (success) {
                                Alert.alert('Success', 'Board deleted', [
                                    { text: 'OK', onPress: () => router.replace('/boards') }
                                ]);
                            }
                        } catch (error) {
                            console.error('Error deleting board:', error);
                            Alert.alert('Error', 'Failed to delete board');
                        }
                    }
                }
            ]
        );
    };

    const handleDuplicate = async () => {
        try {
            const duplicated = await BoardService.duplicateBoard(board.id);
            if (duplicated) {
                Alert.alert('Success', 'Board duplicated', [
                    {
                        text: 'View Copy',
                        onPress: () => router.replace(`/boards/${duplicated.id}`)
                    },
                    { text: 'Stay Here' }
                ]);
            }
        } catch (error) {
            console.error('Error duplicating board:', error);
            Alert.alert('Error', 'Failed to duplicate board');
        }
    };

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
                    <Text>Loading...</Text>
                </View>
            </ResponsiveScreen>
        );
    }

    return (
        <ResponsiveScreen
            scroll={true}
            padded={false}
            center={false}
            tapToDismissKeyboard={false}
            header={(
                <Header
                    title="Board Settings"
                    showBack
                    showCheck
                    onRightIconPress={handleSave}
                />
            )}
        >
            <ScrollView style={styles.container}>
                <View style={styles.section}>
                    <Text variant="titleMedium" style={styles.sectionTitle}>
                        Basic Information
                    </Text>
                    
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

                <View style={styles.section}>
                    <Text variant="titleMedium" style={styles.sectionTitle}>
                        Board Information
                    </Text>
                    <List.Item
                        title="Created"
                        description={new Date(board.metadata?.createdAt).toLocaleString()}
                        left={() => <List.Icon icon="calendar-plus" />}
                    />
                    <List.Item
                        title="Last Updated"
                        description={new Date(board.metadata?.updatedAt).toLocaleString()}
                        left={() => <List.Icon icon="calendar-edit" />}
                    />
                    <List.Item
                        title="Items"
                        description={`${board.items?.length || 0} items`}
                        left={() => <List.Icon icon="grid" />}
                    />
                    <List.Item
                        title="Version"
                        description={`v${board.metadata?.version || 1}`}
                        left={() => <List.Icon icon="tag" />}
                    />
                </View>

                <Divider style={styles.divider} />

                <View style={styles.section}>
                    <Text variant="titleMedium" style={styles.sectionTitle}>
                        Collaboration
                    </Text>
                    <Text style={styles.sectionDescription}>
                        Choose who can access this board, decide what they can do, and update the owner when responsibilities change.
                    </Text>

                    {collaborationLoading ? (
                        <View style={styles.collaborationLoading}>
                            <ActivityIndicator />
                            <Text style={styles.collaborationLoadingText}>Loading workspace members...</Text>
                        </View>
                    ) : collaborationError ? (
                        <View style={styles.collaborationErrorContainer}>
                            <Text style={styles.collaborationError}>{collaborationError}</Text>
                            <BasicButton
                                label="Try Again"
                                mode="outlined"
                                onPress={fetchWorkspaceUsers}
                                style={styles.retryButton}
                                fullWidth
                            />
                        </View>
                    ) : (
                        <>
                            <View style={styles.subsection}>
                                <Text variant="titleSmall" style={styles.subsectionTitle}>
                                    Board Owner
                                </Text>
                                {ownerOptions.map((user) => {
                                    const isSelected = ownerId === user.userId;
                                    const subtitle = user.missing
                                        ? 'Not currently in this workspace'
                                        : user.email || undefined;

                                    return (
                                        <List.Item
                                            key={`owner_${user.userId}`}
                                            title={user.name}
                                            description={subtitle}
                                            left={() => (
                                                <View style={styles.ownerAvatar}>{renderAvatar(user, 36)}</View>
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
                                })}
                                {!ownerOptions.length && (
                                    <Text style={styles.emptyStateText}>
                                        Add members to this workspace to assign an owner.
                                    </Text>
                                )}
                            </View>

                            <View style={styles.subsection}>
                                <Text variant="titleSmall" style={styles.subsectionTitle}>
                                    Collaborators
                                </Text>
                                <Text style={styles.subsectionDescription}>
                                    Collaborators can view or edit this board based on the permission you set.
                                </Text>

                                {!collaboratorCandidates.length ? (
                                    <Text style={styles.emptyStateText}>
                                        Invite more workspace members to share this board.
                                    </Text>
                                ) : (
                                    collaboratorCandidates.map((user) => {
                                        const collaboratorId = user.userId;
                                        const isSelected = Boolean(collaborators[collaboratorId]);
                                        const permission = collaborators[collaboratorId] || 'view';

                                        return (
                                            <View key={`collaborator_${collaboratorId}`} style={styles.collaboratorRow}>
                                                <View style={styles.collaboratorInfo}>
                                                    <Checkbox
                                                        status={isSelected ? 'checked' : 'unchecked'}
                                                        onPress={() => toggleCollaborator(collaboratorId)}
                                                    />
                                                    <View style={styles.collaboratorAvatar}>{renderAvatar(user, 32)}</View>
                                                    <View style={styles.collaboratorTextContainer}>
                                                        <Text style={styles.collaboratorName}>{user.name}</Text>
                                                        {user.email ? (
                                                            <Text style={styles.collaboratorEmail}>{user.email}</Text>
                                                        ) : null}
                                                    </View>
                                                </View>
                                                {isSelected && (
                                                    <View style={styles.permissionButtons}>
                                                        <Button
                                                            compact
                                                            mode={permission === 'view' ? 'contained-tonal' : 'outlined'}
                                                            onPress={() => setCollaboratorPermission(collaboratorId, 'view')}
                                                            style={styles.permissionButton}
                                                        >
                                                            View
                                                        </Button>
                                                        <Button
                                                            compact
                                                            mode={permission === 'edit' ? 'contained' : 'outlined'}
                                                            onPress={() => setCollaboratorPermission(collaboratorId, 'edit')}
                                                            style={styles.permissionButton}
                                                        >
                                                            Edit
                                                        </Button>
                                                    </View>
                                                )}
                                            </View>
                                        );
                                    })
                                )}
                            </View>
                        </>
                    )}
                </View>

                <Divider style={styles.divider} />

                <View style={styles.section}>
                    <Text variant="titleMedium" style={styles.sectionTitle}>
                        Actions
                    </Text>
                    <BasicButton
                        label="Duplicate Board"
                        mode="outlined"
                        icon="content-copy"
                        fullWidth
                        onPress={handleDuplicate}
                        style={styles.actionButton}
                    />
                    <BasicButton
                        label="Delete Board"
                        mode="outlined"
                        icon="delete"
                        danger
                        fullWidth
                        onPress={handleDelete}
                        style={styles.actionButton}
                    />
                </View>

                <View style={styles.buttonContainer}>
                    <BasicButton
                        label="Cancel"
                        mode="outlined"
                        fullWidth
                        onPress={() => router.back()}
                        disabled={saving}
                        style={styles.cancelButton}
                    />
                    <BasicButton
                        label="Save Changes"
                        fullWidth
                        onPress={handleSave}
                        loading={saving}
                        disabled={saving}
                        style={styles.saveButton}
                    />
                </View>
            </ScrollView>
        </ResponsiveScreen>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    section: {
        marginBottom: 24
    },
    sectionTitle: {
        marginBottom: 16
    },
    sectionDescription: {
        marginBottom: 16,
        color: '#5a5a5a'
    },
    subsection: {
        marginBottom: 24
    },
    subsectionTitle: {
        marginBottom: 12
    },
    subsectionDescription: {
        marginBottom: 12,
        color: '#5a5a5a'
    },
    emptyStateText: {
        color: '#5a5a5a'
    },
    collaborationLoading: {
        paddingVertical: 16,
        alignItems: 'center',
        gap: 12
    },
    collaborationLoadingText: {
        color: '#5a5a5a'
    },
    collaborationErrorContainer: {
        gap: 12
    },
    collaborationError: {
        color: '#b3261e'
    },
    retryButton: {
        marginTop: 4
    },
    listItem: {
        paddingLeft: 0,
        paddingRight: 0
    },
    ownerAvatar: {
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12
    },
    collaboratorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 8,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#e0e0e0'
    },
    collaboratorInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1
    },
    collaboratorAvatar: {
        marginRight: 12
    },
    collaboratorTextContainer: {
        flexShrink: 1
    },
    collaboratorName: {
        fontWeight: '600'
    },
    collaboratorEmail: {
        color: '#5a5a5a',
        marginTop: 2
    },
    permissionButtons: {
        flexDirection: 'row',
        gap: 8,
        marginLeft: 16
    },
    permissionButton: {
        minWidth: 72
    },
    input: {
        marginBottom: 16
    },
    divider: {
        marginVertical: 24
    },
    actionButton: {
        marginBottom: 12
    },
    buttonContainer: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 24,
        marginBottom: 32
    },
    cancelButton: {
        flex: 1
    },
    saveButton: {
        flex: 1
    }
});

export default BoardSettings;
