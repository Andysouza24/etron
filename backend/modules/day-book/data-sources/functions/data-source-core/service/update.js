// Author(s): Rhys Cleary, Holly Wyatt
// Data source update: dispatcher + metadata + column display settings.

const dataSourceRepo = require("@etron/day-book-shared/repositories/dataSourceRepository");
const dataSourceSecretsRepo = require("@etron/data-sources-shared/repositories/dataSourceSecretsRepository");
const { getDataSchema, saveSchema } = require("@etron/data-sources-shared/repositories/dataBucketRepository");
const { validateWorkspaceId } = require("@etron/shared/utils/validation");
const { notifyDataSourceUpdate } = require("@etron/day-book-shared/utils/notifyDataSourceUpdate");

const {
    PERMISSIONS,
    requirePermission,
    requireEnabled,
    resolveAndValidateAdapter,
    auditDataSource,
} = require("./helpers");

// Routes to the appropriate handler based on payload shape.
// A display-settings-only update requires MANAGE_COLUMN_DISPLAY_SETTINGS;
// any other update requires MANAGE_DATASOURCES.
async function updateDataSourceInWorkspace(authUserId, dataSourceId, payload) {
    const { workspaceId, name, method, expiry, config, secrets, settings } = payload;
    await validateWorkspaceId(workspaceId);

    const hasMetadataChanges = !!(name || method || expiry || config || secrets);
    const hasDisplaySettings = !!settings?.displaySettings?.columnDisplaySettings;

    let updated = null;

    if (hasMetadataChanges) {
        updated = await updateDataSourceMetadata(authUserId, dataSourceId, {
            workspaceId, name, method, expiry, config, secrets,
        });
    }

    if (hasDisplaySettings) {
        updated = await updateColumnDisplaySettings(authUserId, dataSourceId, {
            workspaceId,
            columnDisplaySettings: settings.displaySettings.columnDisplaySettings,
            existing: updated,
        });
    }

    if (!updated) {
        // nothing actionable in the payload — load current state so callers get a consistent shape
        updated = await dataSourceRepo.getDataSourceById(workspaceId, dataSourceId);
        if (!updated) throw new Error("The data source does not exist");
    }

    await notifyDataSourceUpdate(updated, "UPDATE");

    return { ...updated, secrets };
}

async function updateDataSourceMetadata(authUserId, dataSourceId, { workspaceId, name, method, expiry, config, secrets }) {
    await requirePermission(authUserId, workspaceId, PERMISSIONS.MANAGE_DATASOURCES);

    const dataSource = await dataSourceRepo.getDataSourceById(workspaceId, dataSourceId);
    if (!dataSource) {
        throw new Error("The data source does not exist");
    }
    requireEnabled(dataSource);

    if (method && !["overwrite", "extend", "append-new"].includes(method)) {
        throw new Error("Please specify the method 'overwrite', 'extend' or 'append-new'");
    }
    if (method === "extend" && expiry && typeof expiry !== "object") {
        throw new Error("Expiry is not in the correct format");
    }

    resolveAndValidateAdapter(dataSource.sourceType, {
        config,
        secrets,
        requireConfig: false,
        requireSecrets: false,
    });

    const updatedDataSource = await dataSourceRepo.updateDataSource(workspaceId, dataSourceId, {
        name, method, expiry, config,
    });

    if (secrets) {
        await dataSourceSecretsRepo.saveSecrets(workspaceId, dataSourceId, secrets);
    }

    await auditDataSource({
        action: "Updated",
        filter: "updated",
        workspaceId,
        userId: authUserId,
        dataSourceId,
        name: updatedDataSource.name,
    });

    return updatedDataSource;
}

// Applies display-only column flags (e.g. currency symbol visibility) to the schema.
// The schema is saved directly without rebuilding the Athena table because these flags
// are never structural.
async function updateColumnDisplaySettings(authUserId, dataSourceId, { workspaceId, columnDisplaySettings, existing }) {
    await requirePermission(authUserId, workspaceId, PERMISSIONS.MANAGE_COLUMN_DISPLAY_SETTINGS);

    const dataSource = existing || await dataSourceRepo.getDataSourceById(workspaceId, dataSourceId);
    if (!dataSource) {
        throw new Error("The data source does not exist");
    }
    requireEnabled(dataSource);

    const existingSchema = await getDataSchema(workspaceId, dataSourceId);
    if (Array.isArray(existingSchema) && existingSchema.length > 0) {
        let changed = false;
        const updatedSchema = existingSchema.map(col => {
            const update = columnDisplaySettings[col.name];
            if (!update) return col;
            const next = { ...col };
            if (typeof update.displayCurrencySymbol === "boolean") {
                next.displayCurrencySymbol = update.displayCurrencySymbol;
                changed = true;
            }
            return next;
        });
        if (changed) {
            await saveSchema(workspaceId, dataSourceId, updatedSchema);
        }
    }

    await auditDataSource({
        action: "Updated",
        filter: "updated",
        workspaceId,
        userId: authUserId,
        dataSourceId,
        name: dataSource.name,
    });

    return dataSource;
}

module.exports = {
    updateDataSourceInWorkspace,
};
