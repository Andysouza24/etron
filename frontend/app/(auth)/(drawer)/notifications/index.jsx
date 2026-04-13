import React, { useState, useCallback, useEffect } from "react";
import { View, FlatList, StyleSheet } from "react-native";
import { Text, useTheme, Divider } from "react-native-paper";
import { useFocusEffect } from "expo-router";
import { getCurrentUser } from "aws-amplify/auth";
import ResponsiveScreen from "../../../../components/layout/ResponsiveScreen";
import Header from "../../../../components/layout/Header";
import notificationService from "../../../../services/NotificationService";
import { MaterialCommunityIcons } from "@expo/vector-icons";

export default function NotificationsScreen() {
    const theme = useTheme();

    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);

    // TODO: remove — temporary log to get Cognito sub for DynamoDB testing
    /*useEffect(() => {
        getCurrentUser().then((user) => {
            console.log("[Notifications] Cognito sub:", user.userId);
        }).catch((err) => {
            console.error("[Notifications] Failed to get user:", err);
        });
    }, []);*/

    useFocusEffect(
        useCallback(() => {
            let active = true;

            async function load() {
                setLoading(true);
                try {
                    const response = await notificationService.getNotifications();
                    if (active) {
                        setNotifications(response?.data ?? response ?? []);
                    }
                } catch (err) {
                    console.error("[Notifications] Failed to load:", err);
                } finally {
                    if (active) setLoading(false);
                }
            }

            load();
            return () => { active = false; };
        }, [])
    );

    function formatDate(isoString) {
        if (!isoString) return "";
        const date = new Date(isoString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins < 1) return "Just now";
        if (diffMins < 60) return `${diffMins}m ago`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}h ago`;
        return date.toLocaleDateString();
    }

    const renderItem = ({ item }) => (
        <View style={[styles.item, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.iconContainer}>
                <MaterialCommunityIcons
                    name={item.read ? "bell-outline" : "bell-ring-outline"}
                    size={24}
                    color={item.read ? theme.colors.onSurfaceVariant : theme.colors.primary}
                />
            </View>
            <View style={styles.textContainer}>
                <Text variant="titleSmall" numberOfLines={1}>
                    {item.title || "Notification"}
                </Text>
                {item.body ? (
                    <Text
                        variant="bodySmall"
                        numberOfLines={2}
                        style={{ color: theme.colors.onSurfaceVariant }}
                    >
                        {item.body}
                    </Text>
                ) : null}
                <Text
                    variant="labelSmall"
                    style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}
                >
                    {formatDate(item.createdAt)}
                </Text>
            </View>
        </View>
    );

    const EmptyState = () => (
        <View style={styles.empty}>
            <MaterialCommunityIcons
                name="bell-off-outline"
                size={48}
                color={theme.colors.onSurfaceVariant}
            />
            <Text
                variant="bodyLarge"
                style={{ color: theme.colors.onSurfaceVariant, marginTop: 12 }}
            >
                No notifications yet
            </Text>
        </View>
    );

    return (
        <ResponsiveScreen
            scroll={false}
            padded={false}
            header={<Header title="Notifications" showMenu />}
        >
            {loading ? (
                <View style={styles.empty}>
                    <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                        Loading...
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={notifications}
                    keyExtractor={(item) => item.notificationId}
                    renderItem={renderItem}
                    ItemSeparatorComponent={() => <Divider />}
                    ListEmptyComponent={EmptyState}
                    contentContainerStyle={
                        notifications.length === 0 ? styles.emptyList : styles.list
                    }
                />
            )}
        </ResponsiveScreen>
    );
}

const styles = StyleSheet.create({
    list: {
        paddingBottom: 40,
    },
    emptyList: {
        flex: 1,
    },
    item: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 14,
        paddingHorizontal: 16,
        gap: 12,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: "center",
        justifyContent: "center",
    },
    textContainer: {
        flex: 1,
    },
    empty: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
});
