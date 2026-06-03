import { useState, useEffect, useRef } from "react";
import { hasPermission } from "../utils/permissions";

// helps identify which screen/component made the permission check in logs
function getCallerLocation() {
    const err = new Error();
    if (!err.stack) return "unknown";
    const lines = err.stack.split("\n");
    for (const line of lines) {
        if (!line.includes("useHasPermission")
            && (line.includes(".jsx") || line.includes(".js"))) {
            const match = line.match(/[\w./-]+\.(?:jsx?|tsx?)(?::\d+)?/);
            if (match) return match[0];
        }
    }
    return "unknown";
}

export function useHasPermission(permissions) {
    const [allowed, setAllowed] = useState(false);
    const [loading, setLoading] = useState(true);
    const callerRef = useRef(null);
    if (callerRef.current === null) callerRef.current = getCallerLocation();
    const caller = callerRef.current;

    useEffect(() => {
        let cancelled = false;

        (async () => {
            setLoading(true);
            try {
                if (!permissions) {
                    console.log(`[useHasPermission] (${caller}) No permissions required, allowing`);
                    setAllowed(true);
                } else {
                    console.log(`[useHasPermission] (${caller}) Checking:`, permissions);
                    const result = await hasPermission(permissions);
                    console.log(`[useHasPermission] (${caller})`, permissions, "->", result);
                    if (!cancelled) setAllowed(result);
                }
            } catch (error) {
                console.error(`[useHasPermission] (${caller}) Error checking permissions:`, error);
                if (!cancelled) setAllowed(false);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => { cancelled = true; }
    }, [permissions, caller]);

    return { allowed, loading };
}