// Author(s): Holly Wyatt, Noah Bradley

import { View, StyleSheet, Platform } from 'react-native'
import { commonStyles } from '../../../../assets/styles/stylesheets/common';
import Header from '../../../../components/layout/Header';
import StackLayout from '../../../../components/layout/StackLayout';
import DescriptiveButton from '../../../../components/common/buttons/DescriptiveButton';
import { router } from 'expo-router';
import { useEffect, useState } from "react";
import BasicDialog from '../../../../components/overlays/BasicDialog';
import { useTheme, Text } from "react-native-paper";
import DropDown from '../../../../components/common/input/DropDown';

import {
    getCurrentUser,
    signOut,
} from 'aws-amplify/auth';
import BasicButton from '../../../../components/common/buttons/BasicButton';
import ResponsiveScreen from '../../../../components/layout/ResponsiveScreen';
import useAccountDeletion from '../../../../hooks/system/useAccountDeletion';
import useWorkspaceLeave from '../../../../hooks/system/useWorkspaceLeave';

const Account = () => {
    const theme = useTheme();

    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);

    const deletion = useAccountDeletion();
    const leave = useWorkspaceLeave({ router });

    useEffect(() => {
        setLoading(true);
        loadAccountEmail();
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
        { label: "Delete Account", onPress: () => deletion.open()}
    ]

    return(
        <ResponsiveScreen
            header = {<Header title="My Account" showMenu />}
            center = {false}
            loadingOverlayActive={deletion.deleting || leave.leaving}
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
                            if (leave.isOwner) leave.setOwnerFlowVisible(true);
                            else leave.setLeaveDialogVisible(true);
                        }}
                    />
                </View>
            </StackLayout>

            <BasicDialog
                visible={deletion.dialogVisible}
                message={"Are you sure you want to delete your account? You will have seven days to login before your data is permanently removed."}
                showInput
                inputLabel={"Password"}
                inputPlaceholder={"Enter Password"}
                inputValue={deletion.password}
                inputOnChangeText={deletion.onPasswordChange}
                onDismiss={deletion.close}
                title="Delete Account"
                inputError={deletion.passwordError}
                inputErrorMessage={"Incorrect password"}
                secureTextEntry={true}
                leftActionLabel="Go Back"
                handleLeftAction={deletion.close}
                rightActionLabel={"Confirm"}
                rightDanger
                handleRightAction={deletion.handleDelete}
            />

            <BasicDialog
                visible={leave.leaveDialogVisible}
                onDismiss={() => {
                    leave.setLeaveDialogVisible(false);
                    leave.setLeavePassword("");
                    leave.setLeavePasswordError(false);
                    leave.setLeavePasswordErrorMessage("");
                }}
                title="Leave Workspace"
                message="Enter your password to confirm leaving this workspace."
                showInput
                inputLabel="Password"
                inputPlaceholder="Enter your password"
                inputValue={leave.leavePassword}
                inputOnChangeText={(text) => {
                    leave.setLeavePassword(text);
                    if (text) leave.setLeavePasswordError(false);
                }}
                inputError={leave.leavePasswordError}
                inputErrorMessage={leave.leavePasswordErrorMessage}
                secureTextEntry
                leftActionLabel="Cancel"
                handleLeftAction={() => {
                    leave.setLeaveDialogVisible(false);
                    leave.setLeavePassword("");
                    leave.setLeavePasswordError(false);
                    leave.setLeavePasswordErrorMessage("");
                }}
                rightActionLabel="Leave Workspace"
                rightDanger
                rightDisabled={!leave.leavePassword}
                handleRightAction={leave.handleLeaveWorkspace}
                inputProps={{
                    autoCapitalize: 'none',
                    autoCorrect: false,
                    keyboardType: Platform.OS === 'android' ? 'visible-password' : 'default',
                    onSubmitEditing: leave.handleLeaveWorkspace,
                }}
            />

            <BasicDialog
                visible={leave.ownerFlowVisible}
                onDismiss={() => {
                    leave.setOwnerFlowVisible(false);
                    leave.setOwnerPassword("");
                    leave.setOwnerPasswordError(false);
                    leave.setOwnerPasswordErrorMessage("");
                    leave.setSelectedNewOwner("");
                }}
                title="You're the owner"
                message="To leave, you must transfer ownership to another user or delete the workspace."
                showInput
                inputLabel="Password"
                inputPlaceholder="Enter your password"
                inputValue={leave.ownerPassword}
                inputOnChangeText={(text) => {
                    leave.setOwnerPassword(text);
                    if (text) leave.setOwnerPasswordError(false);
                }}
                inputError={leave.ownerPasswordError}
                inputErrorMessage={leave.ownerPasswordErrorMessage}
                secureTextEntry
                leftActionLabel="Delete Workspace"
                leftDanger
                handleLeftAction={leave.handleOwnerDeleteWorkspace}
                rightActionLabel="Transfer & Leave"
                rightDanger
                rightDisabled={!leave.ownerPassword || !leave.selectedNewOwner}
                handleRightAction={leave.handleOwnerTransferAndLeave}
                inputProps={{
                    autoCapitalize: 'none',
                    autoCorrect: false,
                    keyboardType: Platform.OS === 'android' ? 'visible-password' : 'default',
                    onSubmitEditing: leave.handleOwnerTransferAndLeave,
                }}
            >
                <View style={{ marginTop: 12 }}>
                    <Text style={{ marginBottom: 6 }}>Select new owner</Text>
                    <DropDown
                        title="Choose user"
                        items={leave.users.map(u => ({
                            label: `${u.given_name ?? ''} ${u.family_name ?? ''}`.trim() || u.email,
                            value: u.userId
                        }))}
                        value={leave.selectedNewOwner}
                        onSelect={leave.setSelectedNewOwner}
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
