// Author(s): Rhys Cleary, Holly Wyatt

import { getCachedPermissions, getCachedIsOwner } from "../storage/permissionsStorage";

export async function hasPermission(requiredPermissions) {
    try {
        // if owner return true
        const isOwner = await getCachedIsOwner();
        if (isOwner) return true;

        // get cached permissions
        const userPermissions = await getCachedPermissions();
        if (!userPermissions) return false;

        // permission array
        const requiredList = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];

        // if the user has everything that's required return true
        return requiredList.every(perm => userPermissions.includes(perm));
        
    } catch (error) {
        console.error("Error checking permissions:", error);
        return false;
    }
}