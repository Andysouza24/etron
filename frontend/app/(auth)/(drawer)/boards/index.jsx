import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { Text, IconButton, useTheme } from 'react-native-paper';
import { router, useFocusEffect } from 'expo-router';
import Header from '../../../../components/layout/Header';
import BoardService from '../../../../services/BoardService';
import ResponsiveScreen from '../../../../components/layout/ResponsiveScreen';
import SearchBar from '../../../../components/common/input/SearchBar';
import BasicButton from '../../../../components/common/buttons/BasicButton';
import BoardCard from './components/BoardCard';
import { formatTimeAgo } from '../../../../utils/boards/dateUtils';

const BoardsManagement = () => {
    const theme = useTheme();
    const [boards, setBoards] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [activeBoardId, setActiveBoardId] = useState(null);
    // Load boards
    const loadBoards = useCallback(async () => {
        try {
            setLoading(true);
            const allBoards = await BoardService.getAllBoards();
            const activeId = await BoardService.getActiveDashboardId(allBoards);
            setBoards(allBoards);
            setActiveBoardId(activeId);
        } catch (error) {
            console.error('Error loading boards:', error);
            Alert.alert('Error', 'Failed to load boards');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadBoards();
    }, [loadBoards]);

    useFocusEffect(
        useCallback(() => {
            loadBoards();
        }, [loadBoards])
    );

    const filteredBoards = useMemo(() => {
        const trimmedQuery = searchQuery.trim().toLowerCase();
        if (!trimmedQuery) {
            return boards;
        }

        return boards.filter(board =>
            board.name?.toLowerCase().includes(trimmedQuery) ||
            board.description?.toLowerCase().includes(trimmedQuery)
        );
    }, [boards, searchQuery]);

    const handleCreateBoard = () => {
        router.push('/boards/create');
    };

    const handleViewBoard = (boardId) => {
        router.push(`/boards/${boardId}`);
    };

    const handleEditBoard = (boardId) => {
        router.push(`/boards/${boardId}/edit`);
    };

    const handleDuplicateBoard = async (board) => {
        try {
            const duplicated = await BoardService.duplicateBoard(board.id);
            if (duplicated) {
                Alert.alert('Success', `Board "${board.name}" duplicated`);
                loadBoards();
            } else {
                Alert.alert('Error', 'Failed to duplicate board');
            }
        } catch (error) {
            console.error('Error duplicating board:', error);
            Alert.alert('Error', 'Failed to duplicate board');
        }
    };

    const handleDeleteBoard = (board) => {
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
                                Alert.alert('Success', 'Board deleted');
                                loadBoards();
                            } else {
                                Alert.alert('Error', 'Failed to delete board');
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

    const handleSetAsActive = async (board) => {
        try {
            const success = await BoardService.setAsActiveDashboard(board.id);
            if (success) {
                setActiveBoardId(board.id);
                Alert.alert('Success', `"${board.name}" is now your dashboard`);
            } else {
                Alert.alert('Error', 'Failed to set as dashboard');
            }
        } catch (error) {
            console.error('Error setting active board:', error);
            Alert.alert('Error', 'Failed to set as dashboard');
        }
    };

    const handleSettingsBoard = (board) => {
        router.push(`/boards/${board.id}/settings`);
    };

    return (
        <ResponsiveScreen
            scroll={false}
            padded={false}
            center={false}
            tapToDismissKeyboard={false}
            header={(
                <Header
                    title="Boards"
                    showMenu
                    showPlus
                    onRightIconPress={handleCreateBoard}
                />
            )}
        >
            <View style={styles.container}>
                <SearchBar
                    placeholder="Search boards..."
                    value={searchQuery}
                    onSearch={setSearchQuery}
                    containerStyle={styles.searchBarContainer}
                    searchbarStyle={styles.searchBar}
                />

                <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                    {loading ? (
                        <View style={styles.emptyState}>
                            <Text>Loading boards...</Text>
                        </View>
                    ) : filteredBoards.length === 0 ? (
                        <View style={styles.emptyState}>
                            <IconButton icon="view-grid-plus-outline" size={64} />
                            <Text variant="titleMedium" style={styles.emptyTitle}>
                                {searchQuery ? 'No boards found' : 'No boards yet'}
                            </Text>
                            <Text variant="bodyMedium" style={styles.emptyDescription}>
                                {searchQuery
                                    ? 'Try a different search term'
                                    : 'Create your first board to get started'}
                            </Text>
                            {!searchQuery && (
                                <BasicButton
                                    label="Create Board"
                                    onPress={handleCreateBoard}
                                    style={styles.createButton}
                                />
                            )}
                        </View>
                    ) : (
                        <View style={styles.boardsList}>
                            {filteredBoards.map((board) => {
                                const owner = board.owner || (
                                    board.access?.ownerId
                                        ? { userId: String(board.access.ownerId) }
                                        : null
                                );
                                const isShared = Array.isArray(board?.access?.collaborators) && board.access.collaborators.length > 0;

                                return (
                                    <BoardCard
                                        key={board.id}
                                        board={board}
                                        isActive={board.id === activeBoardId}
                                        lastUpdated={formatTimeAgo(board.metadata?.updatedAt)}
                                        owner={owner}
                                        isShared={isShared}
                                        onView={handleViewBoard}
                                        onEdit={handleEditBoard}
                                        onSetAsDashboard={handleSetAsActive}
                                        onDuplicate={handleDuplicateBoard}
                                        onSettings={handleSettingsBoard}
                                        onDelete={handleDeleteBoard}
                                    />
                                );
                            })}
                        </View>
                    )}
                </ScrollView>
            </View>

        </ResponsiveScreen>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16
    },
    searchBarContainer: {
        marginHorizontal: 0,
        marginBottom: 16
    },
    searchBar: {
        marginBottom: 0
    },
    scrollView: {
        flex: 1
    },
    boardsList: {
        paddingBottom: 80
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 64,
        paddingHorizontal: 32
    },
    emptyTitle: {
        marginTop: 16,
        marginBottom: 8,
        textAlign: 'center'
    },
    emptyDescription: {
        opacity: 0.7,
        textAlign: 'center',
        marginBottom: 24
    },
    createButton: {
        marginTop: 8
    }
});

export default BoardsManagement;
