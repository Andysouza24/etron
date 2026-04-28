// adapter for the "micromax-dashboard-file" data source type

const parentAdapter = require("./micromaxDashboardAdapter");

const SOURCE_TYPE = "micromax-dashboard-file";

function validateConfig(config) {
    if (!config || typeof config !== "object") {
        return { valid: false, error: "config is required" };
    }
    if (!config.fileName || typeof config.fileName !== "string") {
        return { valid: false, error: "config.fileName is required" };
    }
    if (!parentAdapter.FILE_NAME_PATTERN.test(config.fileName)) {
        return { valid: false, error: "config.fileName must be a flat .json filename" };
    }
    if (!config.parentDataSourceId || typeof config.parentDataSourceId !== "string") {
        return { valid: false, error: "config.parentDataSourceId is required" };
    }
    return { valid: true };
}

function validateSecrets() {
    return { valid: true };
}

module.exports = {
    SOURCE_TYPE,
    PARENT_SOURCE_TYPE: parentAdapter.SOURCE_TYPE,
    EXPORT_PREFIX: parentAdapter.EXPORT_PREFIX,
    FILE_NAME_PATTERN: parentAdapter.FILE_NAME_PATTERN,
    validateConfig,
    validateSecrets,
    supportsPolling: false,
    buildObjectKey: parentAdapter.buildObjectKey,
    parseObjectKey: parentAdapter.parseObjectKey,
};
