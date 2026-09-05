// Author(s): Rhys Cleary, Noah Bradley

import { View, Keyboard } from "react-native";
import { useRouter } from "expo-router";
import StackLayout from "../../../../../components/layout/StackLayout";
import BasicDialog from "../../../../../components/overlays/BasicDialog";
import { useEffect, useState } from "react";
import { apiDelete, apiPut } from "../../../../../utils/api/apiClient";
import { useTheme } from "react-native-paper";
import { verifyPassword } from "../../../../../utils/verifyPassword";
import Header from "../../../../../components/layout/Header";
import { commonStyles } from "../../../../../assets/styles/stylesheets/common";
import DescriptiveButton from "../../../../../components/common/buttons/DescriptiveButton";
import BasicButton from "../../../../../components/common/buttons/BasicButton";
import endpoints from "../../../../../utils/api/endpoints";
import { getWorkspaceId } from "../../../../../storage/workspaceStorage";
import DropDown from "../../../../../components/common/input/DropDown";
import { hasPermission } from "../../../../../utils/permissions";
import ResponsiveScreen from "../../../../../components/layout/ResponsiveScreen";
import { Platform } from "react-native";
import PermissionGate from "../../../../../components/common/PermissionGate";
import { useHasPermission } from "../../../../../hooks/useHasPermission";
import useOwnerCandidates from "../../../../../hooks/system/useOwnerCandidates";

const WorkspaceSettingsItem = ({ option }) => {
    const { allowed } = useHasPermission(option.permKey);
    const router = useRouter();

    return (
        <PermissionGate
            allowed={allowed}
            onAllowed={() => router.navigate(option.route)}
        >
            <DescriptiveButton
                label={option.label}
                description={option.description}
            />  
        </PermissionGate>
    );
}

const WorkspaceManagement = () => {
    const router = useRouter();
    const theme = useTheme();

    const [showDialog, setShowDialog] = useState(false);
    const [dialogMode, setDialogMode] = useState(null); // 'delete' | 'transfer' | null
    const [password, setPassword] = useState("");
    const [passwordError, setPasswordError] = useState(false);
    const [passwordErrorMessage, setPasswordErrorMessage] = useState("");

    const [selectedUser, setSelectedUser] = useState("");
    const [selectedRole, setSelectedRole] = useState("");
    const [workspaceId, setWorkspaceId] = useState(null);

    const { isOwner, users, roles } = useOwnerCandidates();

    const [loading, setLoading] = useState(false);

    // container for different workspace management options
    const permissionButtonMap = [
        {
            permKey: "app.workspace.view_workspace_settings", 
            label: "Workspace Details", 
            description: "Update name, location and description", 
            route: "settings/workspace/view-workspace-details",
        },
        {
            permKey: "app.workspace.manage_modules", 
            label: "Module Management", 
            description: "Add and remove modules from the workspace", 
            route: "settings/workspace/module-management",
        },
        /*{
            permKey: "app.workspace.manage_boards",
            label: "Board Management", 
            description: "Edit boards within the workspace", 
            route: "settings/workspace/board-management",
        },*/
    ];


    useEffect(() => {
        (async () => {
            const id = await getWorkspaceId();
            setWorkspaceId(id);
        })();
    }, []);

    // DELETE WORKSPACE
    async function handleConfirmDeletion() {
        setLoading(true);
        Keyboard.dismiss();
        if (!password) {
            setPasswordErrorMessage("Please enter your password.");
            setPasswordError(true);
            setLoading(false);
            return;
        }

        const validPassword = await verifyPassword(password);
        
        if (!validPassword) {
            setPasswordErrorMessage("The password entered is invalid.");
            setPasswordError(true);
            setLoading(false);
            return;
        }

        if (workspaceId) {
            try {
                await apiDelete(endpoints.workspace.core.delete(workspaceId));
                setLoading(false);
                closeDialog();
                router.navigate("/workspace-choice");
            } catch (error) {
                console.error("Error deleting workspace: ", error);
            }
        }

        setPassword("");
        setPasswordError(false);
        setLoading(false);
    }

    // TRANSFER OWNERSHIP
    async function handleConfirmTransfer() {
        setLoading(true);
        Keyboard.dismiss();
        if (!password) {
            setPasswordErrorMessage("Please enter your password.");
            setPasswordError(true);
            setLoading(false);
            return;
        }

        // validate password
        const validPassword = await verifyPassword(password);
        
        if (!validPassword) {
            setPasswordErrorMessage("The password entered is invalid.");
            setPasswordError(true);
            setLoading(false);
            return;
        }

        if (workspaceId && selectedUser) {
            closeDialog();
            try {
                // transfer ownership
                console.log(selectedUser);
                console.log(selectedRole);

                const transferPayload = {
                    receipientUserId: selectedUser,
                    newRoleId: selectedRole
                };

                const result = await apiPut(endpoints.workspace.core.transfer(workspaceId), transferPayload);
                setLoading(false);
                console.log("Ownership transferred:", result.data);
            } catch (error) {
                console.error("Error transfering ownership: ", error);
            }
        }
        
        setPassword("");
        setPasswordError(false);
        setLoading(false);
    }

    function closeDialog() {
        setShowDialog(false);
        setDialogMode(null);
        setPassword("");
        setPasswordError(false);
        setPasswordErrorMessage("");
    }

    const renderOption = (option) => {
        const anchor = (
            <PermissionGate
                allowed={option.allowed}
                onAllowed={() => router.navigate(option.route)}
                key={option.label}
            >
                <DescriptiveButton
                    label={option.label}
                    description={option.description}
                />
            </PermissionGate>
        );

        return anchor;
    };

    return (
		<ResponsiveScreen
			header={<Header title="Workspace Settings" showBack />}
			center={false}
            scroll={true}
            loadingOverlayActive={loading}
        >
            <StackLayout spacing={12}>
                {permissionButtonMap.map((option)  => (
                    <WorkspaceSettingsItem option={option} key={option.label} />
                ))}
            </StackLayout>
            
            {isOwner && (
                <View style={[commonStyles.inlineButtonContainer, {justifyContent: 'center'}]}>
                    <BasicButton label="Transfer Ownership" danger onPress={() => {
                        Keyboard.dismiss();
                        setDialogMode('transfer');
                        setShowDialog(true);
                    }}/>
                    <BasicButton label="Delete Workspace" danger onPress={() => {
                        Keyboard.dismiss();
                        setDialogMode('delete');
                        setShowDialog(true);
                    }}/>
                </View>
            )}

            {showDialog && (
                <BasicDialog
                    visible={showDialog}
                    onDismiss={closeDialog}
                    title={dialogMode === 'delete' ? 'Delete Workspace' : 'Transfer Ownership'}
                    message={
                        dialogMode === 'delete'
                            ? 'Once you delete a workspace it will erase all of its data. This cannot be undone.'
                            : 'Select a user to transfer ownership of this workspace. Once transferred, this cannot be undone.'
                    }
                    showInput
                    inputLabel="Password"
                    inputPlaceholder="Enter your password"
                    inputValue={password}
                    inputOnChangeText={setPassword}
                    inputError={passwordError}
                    inputErrorMessage={passwordErrorMessage}
                    secureTextEntry={true}
                    leftActionLabel="Cancel"
                    handleLeftAction={closeDialog}
                    rightActionLabel={dialogMode === 'delete' ? 'Delete' : 'Transfer'}
                    rightDanger
                    rightDisabled={
                        dialogMode === 'delete'
                            ? !password
                            : !selectedUser || !selectedRole || !password
                        }
                    handleRightAction={
                        dialogMode === 'delete' ? handleConfirmDeletion : handleConfirmTransfer
                    }
                    /* Optional: forward text-input hints */
                    inputProps={{
                        autoCapitalize: 'none',
                        autoCorrect: false,
                        keyboardType: Platform.OS === 'android' ? 'visible-password' : 'default',
                        onSubmitEditing: () => {
                            Keyboard.dismiss();
                            (dialogMode === 'delete' ? handleConfirmDeletion : handleConfirmTransfer)();
                        }
                    }}
                >
                    {dialogMode === 'transfer' && (<>
                        <DropDown
                            title="Select User"
                            items={users.map(u => ({ label: `${u.given_name} ${u.family_name}`, value: u.userId }))}
                            showRouterButton={false}
                            onSelect={setSelectedUser}
                        />
                        <DropDown
                            title="Select Your New Role"
                            items={roles.map(r => ({ label: r.name, value: r.roleId }))}
                            showRouterButton={false}
                            onSelect={setSelectedRole}
                        />
                    </>)}
                </BasicDialog>
            )}
        </ResponsiveScreen>
    )
}

export default WorkspaceManagement;