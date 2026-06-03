import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import { apiGet } from "../utils/api/apiClient";
import endpoints from "../utils/api/endpoints";
import {
    savePermissionsCache,
    getCachedVersion,
    clearPermissionsCache
} from "../storage/permissionsStorage";


const  CHECK_COOLDOWN_MS = 60_000;
let lastCheckTime = 0;

// Custom hook to sync permissions on app focus and workspace switch
export function usePermissionSync(workspaceId) {
    const appStateRef = useRef(AppState.currentState);
    const isCheckingRef = useRef(false);
    const prevWorkspaceRef = useRef(workspaceId);
    const initializedRef = useRef(false);

    const checkAndRefresh = useCallback(async (force = false) => {
        if (!workspaceId) return;
        if (isCheckingRef.current) return;

        const now = Date.now();
        if (!force && (now - lastCheckTime) < CHECK_COOLDOWN_MS) return;

        isCheckingRef.current = true;
        lastCheckTime = now;


        try {
            // lightweight version check
            const versionResponse = await apiGet(endpoints.workspace.core.getPermissionsVersion(workspaceId));
            const remote = versionResponse?.data;

            // compare with local cache
            const localVersion = await getCachedVersion();
            if (remote?.version === localVersion) return;

            // version mismatch -> full fetch
            const fullResponse = await apiGet(endpoints.workspace.core.getEffectivePermissions(workspaceId));
            const full = fullResponse?.data;
            if (!full) return;

            // update local cache
            await savePermissionsCache({
                permissions: full.permissions,
                isOwner: full.isOwner,
                version: full.version,
                hideGatedComponents: full.hideGatedComponents === true
            });

        } catch (error) {
            console.warn("[PermissionSync] Sync failed: ", error.message);
        } finally {
            isCheckingRef.current = false;
        }
    }, [workspaceId]);


    // trigger on screen focus
    useFocusEffect(
        useCallback(() => {
            checkAndRefresh();
        }, [checkAndRefresh])
    );

    // trigger when app returns to foreground
    useEffect(() => {
        const sub = AppState.addEventListener("change", (nextState) => {
            if ( appStateRef.current.match(/inactive|background/) && nextState === "active" ) {
                checkAndRefresh();
            }
            appStateRef.current = nextState;
        });
        return () => sub?.remove();
    }, [checkAndRefresh]);

    // focus refresh on workspace switch, not initial mount
    useEffect(() => {
        if (!workspaceId) return;
        if (!initializedRef.current) {
            initializedRef.current = true;
            prevWorkspaceRef.current = workspaceId;
            return; // cache was just seeded
        }
        if (workspaceId !== prevWorkspaceRef.current) {
            prevWorkspaceRef.current = workspaceId;
            clearPermissionsCache().then(() => checkAndRefresh(true));
        }
    }, [workspaceId, checkAndRefresh]);

    return { forceRefresh: () => checkAndRefresh(true) };

}
