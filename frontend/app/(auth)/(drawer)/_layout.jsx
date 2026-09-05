// Author(s): Noah Bradley, Holly Wyatt

import { useState, useEffect } from "react";
import { DrawerContentScrollView, DrawerItem } from "@react-navigation/drawer";
import { useTheme, Appbar, Icon, Divider } from "react-native-paper";
import { View, StyleSheet } from "react-native";
import { Drawer } from "expo-router/drawer"
import PermissionGate from "../../../components/common/PermissionGate";
import RouteGuard from "../../../components/common/RouteGuard";
import { usePermissionSync } from "../../../hooks/usePermissionSync";
import { getWorkspaceId } from "../../../storage/workspaceStorage";
import { useHasPermission } from "../../../hooks/useHasPermission";
import { getPermissionForRoute } from "../../../utils/routePermissions";

// drawer entries no longer hold a `permKey` — the required permission is
// looked up via `getPermissionForRoute(name)` against the central route map
// in utils/routePermissions.js so there's a single source of truth.
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
    },
    {
        name: "modules/day-book/data-management",
        label: "Data Management",
        icon: "database",
    },
    {
        name: "modules/day-book/metrics",
        label: "Metrics",
        icon: "chart-line",
    },
    /*{
        name: "modules/day-book/notifications",
        label: "Notifications",
        icon: "bell",
    },*/
]

const boardOptions = [
    {
        name: "home",
        label: "Home",
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

    // boards drawer entry is hardcoded in the default view (not driven by
    // boardOptions) so we need to gate it explicitly using the central map
    const { allowed: canViewBoards } = useHasPermission(getPermissionForRoute("boards"));

    let generalRoutes = [];
    let dayBookRoutes = [];
    let boardRoutes = [];
    state.routes.forEach((route) => {
        const name = route.name;
        // central map returns undefined for unknown routes; in that case the
        // route guard handles redirect, and we treat the entry as gated.
        const permKey = getPermissionForRoute(name) ?? null;
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
                            label="Home"
                            icon={({ color, size }) => <Icon source="home" size={size} color={color} />}
                            focused={activeRouteName === "home"}
                            activeTintColor={theme.colors.onSecondaryContainer}
                            activeBackgroundColor={theme.colors.secondaryContainer}
                            inactiveTintColor={theme.colors.onSurfaceVariant}
                            onPress={() => {
                                setDrawerState("default");
                                navigation.jumpTo("home");
                                navigation.closeDrawer();
                            }}
                            style={[styles.itemContainer, { marginTop: 6 }]}
                            labelStyle={styles.itemLabel}
                        />
                        <PermissionGate
                            allowed={canViewBoards}
                            onAllowed={() => {
                                setDrawerState("default");
                                navigation.jumpTo("boards");
                                navigation.closeDrawer();
                            }}
                        >
                            <DrawerItem
                                label="Boards"
                                icon={({ color, size }) => <Icon source="view-grid-plus" size={size} color={color} />}
                                focused={activeRouteName === "boards"}
                                activeTintColor={theme.colors.onSecondaryContainer}
                                activeBackgroundColor={theme.colors.secondaryContainer}
                                inactiveTintColor={theme.colors.onSurfaceVariant}
                                onPress={() => {}}
                                style={styles.itemContainer}
                                labelStyle={styles.itemLabel}
                            />
                        </PermissionGate>
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
        <>
        <RouteGuard />
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
        </>
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