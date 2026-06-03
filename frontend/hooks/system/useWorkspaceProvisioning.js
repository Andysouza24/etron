import { useCallback } from 'react';
import { updateUserAttributes, fetchUserAttributes } from 'aws-amplify/auth';
import { apiGet } from '../../utils/api/apiClient';
import endpoints from '../../utils/api/endpoints';
import { saveWorkspaceInfo } from '../../storage/workspaceStorage';

// Decides where a freshly-authenticated user should land: complete their
// profile, choose a workspace, or proceed into the app once their workspace is
// resolved and cached. Also lazily initialises the has_workspace attribute.
export default function useWorkspaceProvisioning({ router, setMessage }) {
    const setHasWorkspaceAttribute = useCallback(async (value) => {
        try {
            await updateUserAttributes({
                userAttributes: {
                    'custom:has_workspace': value ? 'true' : 'false'
                }
            });
        } catch (error) {
            console.error("Unable to update user attribute has_workspace:", error);
        }
    }, []);

    const provisionAfterAuth = useCallback(async (user) => {
        const userAttributes = await fetchUserAttributes();
        const hasGivenName = userAttributes["given_name"];
        const hasFamilyName = userAttributes["family_name"];
        let hasWorkspaceAttribute = userAttributes["custom:has_workspace"];

        // if the attribute doesn't exist set it to false
        if (hasWorkspaceAttribute == null) {
            await setHasWorkspaceAttribute(false);
            hasWorkspaceAttribute = "false";
        }

        const hasWorkspace = hasWorkspaceAttribute === "true";

        if (!hasWorkspace) {
            if (!hasGivenName || !hasFamilyName) {
                router.dismissAll();
                router.replace("(auth)/personalise-account");
                return;
            } else {
                router.dismissAll();
                router.replace("(auth)/workspace-choice");
                return;
            }
        } else {
            // fetch the workspace
            try {
                const workspace = await apiGet(
                    endpoints.workspace.core.getByUserId(user.userId)
                );

                if (!workspace.data || !workspace.data.workspaceId) {
                    // clear attribute and redirect to choose workspace
                    await setHasWorkspaceAttribute(false);
                    router.dismissAll();
                    router.replace("(auth)/workspace-choice");
                    return;
                }

                // save locally and go to profile screen
                await saveWorkspaceInfo(workspace.data);
                router.dismissAll();
                router.replace("(auth)/authenticated-loading");
            } catch (error) {
                console.error("Error fetching workspace:", error);
                setMessage("Unable to locate workspace. Please try again.");
            }
        }

        router.dismissAll();
        router.replace("(auth)/authenticated-loading");
    }, [router, setMessage, setHasWorkspaceAttribute]);

    return { provisionAfterAuth, setHasWorkspaceAttribute };
}
