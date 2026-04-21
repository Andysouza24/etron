// Author(s): Rhys Cleary, Holly Wyatt
// Remote-adapter diagnostics and previews (no-permission, no-persistence operations).

const adapterFactory = require("@etron/data-sources-shared/adapters/adapterFactory");
const { validateFormat } = require("@etron/data-sources-shared/utils/validateFormat");
const { translateData } = require("@etron/data-sources-shared/utils/translateData");

const { resolveAndValidateAdapter } = require("./helpers");

async function testConnection(authUserId, payload) {
    const { sourceType, config, secrets } = payload;

    console.log("[testConnection] start", {
        sourceType,
        authType: config?.authType,
        endpoint: config?.endpoint,
        hasSecrets: !!secrets,
    });

    try {
        const adapter = resolveAndValidateAdapter(sourceType, { config, secrets });

        const data = await adapter.poll(config, secrets);

        // Only return a summary/preview to avoid exceeding Lambda 6MB response limit
        const preview = Array.isArray(data)
            ? data.slice(0, 5)
            : (typeof data === "object" ? { keys: Object.keys(data || {}) } : {});

        console.log("[testConnection] success", {
            sourceType,
            rowCount: Array.isArray(data) ? data.length : "N/A",
        });

        return { status: "success", message: "Connection successful", preview };
    } catch (error) {
        console.error("[testConnection] failed", { sourceType, error: error.message });
        return { status: "error", errorMessage: error.message };
    }
}

async function getRemotePreview(authUserId, payload) {
    const { sourceType, config, secrets } = payload;

    try {
        const adapter = resolveAndValidateAdapter(sourceType, { config, secrets });

        const data = await adapter.poll(config, secrets);
        const translatedData = translateData(data);

        const { valid, error } = validateFormat(translatedData);
        if (!valid) throw new Error(`Invalid data format: ${error}`);

        return translatedData.slice(0, 50);
    } catch (error) {
        return { status: "error", errorMessage: error.message };
    }
}

async function getAvailableSpreadsheets(authUserId, sourceType) {
    try {
        if (!sourceType) {
            throw new Error("Please specify a type of data source");
        }

        const adapter = adapterFactory.getAdapter(sourceType);
        if (!adapter) {
            throw new Error("The data source specified is not supported");
        }

        const sheets = await adapter.getAvailableSheets(authUserId);
        return { status: "success", data: sheets };
    } catch (error) {
        return { status: "error", errorMessage: error.message };
    }
}

module.exports = {
    testConnection,
    getRemotePreview,
    getAvailableSpreadsheets,
};
