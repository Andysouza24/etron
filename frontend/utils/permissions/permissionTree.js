// helpers for the role editor

// flatten and walk the permission tree returned by the backend with hierarchical support
// a parent permission implicitly grants its descendants
export function normalizePermissionKeys(list) {
    if (!Array.isArray(list)) return [];
    const keys = list
        .map((entry) => {
            if (!entry) return null;
            if (typeof entry === "string") return entry;
            if (typeof entry === "object") {
                if (typeof entry.key === "string") return entry.key;
                if (typeof entry.permission === "string") return entry.permission;
            }
            return null;
        })
        .filter(Boolean);

    return Array.from(new Set(keys));
}

function mapPermission(raw) {
    return {
        key: raw.key,
        label: raw.label || raw.key,
        description: raw.description || "",
        defaultStatus: !!raw.defaultStatus,
        children: Array.isArray(raw.children) ? raw.children.map(mapPermission) : [],
    };
}

// Flatten the app/modules tree into an array of category groups
// Each permission keeps its nested children array intact for hierarchical UI rendering
export function buildPermissionGroups(tree) {
    const groups = [];

    if (tree?.app?.categories) {
        for (const [key, category] of Object.entries(tree.app.categories)) {
            groups.push({
                section: tree.app.label,
                categoryKey: key,
                categoryLabel: category.label || key,
                permissions: (category.permissions || []).map(mapPermission),
            });
        }
    }

    if (tree?.modules?.daybook?.categories) {
        const daybookLabel = tree.modules.daybook.label || "Day Book";
        for (const [key, category] of Object.entries(tree.modules.daybook.categories)) {
            groups.push({
                section: daybookLabel,
                categoryKey: `daybook.${key}`,
                categoryLabel: category.label || key,
                permissions: (category.permissions || []).map(mapPermission),
            });
        }
    }

    return groups;
}

// Recursively collect every descendant key excluding the node
export function collectDescendantKeys(permission) {
    const out = [];
    if (!permission?.children?.length) return out;
    for (const child of permission.children) {
        out.push(child.key);
        out.push(...collectDescendantKeys(child));
    }
    return out;
}

// Flatten every permission + descendants in a list into a single array
export function flattenPermissions(permissions) {
    const out = [];
    const walk = (list) => {
        for (const p of list) {
            out.push(p);
            if (p.children?.length) walk(p.children);
        }
    };
    walk(permissions || []);
    return out;
}
