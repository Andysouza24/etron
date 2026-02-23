import { Slot, router } from 'expo-router';
import { useEffect } from 'react';
import { useAuthenticator } from '@aws-amplify/ui-react-native';
import { fetchUserAttributes, signOut, updateUserAttributes } from 'aws-amplify/auth';
import { useVerification } from '../../contexts/VerificationContext';
import { saveWorkspaceInfo } from '../../storage/workspaceStorage';
import { saveUserInfo, removeWorkspaceInfo } from '../../storage/userStorage';
import { apiGet } from '../../utils/api/apiClient';
import endpoints from '../../utils/api/endpoints';
import workspaceService from '../../services/WorkspaceService';

export default function AuthLayout() {
    const { authStatus } = useAuthenticator();
    const { verifyingPassword } = useVerification();

    const setHasWorkspaceAttribute = async (value) => {
        try {
            await updateUserAttributes({
                userAttributes: {
                    'custom:has_workspace': value ? 'true' : 'false'
                }
            });
        } catch (error) {
            console.error("Unable to update user attribute has_workspace:", error);
        }
    }

    const checkWorkspaceExists = async () => {
        let hasWorkspaceAttribute = null;
        try {
            const userAttributes = await fetchUserAttributes();

            hasWorkspaceAttribute = userAttributes["custom:has_workspace"];
            console.log("DEBUG: hasWorkspaceAttribute =", hasWorkspaceAttribute);

            // if the attribute doesn't exist, set it to false
            if (hasWorkspaceAttribute == null) {
                await setHasWorkspaceAttribute(false);
                const refreshed = await fetchUserAttributes();
                hasWorkspaceAttribute = refreshed["custom:has_workspace"];
                console.log("DEBUG: refreshed hasWorkspaceAttribute =", hasWorkspaceAttribute);
            }
    
        } catch (error) {
            console.error("DEBUG: Error fetching attributes:", error);
            console.error("Error fetching workspace status:", error);
            return false;
        }

        if (hasWorkspaceAttribute === "true") {
            console.log("DEBUG: hasWorkspaceAttribute is true, fetching workspace...");
            const userAttributes = await fetchUserAttributes();
            const userId = userAttributes.sub;
            console.log("DEBUG: userId =", userId);

            let workspace;
            try {
                const result = await apiGet(endpoints.workspace.core.getByUserId(userId));
                console.log("DEBUG: raw API response =", JSON.stringify(result.data));
                workspace = result.data;
            } catch (error) {
                console.error("DEBUG: Workspace fetch FAILED:", error.message);
                console.error("DEBUG: Full error:", JSON.stringify(error.response?.data));
                await setHasWorkspaceAttribute(false);
                if (error.message.includes("Workspace not found")) {
                    console.log("No workspace yet.");
                    await removeWorkspaceInfo();
                    return false;
                } else if (error.message.includes("No user found")) {
                    console.log("No user found, rerouting to landing page...")
                    router.replace("/landing.jsx");
                    return false;
                }
                console.error("Error fetching workspace:", error);
                return false;
            }
            console.log("DEBUG: workspace =", JSON.stringify(workspace));
            console.log("DEBUG: workspace.workspaceId =", workspace?.workspaceId);
            
            if (workspace.workspaceId) {
                console.log("DEBUG: Found workspaceId, saving...");
                console.log("WorkspaceId received from server:", workspace.workspaceId);
                return true;
            }

            console.log("DEBUG: No workspaceId in response, signing out");
            // if user attribute has_workspace === true but not in local storage force sign out
            console.log("WorkspaceId cannot be fetched from local storage");
            await signOut();
        }

        return false;
    }

    const checkPersonalDetailsExists = async () => {
        try {
            const userAttributes = await fetchUserAttributes();

            const hasGivenName = userAttributes["given_name"];
            const hasFamilyName = userAttributes["family_name"];

            // if the name attributes don't exist, return false
            if (hasGivenName && hasFamilyName) {
                return true;
            }
    
            return false;
        } catch (error) {
            console.error("Error fetching user attributes:", error);
            return false;
        }
    }

    const saveInfoIntoStorage = async() => {
        try {
            const userAttributes = await fetchUserAttributes();
            const result = await apiGet(endpoints.workspace.core.getByUserId(userAttributes.sub));
            await workspaceService.setupWorkspaceStorage(result.data, userAttributes.sub);
            console.log("[_layout.jsx] Workspace storage setup completed");
        } catch (error) {
            console.error("[_layout.jsx] Error saving workspace info into storage:", error);
        }
    }

    const checkAuthStatus = async () => {
        console.log("(AuthLayout) Auth status:", authStatus);

        if (authStatus === 'authenticated') {
            const personalDetailsExists = await checkPersonalDetailsExists().catch(() => false);
            if (!personalDetailsExists) {
                "No personal details"
                router.replace("/(auth)/personalise-account");
                return;
            }

            const workspaceExists = await checkWorkspaceExists().catch(() => false);
            if (!workspaceExists) {
                console.log("No workspace")
                router.replace("/(auth)/workspace-choice")
                return;
            }
            
            await saveInfoIntoStorage();
            router.replace("/(auth)/dashboard")
        } else if (authStatus === `configuring`) {
            console.log("Auth status configuring...")
        } else {
            if (!verifyingPassword) {  // temp until backend
                console.log("Redirecting to root page.");
                if (router.canDismiss()) router.dismissAll();
                router.replace('/landing');
            } else {
                console.log("Paused redirect due to verifying password.");
            }
        }
    }

    useEffect(() => {
        checkAuthStatus();
    }, [authStatus, verifyingPassword]);


    return (         
        <>
            <Slot />
        </> 
    );
}