import { Slot, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useAuthenticator } from '@aws-amplify/ui-react-native';
import { fetchUserAttributes, signOut, updateUserAttributes } from 'aws-amplify/auth';
import { useVerification } from '../../contexts/VerificationContext';
import { saveWorkspaceInfo } from '../../storage/workspaceStorage';
import { saveUserInfo, removeWorkspaceInfo } from '../../storage/userStorage';
import { hydrateHideGatedSync } from '../../storage/permissionsStorage';
import { apiGet, setUnauthorizedHandler } from '../../utils/api/apiClient';
import endpoints from '../../utils/api/endpoints';
import workspaceService from '../../services/WorkspaceService';
import { MetricProvider } from '../../contexts/MetricContext';
import { DataSourceProvider } from '../../contexts/DataSourceContext';
import { BoardProvider } from '../../contexts/BoardContext';
import { NotificationProvider } from '../../contexts/NotificationContext';
import { useAppContext } from '../../contexts/AppContext';

export default function AuthLayout() {
    const { authStatus } = useAuthenticator();
    const { verifyingPassword } = useVerification();
    const { setWorkspaceId } = useAppContext();
    const [workspaceId, setLocalWorkspaceId] = useState(null);

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

            // if the attribute doesn't exist, set it to false
            if (hasWorkspaceAttribute == null) {
                await setHasWorkspaceAttribute(false);
                const refreshed = await fetchUserAttributes();
                hasWorkspaceAttribute = refreshed["custom:has_workspace"];
            }
    
        } catch (error) {
            console.error("Error fetching workspace status:", error);
            return false;
        }

        if (hasWorkspaceAttribute === "true") {
            const userAttributes = await fetchUserAttributes();
            const userId = userAttributes.sub;

            let workspace;
            try {
                const result = await apiGet(endpoints.workspace.core.getByUserId(userId));
                workspace = result.data;
            } catch (error) {
                if (error.message.includes("Workspace not found")) {
                    await setHasWorkspaceAttribute(false);
                    console.log("No workspace yet.");
                    await removeWorkspaceInfo();
                    return false;
                } else if (error.message.includes("No user found")) {
                    await setHasWorkspaceAttribute(false);
                    console.log("No user found, rerouting to landing page...")
                    router.replace("/landing.jsx");
                    return false;
                }
                // errors don't clear workspace attribute
                //TODO: fix attribute in cognito/dynamo, stop clearing from frontend
                console.error("Error fetching workspace:", error);
                return false;
            }
            
            if (workspace.workspaceId) {
                console.log("WorkspaceId received from server:", workspace.workspaceId);
                return true;
            }

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
            const wsId = result.data?.workspaceId || result.data?.id;
            if (wsId) {
                setWorkspaceId(wsId);
                setLocalWorkspaceId(wsId);
            }
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
            router.replace("/(auth)/home")
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

    // Register a global unauthorized handler so the api client can force
    // a sign-out + redirect to /landing whenever auth recovery fails
    // (refresh token expired, retry still returns 401, etc.).
    useEffect(() => {
        setUnauthorizedHandler(async (reason) => {
            console.warn('[AuthLayout] Forced sign-out due to:', reason);
            try { await signOut(); } catch (e) { console.error('[AuthLayout] signOut failed:', e); }
            try {
                if (router.canDismiss()) router.dismissAll();
                router.replace('/landing');
            } catch (e) {
                console.error('[AuthLayout] redirect failed:', e);
            }
        });
        return () => setUnauthorizedHandler(null);
    }, []);

    // Hydrate the synchronous mirror of hideGatedComponents from disk so
    // PermissionGate has the correct value on its very first render
    // (before the workspace-setup seed completes).
    useEffect(() => {
        hydrateHideGatedSync();
    }, []);


    return (         
        <NotificationProvider>
            <DataSourceProvider>
                <MetricProvider workspaceId={workspaceId}>
                    <BoardProvider workspaceId={workspaceId}>
                        <Slot />
                    </BoardProvider>
                </MetricProvider>
            </DataSourceProvider>
        </NotificationProvider>
    );
}