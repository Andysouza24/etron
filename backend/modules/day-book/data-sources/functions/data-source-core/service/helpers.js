// Author(s): Rhys Cleary, Holly Wyatt
// Shared helpers for the data-source-core service split.

const adapterFactory = require("@etron/data-sources-shared/adapters/adapterFactory");
const { hasPermission } = require("@etron/shared/utils/permissions");
const { logAuditEvent } = require("@etron/shared/utils/auditLogger");

const PERMISSIONS = {
    VIEW_DATASOURCES: "modules.daybook.datasources.view_dataSources",
    MANAGE_DATASOURCES: "modules.daybook.datasources.manage_dataSources",
    VIEW_DATA: "modules.daybook.datasources.view_data",
    MANAGE_COLUMN_DISPLAY_SETTINGS: "modules.daybook.datasources.manage_column_display_settings",
    VIEW_METRICS: "modules.daybook.metrics.view_metrics"
};

async function requirePermission(authUserId, workspaceId, permissionKey) {
    const allowed = await hasPermission(authUserId, workspaceId, permissionKey);
    if (!allowed) {
        throw new Error("User does not have permission to perform action");
    }
}

// Allow access when the caller holds any one of the supplied permission keys.
// Used by endpoints that serve multiple roles (e.g. viewing metric data is
// available to both data-source viewers and metric viewers).
async function requireAnyPermission(authUserId, workspaceId, permissionKeys) {
    for (const key of permissionKeys) {
        // eslint-disable-next-line no-await-in-loop
        if (await hasPermission(authUserId, workspaceId, key)) return;
    }
    throw new Error("User does not have permission to perform action");
}

// Blocks user-initiated mutations and data access when a data source has been
// disabled. The data source continues to ingest data in the background via the
// polling lambda / SQS transforms, but every API entry point that a user can
// reach should call this before doing anything else.
function requireEnabled(dataSource) {
    if (!dataSource) return;
    if (dataSource.enabled === false) {
        throw new Error("This data source is disabled. Re-enable it to perform this action.");
    }
}

// Resolves adapter and validates config/secrets in one pass.
// `config` and `secrets` are each validated only if provided, to support partial updates.
function resolveAndValidateAdapter(sourceType, { config, secrets, requireConfig = true, requireSecrets = true } = {}) {
    if (!sourceType) {
        throw new Error("Please specify a type of data source");
    }

    const adapter = adapterFactory.getAdapter(sourceType);
    if (!adapter) {
        throw new Error("The data type sent is not supported");
    }

    if (config || requireConfig) {
        const configValidation = adapter.validateConfig(config);
        if (!configValidation.valid) {
            throw new Error(configValidation.error);
        }
    }

    if (secrets || requireSecrets) {
        const secretsValidation = adapter.validateSecrets(secrets, config?.authType);
        if (!secretsValidation.valid) {
            throw new Error(secretsValidation.error);
        }
    }

    return adapter;
}

async function auditDataSource({ action, filter, workspaceId, userId, dataSourceId, name }) {
    await logAuditEvent({
        workspaceId,
        userId,
        action,
        filters: ["modules", filter],
        module: "daybook",
        itemType: "dataSource",
        itemId: dataSourceId,
        itemName: name
    });
}

function sanitiseIdentifier(name) {
    return name.replace(/[^A-Za-z0-9_]/g, "_");
}

module.exports = {
    PERMISSIONS,
    requirePermission,
    requireAnyPermission,
    requireEnabled,
    resolveAndValidateAdapter,
    auditDataSource,
    sanitiseIdentifier,
};
