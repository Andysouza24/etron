// Author(s): Rhys Cleary

import { ActivityIndicator, StyleSheet, View } from "react-native";
import Header from "../../../../../components/layout/Header";
import { useCallback, useEffect, useMemo, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import BasicDialog from "../../../../../components/overlays/BasicDialog";
import ResponsiveScreen from "../../../../../components/layout/ResponsiveScreen";
import SearchBar from "../../../../../components/common/input/SearchBar";
import ListCard from "../../../../../components/cards/listCard";
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from "../../../../../utils/api/apiClient";
import endpoints from "../../../../../utils/api/endpoints";
import { getWorkspaceId } from "../../../../../storage/workspaceStorage";
import { List, Text, useTheme } from "react-native-paper";
import { hasPermission } from "../../../../../utils/permissions";
import CustomBottomSheet from "../../../../../components/BottomSheet/bottom-sheet";
import { FlashList } from "@shopify/flash-list";
import PlaceholderBoard from "../../../../../components/skeleton/PlaceholderBoard";

const ModuleManagement = ({ availableFilters = ['All', 'Financial', 'Employees', 'Marketing']}) => {
    const [loading, setLoading] = useState(true);
    const [modules, setModules] = useState([]);
    const [workspaceId, setWorkspaceId] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedFilter, setSelectedFilter] = useState("All");
    const [unInstallDialogVisible, setUninstallDialogVisible] = useState(false);
    const [selectedModule, setSelectedModule] = useState(null);
    const [showModuleActionsSheet, setShowModuleActionsSheet] = useState(false);

    const theme = useTheme();

    useEffect(() => {
        const init = async () => {
            const id = await getWorkspaceId();

            // check permissions to view this screen
            const allowed = await hasPermission("app.workspace.manage_modules");
            if (!allowed) {
                router.back(); // navigate the user off the screen
                return;
            }
            
            setWorkspaceId(id);

            if (id) {
                await fetchModules(id);
            }
        };
        init();
    }, []);

    useFocusEffect(
        useCallback(() => {
            const refetchModules = async () => {
                if (workspaceId) {
                    setLoading(true);
                    await fetchModules(workspaceId);
                }
            };

            refetchModules();
        }, [workspaceId])
    );

    const fetchModules = async (id) => {
        if (!id) return;

        try {
            const response = await apiGet(
                endpoints.workspace.modules.getInstalledModules(id)
            );

            const installedModules = response.data;

            setModules((installedModules || []).sort((a, b) => a.name.localeCompare(b.name)));
        } catch (error) {
            console.error("Error fetching modules:", error);
        } finally {
            setLoading(false);
        }
    };

    const filteredModules = useMemo(() => {
        return modules.filter((module) => {
            const matchesFilter =
                selectedFilter === "All" || (module.categories || []).includes(selectedFilter);

            const matchesSearch = 
                module.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                module.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (module.keywords || []).some((key) =>
                    key.toLowerCase().includes(searchQuery.toLowerCase())
                );
            
            return matchesFilter && matchesSearch;
        });
    }, [searchQuery, selectedFilter, modules]);

    const handleModuleUninstall = async () => {
        if (!selectedModule) return;
        console.log("Uninstalling module:", selectedModule.key);
        try {
            // call api
            await apiDelete(endpoints.workspace.modules.uninstall(workspaceId, selectedModule.key));

            // if successful remove form the list
            setModules((previous) => previous.filter((module) => module.key !== selectedModule.key));

            // background refetch
            await fetchModules(workspaceId);
        } catch (error) {
            console.error("Failed to uninstall module:", error);
            // show toast
        } finally {
            setUninstallDialogVisible(false);
            setSelectedModule(null);
        }
    };

    const handleModuleToggle = async () => {
        if (!selectedModule) return;
        console.log(`Toggling module: ${selectedModule?.key}. WorkspaceId: ${workspaceId}`);
        try {
            // call api
            await apiPut(endpoints.workspace.modules.toggle(workspaceId, selectedModule.key));

            // background refetch
            await fetchModules(workspaceId);
        } catch (error) {
            console.error("Failed to toggle module:", error);
            // show toast
        }
    };

    const renderModules = ({item}) => (
        <ListCard
            title={item.name}
            content={item.description}
            leftElement={item.icon || "puzzle"}
            //rightIcon="dots-horizontal"
            /*onRightPress={() => {
                setSelectedModule(item);
                console.log(item);
                setShowModuleActionsSheet(true);
            }}*/
            cardStyle={item.cardColor ? { backgroundColor: item.cardColor } : undefined }
            titleStyle={item.fontColor ? { color: item.fontColor } : undefined }
        />
    );

    const handleTogglePress = useCallback(async () => {
        setShowModuleActionsSheet(false);
        if (selectedModule) await handleModuleToggle();
    }, [selectedModule]);

    const handleUninstallPress = () => {
        setShowModuleActionsSheet(false);
        setSelectedModule(module);
        setUninstallDialogVisible(true);
    };

    const moduleActionItems = useMemo(() => {
        if (!selectedModule) return [];

        return [
            {
                icon: selectedModule.enabled ? "toggle-switch-off" : "toggle-switch",
                label: selectedModule.enabled ? "Disable" : "Enable",
                onPress: handleTogglePress,
            },
            {
                icon: "trash-can-outline",
                label: "Uninstall",
                onPress: handleUninstallPress,
            },
        ];
    }, [selectedModule, handleTogglePress, handleUninstallPress]);
    
    return (
		<ResponsiveScreen
			header={<Header title="Modules" showBack showPlus onRightIconPress={() => router.navigate("/settings/workspace/add-modules")} />}
			center={false}
			padded={false}
            scroll={false}
		> 
            
            <View style={styles.contentContainer}>
                {/* Search bar and filter */}
                <SearchBar 
                    placeholder="Search modules"
                    onSearch={setSearchQuery}
                    onFilterChange={setSelectedFilter}
                    filters={availableFilters}
                />

                <View style={styles.listContainer}>
                    <FlashList
                        data={loading ? Array.from({ length: 5 }) : filteredModules}
                        renderItem={loading ? () => <PlaceholderBoard size="small" /> : renderModules}
                        keyExtractor={(item, index) => loading ? `placeholder-${index}` : item.key}
                        estimatedItemSize={100}
                        drawDistance={1}
                        ItemSeparatorComponent={() => <View style={{height: 20}} />}
                        refreshing={loading}
                        onRefresh={async () => {
                            setLoading(true);
                            await fetchModules(workspaceId);
                        }}
                        ListEmptyComponent={
                            !loading ? (
                                <View style={styles.emptyContainer}>
                                    <Text style={styles.emptyText}>No Modules Installed.</Text>
                                    <Text style={styles.emptyText}>This feature is for demonstration purposes only. When additional modules beyond the Day Book are implemented, this will be made functional.</Text>
                                </View>
                            ) : null
                        }
                    />
                </View>
            </View>

            <BasicDialog
                visible={unInstallDialogVisible}
                message={`Uninstall the ${selectedModule?.name || "selected"} module? All module data will be deleted, this can not be undone`}
                leftActionLabel="Cancel"
                handleLeftAction={() => {
                    setUninstallDialogVisible(false);
                    setSelectedModule(null);
                }}
                rightActionLabel="Uninstall"
                rightDanger={true}
                handleRightAction={handleModuleUninstall}
            />

            {showModuleActionsSheet && selectedModule && (
                <CustomBottomSheet
                    variant="standard"
                    header={{
                        title: selectedModule.name,
                        showClose: false,
                    }}
                    footer={{
                        variant: "none"
                    }}
                    data={moduleActionItems}
                    keyExtractor={(item) => item.label}
                    itemTitleExtractor={(item) => item.label}
                    renderItem={({ item }) => (
                        <List.Item
                            title={item.label}
                            left={(props) => (
                                <List.Icon 
                                    {...props} 
                                    icon={item.icon}
                                    color={item.label === "Uninstall" ? theme.colors.error : props.color} 
                                />
                            )}
                            titleStyle={{
                                color: item.label === "Uninstall" ? theme.colors.error : theme.colors.text,
                            }}
                            onPress={() => item.label === "Uninstall"
                                ? handleUninstallPress()
                                : handleTogglePress()
                            }
                        />
                    )}
                    onChange={(index) => {
                        if (index === -1) { 
                            setShowModuleActionsSheet(false); 
                        }
                    }}
                    onClose={() => {
                        setShowModuleActionsSheet(false);
                    }}
                />
            )}
        </ResponsiveScreen>
    )
};

const styles = StyleSheet.create({
    contentContainer: {
        flex: 1,
    },
    listContainer: {
        flex: 1,
        position: "relative",
    },
    emptyContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
    },
    emptyText: {
        fontSize: 16,
    }
})

export default ModuleManagement;