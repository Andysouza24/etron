// Author(s): Noah Bradley, Holly Wyatt

import { useState, useEffect } from "react";
import { DrawerContentScrollView, DrawerItem } from "@react-navigation/drawer";
import { useTheme, Appbar, Icon, Divider } from "react-native-paper";
import { View, StyleSheet } from "react-native";
import { Drawer } from "expo-router/drawer"
import PermissionGate from "../../../components/common/PermissionGate";
import { usePermissionSync } from "../../../hooks/usePermissionSync";
import { getWorkspaceId } from "../../../storage/workspaceStorage";
import { useHasPermission } from "../../../hooks/useHasPermission";

const generalOptions = [
    {
        name: "notifications",
        label: "Notifications",
        icon: "bell",
    },
    {
        name: "account-settings",
        label: "My Account",
        icon: "account",
    },
    {
        name: "collaboration",
        label: "Collaboration",
        icon: "account-group",
        permKey: "app.workspace.view_collaboration_settings",
    },
    {
        name: "settings",
        label: "Settings",
        icon: "cog",
    },
]

const dayBookOptions = [
    {
        name: "modules/day-book/reports",
        label: "Reports",
        icon: "file-chart",
        permKey: "modules.daybook.reports.view_reports"
    },
    {
        name: "modules/day-book/data-management",
        label: "Data Management",
        icon: "database",
        permKey: "modules.daybook.datasources.view_dataSources"
    },
    {
        name: "modules/day-book/metrics",
        label: "Metrics",
        icon: "chart-line",
        permKey: "modules.daybook.metrics.view_metrics"
    },
    /*{
        name: "modules/day-book/notifications",
        label: "Notifications",
        icon: "bell",
    },*/
]

const boardOptions = [
    {
        name: "dashboard",
        label: "Dashboard",
        icon: "view-compact",
    },
    {
        name: "boards",
        label: "Boards",
        icon: "view-grid-plus",
    },
]

const DrawerButton = ({ route, options, navigation, permKey, isActive }) => {
    const { allowed } = useHasPermission(permKey);
    const theme = useTheme();
    return (
        <PermissionGate
            allowed={allowed}
            onAllowed={() => navigation.jumpTo(route.name)}
        >
            <DrawerItem
                label={options.drawerLabel ?? route.name}
                icon={options.drawerIcon}
                focused={isActive}
                activeTintColor={theme.colors.onSecondaryContainer}
                activeBackgroundColor={theme.colors.secondaryContainer}
                inactiveTintColor={theme.colors.onSurfaceVariant}
                style={styles.itemContainer}
                labelStyle={styles.itemLabel}
                onPress={() => {}}
            />
        </PermissionGate>
    );
};

const CustomDrawer = (props) => {
    const { navigation, drawerState, setDrawerState, state, descriptors } = props;
    const theme = useTheme();

    const activeRouteName = state?.routes?.[state.index]?.name;

    let generalRoutes = [];
    let dayBookRoutes = [];
    let boardRoutes = [];
    state.routes.forEach((route) => {
        const name = route.name;
        const option = [...generalOptions, ...dayBookOptions, ...boardOptions].find((o) => o.name === name);
        const permKey = option?.permKey || null;
        if (generalOptions.some((page) => page.name === name)) {
            generalRoutes.push({ route, permKey });
        } else if (dayBookOptions.some((page) => page.name === name)) {
            dayBookRoutes.push({ route, permKey });
        } else if (boardOptions.some((page) => page.name === name)) {
            boardRoutes.push({ route, permKey });
        }
    });

    let displayedRoutes;
    switch (String(drawerState)) {
        case "day-book":
            displayedRoutes = dayBookRoutes;
            break;
        default:
            displayedRoutes = []
    }

    return (
        <View style={{ flex: 1 }}>
            <DrawerContentScrollView {...props} contentContainerStyle={{ flexGrow: 1, paddingTop: 0 }}>
                {drawerState === "default" ? (
                    <Appbar.Action icon="menu-open" onPress={() => navigation.closeDrawer()} />
                ) : (
                    <Appbar.Action icon="arrow-left-thin" onPress={() => setDrawerState("default")} />
                )}
                {drawerState === "default" ? (
                    <View>
                        <DrawerItem
                            label="Dashboard"
                            icon={({ color, size }) => <Icon source="view-dashboard" size={size} color={color} />}
                            focused={activeRouteName === "dashboard"}
                            activeTintColor={theme.colors.onSecondaryContainer}
                            activeBackgroundColor={theme.colors.secondaryContainer}
                            inactiveTintColor={theme.colors.onSurfaceVariant}
                            onPress={() => {
                                setDrawerState("default");
                                navigation.jumpTo("dashboard");
                                navigation.closeDrawer();
                            }}
                            style={[styles.itemContainer, { marginTop: 6 }]}
                            labelStyle={styles.itemLabel}
                        />
                        <DrawerItem
                            label="Boards"
                            icon={({ color, size }) => <Icon source="view-grid-plus" size={size} color={color} />}
                            focused={activeRouteName === "boards"}
                            activeTintColor={theme.colors.onSecondaryContainer}
                            activeBackgroundColor={theme.colors.secondaryContainer}
                            inactiveTintColor={theme.colors.onSurfaceVariant}
                            onPress={() => {
                                setDrawerState("default");
                                navigation.jumpTo("boards");
                                navigation.closeDrawer();
                            }}
                            style={styles.itemContainer}
                            labelStyle={styles.itemLabel}
                        />
                        <Divider />
                        <DrawerItem
                            label="Day Book"
                            icon={({ color, size }) => <Icon source="file-document-multiple" size={size} color={color} />}
                            inactiveTintColor={theme.colors.onSurfaceVariant}
                            onPress={() => setDrawerState("day-book")}
                            style={[styles.itemContainer, { marginTop: 6 }]}
                            labelStyle={styles.itemLabel}
                        />
                    </View>
                ) : (
                    displayedRoutes.map(({ route, permKey }) => (
                        <DrawerButton
                            key={route.key}
                            route={route}
                            options={descriptors[route.key].options}
                            navigation={navigation}
                            isActive={activeRouteName === route.name}
                            permKey={permKey}
                        />
                    ))
                )}
            </DrawerContentScrollView>
            <View style={styles.bottomSection}>
                <Divider style={styles.divider} />
                {generalRoutes.map(({ route, permKey }) => (
                    <DrawerButton
                        key={route.key}
                        route={route}
                        permKey={permKey}
                        options={descriptors[route.key].options}
                        navigation={navigation}
                        isActive={activeRouteName === route.name}
                    />
                ))}
            </View>
        </View>
    );
}

export default function DrawerLayout() {
    const theme = useTheme();
    const [drawerState, setDrawerState] = useState("default");
    const [workspaceId, setWorkspaceId] = useState(null);
    
    useEffect(() => {
        (async () => {
            const id = await getWorkspaceId();
            setWorkspaceId(id);
        })();
    }, []);

    const { forceRefresh } = usePermissionSync(workspaceId);

    return (
        <Drawer
            drawerContent={(props) => (
                <CustomDrawer
                    {...props}
                    drawerState={drawerState}
                    setDrawerState={setDrawerState}
                />
            )}
            screenOptions={{
                headerShown: false,
                drawerType: 'front',
                drawerStyle: {
                    backgroundColor: theme.colors.navigationRailBackground,
                },
                drawerActiveTintColor: theme.colors.onSecondaryContainer,
                drawerActiveBackgroundColor: theme.colors.secondaryContainer,
                drawerInactiveTintColor: theme.colors.onSurfaceVariant,
                drawerItemStyle: styles.itemContainer,
                drawerLabelStyle: styles.itemLabel,
                overlayColor: 'transparent',
                sceneStyle: {
                    backgroundColor: theme.colors.background,
                },
            }}
        >
            {boardOptions.map(({ name, label, icon }) => (
                <Drawer.Screen
                    key={name}
                    name={name}
                    options={{
                        drawerLabel: label,
                        drawerIcon: ({ size, color }) => (
                            <Icon source={icon} color={color} size={size} />
                        ),
                    }}
                />
            ))}

            {dayBookOptions.map(({ name, label, icon }) => (
                <Drawer.Screen
                    key={name}
                    name={name}
                    options={{
                        drawerLabel: label,
                        drawerIcon: ({ size, color }) => (
                            <Icon source={icon} color={color} size={size} />
                        ),
                    }}
                />
            ))}

            {generalOptions.map(({ name, label, icon }) => (
                <Drawer.Screen
                    key={name}
                    name={name}
                    options={{
                        drawerLabel: label,
                        drawerIcon: ({ size, color }) => (
                            <Icon source={icon} color={color} size={size} />
                        ),
                    }}
                />
            ))}
        </Drawer>
    );
}

const styles = StyleSheet.create({
    itemContainer: {
        marginHorizontal: 10,
        marginVertical: 6,
        borderRadius: 10,
    },
    itemLabel: {
        fontSize: 16,
    },
    bottomSection: {
        paddingBottom: 30,
        marginHorizontal: 12,
    },
    divider: {
        marginTop: 8,
        marginBottom: 4,
        opacity: 0.6,
    },
});