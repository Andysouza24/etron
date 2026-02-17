import { useState, useEffect } from "react";
import { hasPermission } from "../utils/permissions";

export function useHasPermission(permissions) {
    const [allowed, setAllowed] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;

        (async () => {
            setLoading(true);
            try {
                if (!permissions) {
                    console.log("[useHasPermission] No permissions required, allowing");
                    setAllowed(true);
                } else {
                    console.log("[useHasPermission] Checking:", permissions);
                    const result = await hasPermission(permissions);
                    console.log("[useHasPermission]", permissions, "->", result);
                    if (!cancelled) setAllowed(result);
                } 
            } catch (error) {
                console.error("[useHasPermission] Error checking permissions:", error);
                if (!cancelled) setAllowed(false);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }) ();

        return () => { cancelled = true; }
    }, [permissions]);

    return { allowed, loading };
}