// Author(s): Holly Wyatt, Noah Bradley

import { View, ScrollView, ActivityIndicator, StyleSheet, Platform, Keyboard } from 'react-native'
import { commonStyles } from '../../../../assets/styles/stylesheets/common';
import Header from '../../../../components/layout/Header';
import StackLayout from '../../../../components/layout/StackLayout';
import DescriptiveButton from '../../../../components/common/buttons/DescriptiveButton';
import { router } from 'expo-router';
import { useEffect, useState } from "react";
import { apiDelete, apiGet, apiPut } from '../../../../utils/api/apiClient';
import BasicDialog from '../../../../components/overlays/BasicDialog';
import { useTheme, Text } from "react-native-paper";
import { useVerification } from '../../../../contexts/VerificationContext';
import { verifyPassword } from '../../../../utils/verifyPassword';
import endpoints from '../../../../utils/api/endpoints';
import DropDown from '../../../../components/common/input/DropDown';
import { getCachedIsOwner, clearPermissionsCache } from '../../../../storage/permissionsStorage';

import {
    getCurrentUser,
    deleteUser,
    signOut,
    updateUserAttribute,
} from 'aws-amplify/auth';
import BasicButton from '../../../../components/common/buttons/BasicButton';
import ResponsiveScreen from '../../../../components/layout/ResponsiveScreen';
import { getWorkspaceId } from '../../../../storage/workspaceStorage';

const Account = () => {
    const theme = useTheme();

    const [dialogVisible, setDialogVisible] = useState(false);
    const [leaveDialogVisible, setLeaveDialogVisible] = useState(false);
    const [password, setPassword] = useState("");
    const [passwordError, setPasswordError] = useState(false);
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [leaving, setLeaving] = useState(false);
    const [leavePassword, setLeavePassword] = useState("");
    const [leavePasswordError, setLeavePasswordError] = useState(false);
    const [leavePasswordErrorMessage, setLeavePasswordErrorMessage] = useState("");
    const [isOwner, setIsOwner] = useState(false);
    const [ownerFlowVisible, setOwnerFlowVisible] = useState(false);
    const [ownerPassword, setOwnerPassword] = useState("");
    const [ownerPasswordError, setOwnerPasswordError] = useState(false);
    const [ownerPasswordErrorMessage, setOwnerPasswordErrorMessage] = useState("");
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [selectedNewOwner, setSelectedNewOwner] = useState("");

    useEffect(() => {
        setLoading(true);
        loadAccountEmail();
        (async () => {
            try {
                const owner = await getCachedIsOwner();
                setIsOwner(!!owner);
            if (owner) {
                const workspaceId = await getWorkspaceId();
                const { userId: currentUserId } = await getCurrentUser();
                let result = await apiGet(endpoints.workspace.users.getUsers(workspaceId));
                const candidates = (result.data || []).filter(u => u.userId !== currentUserId);
                setUsers(candidates);

                result = await apiGet(endpoints.workspace.roles.getRoles(workspaceId));
                setRoles((result.data || []).filter(r => !r.owner));
            }
            } catch (error) {
                console.error("Ownership preload failed:", error);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    async function loadAccountEmail() {
        try {
            const { username, userId, signInDetails } = await getCurrentUser();
            setEmail(signInDetails.loginId);
        } catch (error) {
            console.error("Error loading email: ", error);
            setEmail("Error accessing email.");
        }
        setLoading(false);
    }

    const accountSettingsButtons = [
        { label: "Personal Details", description: "Update first and last name, phone number, and avatar", onPress: () => router.navigate("account-settings/personal-details")},
        { label: "Password and Security", onPress: () => router.navigate("account-settings/password-security") },
        { label: "Delete Account", onPress: () => setDialogVisible(true)}
    ]

    async function handleDelete() {
        setDeleting(true);
        const validPassword = await verifyPassword(password); // verify the password before deleting

        if (!validPassword) {
            setPasswordError(true);
            setDeleting(false);
            return;
        }

        try {
            const workspaceId = await getWorkspaceId();
            const { userId } = await getCurrentUser();
            try {
                await apiDelete(endpoints.workspace.users.remove(workspaceId, userId));
            } catch (error) {
                console.error("Error deleting user details in workspace:", error);
                return;
            }
            await clearPermissionsCache(); // clear permissions cache on account deletion
            await deleteUser();  // Deletes user from Cognito
            setDialogVisible(false);
            // _layout will automatically redirect to sign in page from here
        } catch (error) {
            console.error("Error deleting account: ", error);
        } finally {
            setDeleting(false);
        }
    }

    async function handleLeaveWorkspace() {
        Keyboard.dismiss();
        setLeaving(true);


        if (!leavePassword) {
            setLeavePasswordErrorMessage("Please enter your password.");
            setLeavePasswordError(true);
            setLeaving(false);
            return;
        }
        const valid = await verifyPassword(leavePassword);


        if (!valid) {
            setLeavePasswordErrorMessage("The password entered is invalid.");
            setLeavePasswordError(true);
            setLeaving(false);
            return;
        }

        try {
            const workspaceId = await getWorkspaceId();
            const { userId } = await getCurrentUser();
            await apiDelete(endpoints.workspace.users.remove(workspaceId, userId));
            await clearPermissionsCache(); // clear permissions cache on leaving workspace
            setLeaveDialogVisible(false);
            router.navigate("/workspace-choice");
        } catch (error) {
            console.error("Error leaving workspace:", error);
        } finally {
            setLeaving(false);
            setLeavePassword("");
            setLeavePasswordError(false);
            setLeavePasswordErrorMessage("");
        }
    }

    async function handleOwnerTransferAndLeave() {
        Keyboard.dismiss?.();
        if (!ownerPassword) {
            setOwnerPasswordErrorMessage("Please enter your password.");
            setOwnerPasswordError(true);
            return;
        }
        setLeaving(true);
        const valid = await verifyPassword(ownerPassword);
        if (!valid) {
            setOwnerPasswordErrorMessage("The password entered is invalid.");
            setOwnerPasswordError(true);
            setLeaving(false);
            return;
        }
        try {
            const workspaceId = await getWorkspaceId();
            const { userId: currentUserId } = await getCurrentUser();
            if (!selectedNewOwner) {
                setOwnerPasswordErrorMessage("Select a new owner to continue.");
                setOwnerPasswordError(true);
                setLeaving(false);
                return;
            }
            
            const nonOwnerRole = roles[0];
            if (!nonOwnerRole) {
                throw new Error("No non-owner roles available to assign.");
            }
            
            await apiPut(endpoints.workspace.core.transfer(workspaceId), {
                receipientUserId: selectedNewOwner,
                newRoleId: nonOwnerRole.roleId,
            });
            
            await apiDelete(endpoints.workspace.users.remove(workspaceId, currentUserId));
            await clearPermissionsCache(); // clear permissions cache on leaving workspace
            setOwnerFlowVisible(false);
            
            router.navigate("/workspace-choice");
        } catch (err) {
            console.error("Transfer & leave failed:", err);
        } finally {
            setLeaving(false);
            setOwnerPassword("");
            setOwnerPasswordError(false);
            setOwnerPasswordErrorMessage("");
        }
    }

    async function handleOwnerDeleteWorkspace() {
        Keyboard.dismiss?.();

        if (!ownerPassword) {
            setOwnerPasswordErrorMessage("Please enter your password.");
            setOwnerPasswordError(true);
            return;
        }
        setLeaving(true);

        const valid = await verifyPassword(ownerPassword);
        if (!valid) {
            setOwnerPasswordErrorMessage("The password entered is invalid.");
            setOwnerPasswordError(true);
            setLeaving(false);
            return;
        }

        try {
            const workspaceId = await getWorkspaceId();
            await apiDelete(endpoints.workspace.core.delete(workspaceId));
            await clearPermissionsCache(); // clear permissions cache on leaving workspace
            setOwnerFlowVisible(false);
            router.navigate("/workspace-choice");
        } catch (error) {
            console.error("Workspace delete failed:", error);
        } finally {
            setLeaving(false);
            setOwnerPassword("");
            setOwnerPasswordError(false);
            setOwnerPasswordErrorMessage("");
        }
    }

    return(
        <ResponsiveScreen
            header = {<Header title="My Account" showMenu />}
            center = {false}
            loadingOverlayActive={deleting || leaving}
        >
            <StackLayout spacing={12}>
                {accountSettingsButtons.map((item) => (
                    <DescriptiveButton
                        key={item.label}
                        label={item.label}
                        description={item.description}
                        onPress={item.onPress}
                    />
                ))}
                <View style={[commonStyles.inlineButtonContainer, { justifyContent: 'space-between' }]}>
                    <BasicButton
                        label={"Sign Out"}
                        onPress={() => signOut()}
                    />
                    <BasicButton
                        label={"Leave Workspace"}
                        danger
                        onPress={() => {
                            if (isOwner) setOwnerFlowVisible(true);
                            else setLeaveDialogVisible(true);
                        }}
                    />
                </View>
            </StackLayout>
                
            <BasicDialog
                visible={dialogVisible}
                message={"Are you sure you want to delete your account? You will have seven days to login before your data is permanently removed."}
                showInput
                inputLabel={"Password"}
                inputPlaceholder={"Enter Password"}
                inputValue={password}
                inputOnChangeText={(text) => {
                    setPassword(text);
                    if (text) {
                        setPasswordError(false);
                    }
                }}
                onDismiss={() => {
                    setDialogVisible(false);
                    setPassword("");
                    setPasswordError(false);
                }}
                title="Delete Account"
                inputError={passwordError}
                inputErrorMessage={"Incorrect password"}
                secureTextEntry={true}
                leftActionLabel="Go Back"
                handleLeftAction={() => {
                    setDialogVisible(false);
                    setPassword("");
                    setPasswordError(false);
                }}
                rightActionLabel={"Confirm"}
                rightDanger
                handleRightAction={handleDelete}
            />

            <BasicDialog
                visible={leaveDialogVisible}
                onDismiss={() => {
                    setLeaveDialogVisible(false);
                    setLeavePassword("");
                    setLeavePasswordError(false);
                    setLeavePasswordErrorMessage("");
                }}
                title="Leave Workspace"
                message="Enter your password to confirm leaving this workspace."
                showInput
                inputLabel="Password"
                inputPlaceholder="Enter your password"
                inputValue={leavePassword}
                inputOnChangeText={(text) => {
                    setLeavePassword(text);
                    if (text) setLeavePasswordError(false);
                }}
                inputError={leavePasswordError}
                inputErrorMessage={leavePasswordErrorMessage}
                secureTextEntry
                leftActionLabel="Cancel"
                handleLeftAction={() => {
                    setLeaveDialogVisible(false);
                    setLeavePassword("");
                    setLeavePasswordError(false);
                    setLeavePasswordErrorMessage("");
                }}
                rightActionLabel="Leave Workspace"
                rightDanger
                rightDisabled={!leavePassword}
                handleRightAction={handleLeaveWorkspace}
                inputProps={{
                    autoCapitalize: 'none',
                    autoCorrect: false,
                    keyboardType: Platform.OS === 'android' ? 'visible-password' : 'default',
                    onSubmitEditing: handleLeaveWorkspace,
                }}
            />

            <BasicDialog
                visible={ownerFlowVisible}
                onDismiss={() => {
                    setOwnerFlowVisible(false);
                    setOwnerPassword("");
                    setOwnerPasswordError(false);
                    setOwnerPasswordErrorMessage("");
                    setSelectedNewOwner("");
                }}
                title="You're the owner"
                message="To leave, you must transfer ownership to another user or delete the workspace."
                showInput
                inputLabel="Password"
                inputPlaceholder="Enter your password"
                inputValue={ownerPassword}
                inputOnChangeText={(text) => {
                    setOwnerPassword(text);
                    if (text) setOwnerPasswordError(false);
                }}
                inputError={ownerPasswordError}
                inputErrorMessage={ownerPasswordErrorMessage}
                secureTextEntry
                leftActionLabel="Delete Workspace"
                leftDanger
                handleLeftAction={handleOwnerDeleteWorkspace}
                rightActionLabel="Transfer & Leave"
                rightDanger
                rightDisabled={!ownerPassword || !selectedNewOwner}
                handleRightAction={handleOwnerTransferAndLeave}
                inputProps={{
                    autoCapitalize: 'none',
                    autoCorrect: false,
                    keyboardType: Platform.OS === 'android' ? 'visible-password' : 'default',
                    onSubmitEditing: handleOwnerTransferAndLeave,
                }}
            >
                <View style={{ marginTop: 12 }}>
                    <Text style={{ marginBottom: 6 }}>Select new owner</Text>
                    <DropDown
                        title="Choose user"
                        items={users.map(u => ({
                            label: `${u.given_name ?? ''} ${u.family_name ?? ''}`.trim() || u.email,
                            value: u.userId
                        }))}
                        value={selectedNewOwner}
                        onSelect={setSelectedNewOwner}
                        showRouterButton={false}
                    />
                </View>
            </BasicDialog>
        </ResponsiveScreen>
    )
}

const styles = StyleSheet.create({
    contentContainer: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center"
    }
})

export default Account;

