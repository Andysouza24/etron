// Default-deny route → permission map consumed by the RouteGuard.
// Unlisted routes are forbidden; use `null` for screens open to all members.
// Dynamic segments fall back to longest-prefix match automatically.

export const ROUTE_PERMISSIONS = {
    // --- top-level drawer ---
    "home": null,
    "settings": null,
    "account-settings": null,

    // --- boards ---
    "boards": "app.workspace.view_boards",
    "boards/create": "app.workspace.manage_boards",

    // --- workspace settings (nested under /settings/workspace/) ---
    "settings/workspace/workspace-settings": "app.workspace.view_workspace_settings",
    "settings/workspace/view-workspace-details": "app.workspace.view_workspace_settings",
    "settings/workspace/edit-workspace-details": "app.workspace.update_workspace",
    "settings/workspace/add-modules": "app.workspace.manage_modules",
    "settings/workspace/module-management": "app.workspace.manage_modules",
    "settings/workspace/board-management": "app.workspace.manage_boards",
    "settings/workspace/board-settings": "app.workspace.manage_boards",

    // --- collaboration ---
    "collaboration": "app.workspace.view_collaboration_settings",
    "collaboration/roles": "app.collaboration.view_roles",
    "collaboration/view-role": "app.collaboration.view_roles",
    "collaboration/create-role": "app.collaboration.manage_roles",
    "collaboration/edit-role": "app.collaboration.manage_roles",
    "collaboration/users": "app.collaboration.view_users",
    "collaboration/view-user": "app.collaboration.view_users",
    "collaboration/edit-user": "app.collaboration.manage_users",
    "collaboration/invites": "app.collaboration.view_invites",
    "collaboration/invite-user": "app.collaboration.invite_user",
    "collaboration/workspace-log": "app.audit.view_workspace_audit_log",
    "collaboration/user-log": "app.audit.view_user_audit_log",

    // --- notifications (drawer-level inbox) ---
    "notifications": "app.notifications.view_notifications",
    "notifications/create": "app.notifications.manage_notifications",

    // --- day-book / reports ---
    "modules/day-book/reports": "modules.daybook.reports.view_reports",
    "modules/day-book/reports/reports": "modules.daybook.reports.view_reports",
    "modules/day-book/reports/metric-selection": "modules.daybook.reports.view_reports",
    "modules/day-book/reports/view-metrics": "modules.daybook.reports.view_reports",
    "modules/day-book/reports/create-report": "modules.daybook.reports.manage_drafts",
    "modules/day-book/reports/edit-report": "modules.daybook.reports.manage_drafts",
    "modules/day-book/reports/templates": "modules.daybook.reports.manage_templates",
    "modules/day-book/reports/edit-template": "modules.daybook.reports.manage_templates",
    "modules/day-book/reports/exports": "modules.daybook.reports.view_exports",
    "modules/day-book/reports/export-metric": "modules.daybook.reports.manage_exports",

    // --- day-book / data management ---
    "modules/day-book/data-management": "modules.daybook.datasources.view_dataSources",
    "modules/day-book/data-management/view-data-source": "modules.daybook.datasources.view_data",
    "modules/day-book/data-management/create-data-connection": "modules.daybook.datasources.manage_dataSources",
    "modules/day-book/data-management/update-data-connection": "modules.daybook.datasources.manage_dataSources",
    "modules/day-book/data-management/data-connection-inputs": "modules.daybook.datasources.manage_dataSources",
    "modules/day-book/data-management/edit-data-source": "modules.daybook.datasources.manage_dataSources",
    "modules/day-book/data-management/revise-schema": "modules.daybook.datasources.manage_dataSources",
    "modules/day-book/data-management/micromax-dashboard-settings": "modules.daybook.datasources.manage_dataSources",

    // --- day-book / metrics ---
    "modules/day-book/metrics": "modules.daybook.metrics.view_metrics",
    "modules/day-book/metrics/view-metric": "modules.daybook.metrics.view_metrics",
    "modules/day-book/metrics/create-metric": "modules.daybook.metrics.manage_metrics",
    "modules/day-book/metrics/edit-metric": "modules.daybook.metrics.manage_metrics",

    // --- day-book / notifications (per-metric alerting) ---
    "modules/day-book/notifications": "app.notifications.view_notifications",
    "modules/day-book/notifications/view-notification": "app.notifications.view_notifications",
    "modules/day-book/notifications/create-notification": "app.notifications.manage_notifications",
    "modules/day-book/notifications/edit-notification": "app.notifications.manage_notifications",
};

// strips group segments like "(auth)" and "(drawer)" plus the leading slash
// so the result can be matched directly against ROUTE_PERMISSIONS keys.
function normalisePath(pathname) {
    if (!pathname || typeof pathname !== "string") return "";
    return pathname
        .split("/")
        .filter((segment) => segment && !(segment.startsWith("(") && segment.endsWith(")")))
        .join("/");
}

// performs longest-prefix lookup against the map. returns
//   { matched: true, permKey: string | null }  → explicitly mapped
//   { matched: false, permKey: null }          → unknown route (default-deny)
export function lookupRoutePermission(pathname) {
    const normalised = normalisePath(pathname);
    if (!normalised) return { matched: true, permKey: null };

    let candidate = normalised;
    while (candidate.length > 0) {
        if (Object.prototype.hasOwnProperty.call(ROUTE_PERMISSIONS, candidate)) {
            return { matched: true, permKey: ROUTE_PERMISSIONS[candidate] };
        }
        const idx = candidate.lastIndexOf("/");
        if (idx === -1) break;
        candidate = candidate.slice(0, idx);
    }
    return { matched: false, permKey: null };
}

// convenience for navigation call sites that hold an expo-router path like
// "/(auth)/(drawer)/modules/day-book/reports" and just need the permission.
// returns the permission string, or null if the route is mapped as public,
// or undefined if the route is not in the map (caller should treat as denied).
export function getPermissionForRoute(route) {
    const { matched, permKey } = lookupRoutePermission(route);
    if (!matched) return undefined;
    return permKey;
}
