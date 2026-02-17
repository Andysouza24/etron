// Author(s): Rhys Cleary

import { ActivityIndicator, FlatList, StyleSheet, View } from "react-native";
import { PaperProvider, Text } from 'react-native-paper';
import Header from "../../components/layout/Header";
import { commonStyles } from "../../assets/styles/stylesheets/common";
import { useEffect, useState } from "react";
import InviteCard from "../../components/cards/inviteCard";
import BasicButton from "../../components/common/buttons/BasicButton";
import { apiGet, apiPost } from "../../utils/api/apiClient";
import endpoints from "../../utils/api/endpoints";
import { fetchUserAttributes, getCurrentUser, updateUserAttribute, signOut } from "aws-amplify/auth";
import formatTTLDate from "../../utils/format/formatTTLDate";
import { saveWorkspaceInfo } from "../../storage/workspaceStorage";
import { router } from "expo-router";
import ResponsiveScreen from "../../components/layout/ResponsiveScreen";
import StackLayout from "../../components/layout/StackLayout";
import { saveUserInfo } from "../../storage/userStorage";
import { savePermissionsCache } from "../../storage/permissionsStorage";


const JoinWorkspace = () => {
    const [loading, setLoading] = useState(false);
    const [invites, setInvites] = useState([]);
    const [selectedInvite, setSelectedInvite] = useState(null);
    const [joining, setJoining] = useState(false);


    useEffect(() => {
        async function loadInvites() {
            setLoading(true);
            try {
                const userAttributes = await fetchUserAttributes();
                console.log(userAttributes);
                const email = userAttributes.email;
                console.log(email);

                const inviteResult = await apiGet(endpoints.user.invites.getUserInvites, { email });
                console.log("inviteResult.data:", inviteResult.data);
                if (inviteResult.data && inviteResult.data.length > 0) {
                    const processedInvites = (await Promise.all(
                        inviteResult.data.map(async invite => {
                            try {
                                const workspace = await apiGet(endpoints.workspace.core.getWorkspace(invite.workspaceId));
                                return {
                                    ...invite,
                                    expireAt: formatTTLDate(invite.expireAt),
                                    workspaceName: workspace.data.name,
                                    workspaceDescription: workspace.data.description
                                };
                            } catch (error) {
                                if (error.message.includes("Workspace not found")) return null;
                                console.error(`Error retrieving workspace of id ${invite.workspaceId}"`, error);
                                return null;
                            }
                        })
                    )).filter(Boolean);  // Removes all invites that returned errors.

                    setInvites(processedInvites);
                }
            } catch (error) {
                console.error("Error loading workspace invites:", error);
            }
            setLoading(false);
        }
        loadInvites();
    }, []);

    // updates user attributes in cognito
    async function handleUpdateUserAttribute(attributeKey, value) {
        try {
            const output = await updateUserAttribute({
                userAttribute: {
                    attributeKey,
                    value
                }
            });

            const { nextStep } = output;

            switch (nextStep.updateAttributeStep) {
                case 'CONFIRM_ATTRIBUTE_WITH_CODE':
                    const codeDeliveryDetails = nextStep.codeDeliveryDetails;
                    console.log(`Confirmation code was sent to ${codeDeliveryDetails?.deliveryMedium} at ${codeDeliveryDetails?.destination}`);
                    return { needsConfirmation: true };
                case 'DONE':
                    const fieldName = attributeKey.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
                    console.log(`${fieldName} updated successfully`);
                    return { needsConfirmation: false };
                default:
                    console.log(`${attributeKey.replace('_', ' ')} update completed`);
                    return { needsConfirmation: false };
            }
        } catch (error) {
            console.error("Error updating user attribute:", error);
            const fieldName = attributeKey.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
            setMessage(`Error updating ${fieldName}: ${error.message}`);
            return { needsConfirmation: false, error: true };
        }
    }

    const renderInvites = ({item}) => (
        <InviteCard 
            invite={item}
            selected={selectedInvite?.inviteId === item.inviteId}
            onSelect={setSelectedInvite}
        />
    );

    async function handleJoin() {
        setJoining(true);

        try {
            const workspaceId = selectedInvite.workspaceId;
            const inviteId = selectedInvite.inviteId;

            const payload = {
                inviteId
            }
            
            // try adding user to the workspace
            try {
                await apiPost(endpoints.workspace.users.add(workspaceId), payload);
            } catch (error) {
                if (error.message.includes("authUserId is not defined")) console.log("Error adding user to workspace:", error);  // Unknown why error occurs. Function still works.
                else console.error("Error adding user to workspace:", error);
            }

            const result = await apiGet(endpoints.workspace.core.getWorkspace(workspaceId));

            // save workspace and user info to local storage
            const workspace = result.data;
            saveWorkspaceInfo(workspace);

            const userAttributes = await fetchUserAttributes();
            try {
                const result = await apiGet(endpoints.workspace.users.getUser(workspace.workspaceId, userAttributes.sub));
                await saveUserInfo(result.data);  // Saves into local storage
            } catch (error) {
                console.error("Error saving user info into storage:", error);
            }

            // TODO: consider moving seeding to increase reuse
            try {
                const result = await apiGet(endpoints.workspace.core.getEffectivePermissions(workspace.workspaceId));
                await savePermissionsCache({
                    permissions: result.data.permissions,
                    isOwner: result.data.isOwner,
                    version: result.data.version
                });
            } catch (error) {
                console.error("Failed to seed permissions cache: ", error?.message);
            }

            await handleUpdateUserAttribute('custom:has_workspace', "true");

            setJoining(false);

            // navigate to the profile
            router.navigate("/dashboard");
        } catch (error) {
            setJoining(false);
            console.error("Error joining workspace: ", error);
        }
    }

    function navigateToCreateWorkspace() {
        router.navigate("/(auth)/create-workspace");
    }

    async function handleBackSignOut() {
        try {
            await signOut();
            router.replace("/landing");
        } catch (error) {
            console.error("Error signing out:", error);
        }
    }

    return (
        <ResponsiveScreen
            header={<Header
                title="Join Workspace"
                showBack
                backIcon="logout"
                onBackPress={handleBackSignOut}
            />}
            center={false}
            scroll={false}
            loadingOverlayActive={joining}
        >
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" />
                    <Text>Loading invites...</Text>
                </View>
            ) : invites.length === 0 ? (
                <View style={styles.noInvitesContainer}>
                    <Text style={{ fontSize: 16, textAlign: "center"}}>
                        You currently have no pending invites.
                    </Text>
                    <Text style={{ fontSize: 16, textAlign: "center"}}>
                        Ask your workplace to invite you.
                    </Text>
                </View>
            ) : (<>
                    <FlatList
                        data={invites}
                        renderItem={renderInvites}
                        keyExtractor={item => item.inviteId}
                        ItemSeparatorComponent={() => <View style={{height: 12}} />}
                        contentContainerStyle={{ paddingBottom: 16 }}
                        ListFooterComponent={
                            <View style={styles.listFooter}>
                                <BasicButton 
                                    label={joining ? "Joining..." : "Join"} 
                                    onPress={handleJoin}
                                    disabled={joining || !selectedInvite}
                                />
                            </View>
                        }
                    />
                </>
            )}
            <BasicButton
                label={"Create Workspace"}
                onPress={navigateToCreateWorkspace}
                altBackground={(!loading && invites.length == 0) ? false : true}
            />
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
    },
    noInvitesContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        gap: 20
    },
    listFooter: {
        marginTop: 12,
        alignItems: 'flex-end',
    },
})

export default JoinWorkspace;