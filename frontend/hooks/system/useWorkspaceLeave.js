import { useState, useCallback } from 'react';
import { Keyboard } from 'react-native';
import { getCurrentUser } from 'aws-amplify/auth';
import { apiDelete, apiPut } from '../../utils/api/apiClient';
import endpoints from '../../utils/api/endpoints';
import { getWorkspaceId } from '../../storage/workspaceStorage';
import { clearPermissionsCache } from '../../storage/permissionsStorage';
import { verifyPassword } from '../../utils/verifyPassword';
import useOwnerCandidates from './useOwnerCandidates';

// All "leave workspace" flows for account-settings. Non-owners confirm with a
// password and are removed; owners must either transfer ownership and leave, or
// delete the workspace. Owner candidates/roles come from useOwnerCandidates.
export default function useWorkspaceLeave({ router }) {
    const { isOwner, users, roles } = useOwnerCandidates();

    const [leaveDialogVisible, setLeaveDialogVisible] = useState(false);
    const [leavePassword, setLeavePassword] = useState("");
    const [leavePasswordError, setLeavePasswordError] = useState(false);
    const [leavePasswordErrorMessage, setLeavePasswordErrorMessage] = useState("");

    const [ownerFlowVisible, setOwnerFlowVisible] = useState(false);
    const [ownerPassword, setOwnerPassword] = useState("");
    const [ownerPasswordError, setOwnerPasswordError] = useState(false);
    const [ownerPasswordErrorMessage, setOwnerPasswordErrorMessage] = useState("");
    const [selectedNewOwner, setSelectedNewOwner] = useState("");

    const [leaving, setLeaving] = useState(false);

    const handleLeaveWorkspace = useCallback(async () => {
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
    }, [leavePassword, router]);

    const handleOwnerTransferAndLeave = useCallback(async () => {
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
    }, [ownerPassword, selectedNewOwner, roles, router]);

    const handleOwnerDeleteWorkspace = useCallback(async () => {
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
    }, [ownerPassword, router]);

    return {
        isOwner,
        users,
        roles,
        leaving,
        leaveDialogVisible,
        setLeaveDialogVisible,
        leavePassword,
        setLeavePassword,
        leavePasswordError,
        setLeavePasswordError,
        leavePasswordErrorMessage,
        setLeavePasswordErrorMessage,
        ownerFlowVisible,
        setOwnerFlowVisible,
        ownerPassword,
        setOwnerPassword,
        ownerPasswordError,
        setOwnerPasswordError,
        ownerPasswordErrorMessage,
        setOwnerPasswordErrorMessage,
        selectedNewOwner,
        setSelectedNewOwner,
        handleLeaveWorkspace,
        handleOwnerTransferAndLeave,
        handleOwnerDeleteWorkspace,
    };
}
