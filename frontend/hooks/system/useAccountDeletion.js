import { useState, useCallback } from 'react';
import { getCurrentUser, deleteUser } from 'aws-amplify/auth';
import { apiDelete } from '../../utils/api/apiClient';
import endpoints from '../../utils/api/endpoints';
import { getWorkspaceId } from '../../storage/workspaceStorage';
import { clearPermissionsCache } from '../../storage/permissionsStorage';
import { verifyPassword } from '../../utils/verifyPassword';

// Account deletion flow: a password-confirm dialog, then remove the user from
// the workspace, clear the permissions cache, and delete the Cognito user.
// The auth layout handles the post-delete redirect to sign-in.
export default function useAccountDeletion() {
    const [dialogVisible, setDialogVisible] = useState(false);
    const [password, setPassword] = useState("");
    const [passwordError, setPasswordError] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const open = useCallback(() => setDialogVisible(true), []);

    const close = useCallback(() => {
        setDialogVisible(false);
        setPassword("");
        setPasswordError(false);
    }, []);

    const onPasswordChange = useCallback((text) => {
        setPassword(text);
        if (text) {
            setPasswordError(false);
        }
    }, []);

    const handleDelete = useCallback(async () => {
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
    }, [password]);

    return { dialogVisible, password, passwordError, deleting, open, close, onPasswordChange, handleDelete };
}
