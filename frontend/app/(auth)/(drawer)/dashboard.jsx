import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { ActivityIndicator, Button, Text } from 'react-native-paper';
import { router, useFocusEffect } from 'expo-router';
import ResponsiveScreen from '../../../components/layout/ResponsiveScreen';
import Header from '../../../components/layout/Header';
import BoardService from '../../../services/BoardService';
import BoardView from './boards/[id]/index';

const Dashboard = () => {
    const [boardId, setBoardId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const loadDashboard = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const boards = await BoardService.getAllBoards();
            const activeId = await BoardService.getActiveDashboardId(boards);
            setBoardId(activeId ?? null);
        } catch (err) {
            console.error('[Dashboard] Failed to load dashboard board:', err);
            setError('Unable to load your dashboard right now.');
            setBoardId(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadDashboard();
    }, [loadDashboard]);

    useFocusEffect(
        useCallback(() => {
            loadDashboard();
        }, [loadDashboard])
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
                    <Text style={styles.message}>Loading dashboard…</Text>
                </View>
            </ResponsiveScreen>
        );
    }

    if (error || !boardId) {
        return (
            <ResponsiveScreen
                header={<Header title="Dashboard" showMenu />}
                center={true}
            >
                <View style={styles.centered}>
                    <Text style={styles.message}>
                        {error ?? 'No dashboard board has been created yet.'}
                    </Text>
                    <Button mode="contained" onPress={handleOpenBoards} style={styles.actionButton}>
                        Manage Boards
                    </Button>
                </View>
            </ResponsiveScreen>
        );
    }

    return (
        <ResponsiveScreen
            header={<Header title="Dashboard" showMenu />}
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

export default Dashboard;
