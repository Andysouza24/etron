import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldPlaySound: false,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

export const usePushNotifications = () => {

    // store device expo push token
    const [expoPushToken, setExpoPushToken] = useState();

    // keep track of the most recent notification received
    const [notification, setNotification] = useState();

    // help subscribe to notification events
    const notificationListener = useRef(null);
    const responseListener = useRef(null);

    // prevent duplicate navigations when notification is tapped
    const isNavigatingRef = useRef(false);

    const router = useRouter();
    
    // register device
    async function registerForPushNotificationsAsync() {
        let token;

        // how android handles notifications
        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
                name: 'default',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#FF231F7C',
            });
        }

        if (Device.isDevice) {
            const { status: existingStatus } = await Notifications.getPermissionsAsync();

            let finalStatus = existingStatus;

            // request permission if not granted
            if (existingStatus !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }

            if (finalStatus !== 'granted') {
                return;
            }

            try {
                const projectId =
                    Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
                if (!projectId) {
                    throw new Error('Project ID not found');
                }
                token = await Notifications.getExpoPushTokenAsync({
                    projectId,
                });
            } catch (error) {
                console.error('Error getting Expo push token:', error);
                return;
            }

            return token;
        }
    }

    // handle notification tap
    const handleNotificationResponse = useCallback(async (response) => {

        // prevent duplicate navigations
        if (isNavigatingRef.current) return;

        const data = response.notification.request.content.data;

        if (!data?.screen) return;

        isNavigatingRef.current = true;

        try {
            router.push({
                pathname: data.screen,
                params: { ...data.params },
            });
        } catch (error) {
            console.error('Error handling notification tap:', error);
        } finally {
            // reset flag after delay
            setTimeout(() => {
                isNavigatingRef.current = false;
            }, 1000);
        }
    }, [router]);

    // useEffect
    useEffect(() => {
        // set expo push token
        registerForPushNotificationsAsync().then((token) => {
            setExpoPushToken(token);
        });

        // listen for incoming notifications
        notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
            setNotification(notification);
        });

        // listen for notification taps
        responseListener.current = Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);

        // clean up
        return () => {
            notificationListener.current?.remove();
            responseListener.current?.remove();
        };
    }, [handleNotificationResponse]);

    return {
        expoPushToken,
        notification,
    };
}