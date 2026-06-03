// Author(s): Noah Bradley

import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { getCachedHideGatedComponents, getHideGatedSync, subscribePermissionCache } from "../storage/permissionsStorage";

// returns the current role's "hide permission-gated components" flag.
// when true, callers should fully omit components the user can't access
// instead of dimming or disabling them.
export function useHidePermissionGated() {
    // seed from the synchronous mirror so first render is already correct
    // and we avoid a one-frame flash of disabled-but-visible components.
    const [hide, setHide] = useState(() => getHideGatedSync());

    const refresh = useCallback(async () => {
        try {
            const next = await getCachedHideGatedComponents();
            setHide(next);
        } catch (error) {
            console.warn("[useHidePermissionGated] refresh failed:", error);
            setHide(false);
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    // permission sync may rewrite the cache while the screen is open
    // (e.g. another admin updated this role); pick the new value up on
    // focus and when the app returns to the foreground.
    useFocusEffect(
        useCallback(() => {
            refresh();
        }, [refresh])
    );

    useEffect(() => {
        const sub = AppState.addEventListener("change", (state) => {
            if (state === "active") refresh();
        });
        return () => sub?.remove();
    }, [refresh]);

    // re-read whenever the permissions cache is rewritten elsewhere
    // (e.g. usePermissionSync just fetched a new effective payload).
    useEffect(() => {
        const unsubscribe = subscribePermissionCache(refresh);
        return () => unsubscribe();
    }, [refresh]);

    return hide;
}

export default useHidePermissionGated;
