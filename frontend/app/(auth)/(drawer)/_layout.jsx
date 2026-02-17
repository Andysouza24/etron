// Author(s): Noah Bradley, Holly Wyatt

import { useState, useEffect } from "react";
import { DrawerContentScrollView, DrawerItem } from "@react-navigation/drawer";
import { useTheme, Appbar, Icon, Text } from "react-native-paper";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { Drawer } from "expo-router/drawer"
import DescriptiveButton from "../../../components/common/buttons/DescriptiveButton";
import { commonStyles } from "../../../assets/styles/stylesheets/common";
import PermissionGate from "../../../components/common/PermissionGate";
import { hasPermission } from "../../../utils/permissions";
import { usePermissionSync } from "../../../hooks/usePermissionSync";
import { getWorkspaceId } from "../../../storage/workspaceStorage";
import { useHasPermission } from "../../../hooks/useHasPermission";

const generalOptions = [
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
    }
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
]

const DrawerRow = ({ label, icon, onPress, active = false, style }) => {
    const theme = useTheme();
    const lightBackground = theme.colors.altGM;
    const activeBackground = theme.colors.focusedBackground;
    const onTile = "#000000"

    return (
        <TouchableOpacity
            onPress={onPress}
            style={[
                styles.row,
                { backgroundColor: active ? activeBackground : lightBackground },
                style,
            ]}
            activeOpacity={0.7}
        >
            <Icon source={icon} size={22} color={onTile} />
            <Text style={[styles.rowLabel, { color: onTile }]} numberOfLines={1}>
                {label}
            </Text>
        </TouchableOpacity>
    )
}

const DrawerButton = ({route, options, navigation, permKey, isActive }) => {
    const { allowed } = useHasPermission(permKey)
    return (
        <PermissionGate
            allowed={allowed}
            onAllowed={() => navigation.navigate(route.name)}
        >
            <DrawerItem
                key={route.key}
                label={options.drawerLabel ?? route.name}
                icon={({ size }) => <Icon source={options.drawerIcon ? options.drawerIcon({}).source ?? options.drawerIcon : options.drawerIcon} size={size} color={"#000"} />}
                
                style={[styles.itemContainer, isActive && styles.itemContainerActive]}
                labelStyle={[styles.itemLabel]}
                focused={isActive}
            />
        </PermissionGate>
    );
}

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
        case "boards":
            displayedRoutes = boardRoutes;
            break;
        default:
            displayedRoutes = []
    }

    return (
        <View style={{ flex: 1 }}>
            <DrawerContentScrollView {...props} contentContainerStyle={{ flexGrow: 1 }}>
                {drawerState == "default" ? (
                    <Appbar.Action icon={"menu-open"} onPress={() => {navigation.closeDrawer()}} />
                ) : (
                    <Appbar.Action icon={"arrow-left-thin"} onPress={() => {setDrawerState("default")}} />
                )}
                {drawerState == "default" ? (
                    <View>
                        <DrawerRow
                            label="Boards"
                            icon="view-dashboard"
                            onPress={() => setDrawerState("boards")}
                            style={{ marginTop: 6 }}
                        />
                        <View style={styles.divider} />
                        <DrawerRow
                            label="Day Book"
                            icon="file-document-multiple"
                            onPress={() => setDrawerState("day-book")}
                            style={{ marginTop: 6}}
                        />
                    </View>
                ) : (
                    displayedRoutes.map(({ route, permKey }) => (
                        <DrawerButton
                            key={route.key}
                            route={route}
                            options={descriptors[route.key].options}
                            navigation={navigation}
                            isActive={activeRouteName == route.name}
                            permKey={permKey}
                            style={{backgroundColor:"#000000"}}
                        />
                    ))
                )}
            </DrawerContentScrollView>
            <View style={styles.bottomSection}>
                <View style={styles.divider} />
                {generalRoutes.map(({ route, permKey }) => (
                    <DrawerButton
                        key={route.key}
                        route={route}
                        permKey={permKey}
                        options={descriptors[route.key].options}
                        navigation={navigation}
                        isActive={activeRouteName == route.name}    
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
                overlayColor: 'transparent',
                sceneContainerStyle: {
                    backgroundColor: theme.colors.background,
                }
            }}
        >
            {boardOptions.map(({ name, label, icon }) =>
                <Drawer.Screen
                    key={name}
                    name={name}
                    options={{
                        drawerLabel: label,
                        drawerIcon: ({ size }) => (
                            <Icon source={icon} color="#000" size={size} />
                        ),
                    }}
                />
            )}

            {dayBookOptions.map(({ name, label, icon }) => (
                <Drawer.Screen
                    key={name}
                    name={name}
                    options={{
                        drawerLabel: label,
                        drawerIcon: ({ size }) => (
                            <Icon source={icon} color="#000" size={size} />
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
                        drawerIcon: ({ size }) => (
                            <Icon source={icon} color="#000" size={size} />
                        )
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
        backgroundColor: "#FFFFFF"
    },
    itemContainerActive: {
        backgroundColor: "#E0E0E0"
    },
    itemLabel: {
        color: "#000",
        fontSize: 16,
    },

    // Rows meant to look like drawer buttons
    row: {
        marginHorizontal: 10,
        marginVertical: 6,
        borderRadius: 10,
        paddingHorizontal: 16,
        paddingVertical: 16,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    rowLabel: {
        fontSize: 16,
    },

    bottomSection: {
        paddingBottom: 30,
        marginHorizontal: 12
    },
    divider: {
        alignSelf: "center",
        width: "90%",
        borderTopWidth: 1,
        borderTopColor: "#FFFFFF",
        marginTop: 8,
        marginBottom: 4,
        opacity: 0.6,
    },
});