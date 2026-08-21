import React, { createContext, useContext, useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Platform } from 'react-native';
import notificationService from '../services/NotificationService';
import { usePushNotifications } from '../hooks/system/usePushNotifications';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
    const [preferences, setPreferences] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // track whether the push token has been sent to the backend
    const tokenRegisteredRef = useRef(false);
    const hasFetchedRef = useRef(false);

    // push notification hook — provides device token and incoming notifications
    const { expoPushToken, notification } = usePushNotifications();

    // log provider mount
    useEffect(() => {
        console.log('[NotificationContext] Provider mounted');
    }, []);

    // log token status when it changes
    useEffect(() => {
        console.log('[NotificationContext] Token status', {
            hasToken: !!expoPushToken?.data,
            expoPushToken: expoPushToken?.data ?? 'none (simulator/web)',
        });
    }, [expoPushToken]);

    // register the device push token with the backend once available
    useEffect(() => {
        if (!expoPushToken?.data || tokenRegisteredRef.current) return;

        const register = async () => {
            try {
                await notificationService.registerPushToken(expoPushToken.data, Platform.OS);
                tokenRegisteredRef.current = true;
                console.log('[NotificationContext] Registered push token with backend');
            } catch (err) {
                console.error('[NotificationContext] Failed to register push token:', err);
            }
        };

        register();
    }, [expoPushToken]);

    // load notification preferences from the backend
    const loadPreferences = useCallback(async () => {
        if (hasFetchedRef.current) return;
        setLoading(true);
        setError(null);
        try {
            const response = await notificationService.getPreferences();
            setPreferences(response?.data ?? response);
            hasFetchedRef.current = true;
        } catch (err) {
            console.error('[NotificationContext] Failed to load preferences:', err);
            setError(err);
        } finally {
            setLoading(false);
        }
    }, []);

    // update notification preferences
    const updatePreferences = useCallback(async (updated) => {
        setLoading(true);
        setError(null);
        try {
            const response = await notificationService.updatePreferences(updated);
            setPreferences(response?.data ?? response);
        } catch (err) {
            console.error('[NotificationContext] Failed to update preferences:', err);
            setError(err);
        } finally {
            setLoading(false);
        }
    }, []);

    // remove the current device push token from the backend
    const unregisterPushToken = useCallback(async () => {
        if (!expoPushToken?.data) return;
        try {
            await notificationService.removePushToken(expoPushToken.data);
            tokenRegisteredRef.current = false;
        } catch (err) {
            console.error('[NotificationContext] Failed to remove push token:', err);
        }
    }, [expoPushToken]);

    const value = useMemo(() => ({
        preferences,
        loading,
        error,
        notification,
        expoPushToken,
        loadPreferences,
        updatePreferences,
        unregisterPushToken,
    }), [preferences, loading, error, notification, expoPushToken, loadPreferences, updatePreferences, unregisterPushToken]);

    return (
        <NotificationContext.Provider value={value}>
            {children}
        </NotificationContext.Provider>
    );
}

export function useNotificationContext() {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotificationContext must be used within a NotificationProvider');
    }
    return context;
}
