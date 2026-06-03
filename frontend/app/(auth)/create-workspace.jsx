// Author(s): Rhys Cleary

import { View, TouchableOpacity, Keyboard } from "react-native";
import Header from "../../components/layout/Header";
import { commonStyles } from "../../assets/styles/stylesheets/common";
import { useRouter } from "expo-router";
import { useState } from "react";
import BasicButton from "../../components/common/buttons/BasicButton";
import TextField from "../../components/common/input/TextField";
import StackLayout from "../../components/layout/StackLayout";
import { Text, useTheme } from "react-native-paper";
import { apiPost, apiGet } from "../../utils/api/apiClient";
import endpoints from "../../utils/api/endpoints";
import { saveWorkspaceInfo } from "../../storage/workspaceStorage";
import { signOut, fetchUserAttributes } from "aws-amplify/auth";
import ResponsiveScreen from "../../components/layout/ResponsiveScreen";
import workspaceService from "../../services/WorkspaceService";
import { updateUserAttributeWithStep } from "../../utils/userAttributes";

const CreateWorkspace = () => {
    const router = useRouter();
    const theme = useTheme();

    const [name, setName] = useState("");
    const [location, setLocation] = useState("");
    const [description, setDescription] = useState("");
    const [errors, setErrors] = useState(false);
    const [creating, setCreating] = useState(false);
    const [message, setMessage] = useState("");

    async function handleCreate() {
        Keyboard.dismiss();
        setCreating(true);

        const newErrors = {
            name: !name.trim(),
        };
        setErrors(newErrors);

        if (Object.values(newErrors).some(Boolean)) {
            setCreating(false);
            return;
        }

        try {
            const workspaceData = {
                name: name.trim(),
                location: location.trim() || null,
                description: description.trim() || null
            }

            
            const result = await apiPost(endpoints.workspace.core.create, workspaceData);
            const workspace = result.data;
            const userAttributes = await fetchUserAttributes();

            await workspaceService.setupWorkspaceStorage(workspace, userAttributes.sub);
            await updateUserAttributeWithStep('custom:has_workspace', "true", { onError: setMessage });

            setCreating(false);

            // navigate to the profile
            router.replace("/home");
        } catch (error) {
            setCreating(false);
            console.error("Error creating workspace: ", error);
        }
    }

    function navigateToJoinWorkspace() {
        router.replace("/(auth)/join-workspace");
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
                title="Create Workspace"
                showBack
                backIcon="logout"
                onBackPress={handleBackSignOut}
            />}
            loadingOverlayActive={creating}
        >
            <View>
                <TextField 
                    label="Name" 
                    value={name} 
                    placeholder="Name" 
                    onChangeText={(text) => {
                        setName(text);
                        if (text.trim()) {
                            setErrors((prev) => ({...prev, name: false}))
                        }
                    }} 
                />
                {errors.name && (
                    <Text style={{color: theme.colors.error}}>Please enter a name.</Text>
                )}
            </View>
            <TextField label="Location (Optional)" value={location} placeholder="Location" onChangeText={setLocation} />
            <TextField label="Description (Optional)" value={description} placeholder="Description" onChangeText={setDescription} />
                
            <View style={commonStyles.inlineButtonContainer}>
                <BasicButton 
                    label={creating ? "Creating..." : "Create"} 
                    onPress={handleCreate}
                    disabled={creating || !name} 
                />
                <BasicButton
                    label={"Join Workspace"}
                    onPress={(navigateToJoinWorkspace)}
                    altBackground
                />
            </View>
        </ResponsiveScreen>
    )
}

export default CreateWorkspace;