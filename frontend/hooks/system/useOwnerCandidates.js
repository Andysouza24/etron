import { useState, useEffect } from 'react';
import { getCurrentUser } from 'aws-amplify/auth';
import { apiGet } from '../../utils/api/apiClient';
import endpoints from '../../utils/api/endpoints';
import { getWorkspaceId } from '../../storage/workspaceStorage';
import { getCachedIsOwner } from '../../storage/permissionsStorage';

// Loads workspace owner state plus the ownership-transfer candidates: the other
// workspace users (excluding the current user) and the assignable non-owner
// roles. Only fetches the lists when the current user is the owner. Shared by
// account-settings and workspace-settings, whose transfer flows otherwise differ.
export default function useOwnerCandidates() {
    const [isOwner, setIsOwner] = useState(false);
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);

    useEffect(() => {
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
            }
        })();
    }, []);

    return { isOwner, users, roles };
}
