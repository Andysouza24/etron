import React, { useCallback, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { ActivityIndicator, Button, Text } from 'react-native-paper';
import { router, useFocusEffect } from 'expo-router';
import ResponsiveScreen from '../../../components/layout/ResponsiveScreen';
import Header from '../../../components/layout/Header';
import BoardService from '../../../services/BoardService';
import BoardView from './boards/[id]/index';
import { useHasPermission } from '../../../hooks/useHasPermission';

const Home = () => {
    const [boardId, setBoardId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // dashboard is viewable without view_boards; we only use this permission
    // to decide whether the empty-state should offer a "Manage Boards" action
    const { allowed: canViewBoards } = useHasPermission('app.workspace.view_boards');

    const loadHome = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const dashboard = await BoardService.getDashboard();
            setBoardId(dashboard?.id ?? null);
        } catch (err) {
            console.error('[Home] Failed to load home board:', err);
            setError('Unable to load your home page right now.');
            setBoardId(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadHome();
        }, [loadHome])
    );

    const handleOpenBoards = useCallback(() => {
        router.push('/boards');
    }, []);

    if (loading) {
        return (
            <ResponsiveScreen
                header={false}    
                scroll={false}
                padded={false}
                center={true}
            >
                <View style={styles.centered}>
                    <ActivityIndicator size="large" />
                    <Text style={styles.message}>Loading home…</Text>
                </View>
            </ResponsiveScreen>
        );
    }

    if (error || !boardId) {
        const emptyMessage = error
            ?? (canViewBoards
                ? 'No dashboard has been set for this workspace yet.'
                : 'No dashboard has been set for this workspace yet. Please contact an administrator.');

        return (
            <ResponsiveScreen
                header={<Header title="Home" showMenu />}
                center={true}
            >
                <View style={styles.centered}>
                    <Text style={styles.message}>{emptyMessage}</Text>
                    {canViewBoards && (
                        <Button mode="contained" onPress={handleOpenBoards} style={styles.actionButton}>
                            Manage Boards
                        </Button>
                    )}
                </View>
            </ResponsiveScreen>
        );
    }

    return (
        <ResponsiveScreen
            header={<Header title="Home" showMenu />}
            scroll={false}
            padded={false}
        >
            <BoardView boardId={boardId} showHeader={false} />
        </ResponsiveScreen>
    );
};

const styles = StyleSheet.create({
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24
    },
    message: {
        textAlign: 'center',
        marginTop: 16
    },
    actionButton: {
        marginTop: 24
    }
});

export default Home;
