// Author(s): Holly Wyatt
//
// Fallback navigation guard mounted at the top of the authenticated drawer
// layout. On every route change it consults the central route → permission
// map and redirects the user back to home if they cannot access the current
// screen. This catches cases where a button or link slipped past the local
// PermissionGate (or where the route is reached via deep link / back-forward
// navigation on web).
//
// Default-deny: unknown routes redirect away. See utils/routePermissions.js.

import { router, usePathname } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Portal, Snackbar } from "react-native-paper";
import { lookupRoutePermission } from "../../utils/routePermissions";
import { hasPermission } from "../../utils/permissions";

const HOME_ROUTE = "/(auth)/(drawer)/home";

const useRouteGuard = () => {
    const pathname = usePathname();
    const [snackbar, setSnackbar] = useState({ visible: false, text: "" });
    const lastCheckedRef = useRef(null);

    useEffect(() => {
        if (!pathname) return;
        if (lastCheckedRef.current === pathname) return;
        lastCheckedRef.current = pathname;

        let cancelled = false;

        (async () => {
            const { matched, permKey } = lookupRoutePermission(pathname);

            // unmapped route → fail closed. silent for the home redirect itself.
            if (!matched) {
                if (pathname === "/home" || pathname === "/") return;
                console.warn(`[useRouteGuard] unmapped route blocked: ${pathname}`);
                router.replace(HOME_ROUTE);
                if (!cancelled) {
                    setSnackbar({
                        visible: true,
                        text: "This page is not available.",
                    });
                }
                return;
            }

            // explicitly public.
            if (permKey === null) return;

            // permission required → check it.
            try {
                const allowed = await hasPermission(permKey);
                if (cancelled) return;
                if (!allowed) {
                    console.warn(`[useRouteGuard] denied (${permKey}): ${pathname}`);
                    router.replace(HOME_ROUTE);
                    setSnackbar({
                        visible: true,
                        text: "You don't have permission to view that page.",
                    });
                }
            } catch (err) {
                console.error("[useRouteGuard] permission check failed:", err);
                if (cancelled) return;
                router.replace(HOME_ROUTE);
            }
        })();

        return () => { cancelled = true; };
    }, [pathname]);

    return { snackbar, dismissSnackbar: () => setSnackbar({ visible: false, text: "" }) };
};

const RouteGuard = () => {
    const { snackbar, dismissSnackbar } = useRouteGuard();

    return (
        <Portal>
            <Snackbar
                visible={snackbar.visible}
                onDismiss={dismissSnackbar}
                duration={3000}
            >
                {snackbar.text}
            </Snackbar>
        </Portal>
    );
};

export default RouteGuard;
