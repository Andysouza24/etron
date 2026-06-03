import { getCachedPermissions, getCachedIsOwner } from "../storage/permissionsStorage";

export async function hasPermission(requiredPermissions) {
    try {
        // Owners bypass permission checks entirely.
        const isOwner = await getCachedIsOwner();
        if (isOwner) return true;

        const userPermissions = await getCachedPermissions();
        if (!userPermissions) return false;

        const requiredList = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];

        // if the user has everything that's required return true
        return requiredList.every(perm => userPermissions.includes(perm));
        
    } catch (error) {
        console.error("Error checking permissions:", error);
        return false;
    }
}