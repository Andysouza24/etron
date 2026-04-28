// Author(s): Rhys Cleary
const customApiAdapter = require("./customApiAdapter");
const ftpAdapter = require("./ftpAdapter");
const mysqlAdapter = require("./mysqlAdapter");
const localCsvAdapter = require("./localCsvAdapter");
const micromaxDashboardAdapter = require("./micromaxDashboardAdapter");
const micromaxDashboardFileAdapter = require("./micromaxDashboardFileAdapter");

const adapters = {
    "api": customApiAdapter,
    "ftp": ftpAdapter,
    "mysql": mysqlAdapter,
    "local-csv": localCsvAdapter,
    "micromax-dashboard": micromaxDashboardAdapter,
    "micromax-dashboard-file": micromaxDashboardFileAdapter,
    
};

function getAdapter(type) {
    const adapter = adapters[type];
    if (!adapter) throw new Error(`Unknown adapter type: ${type}`);
    
    // enforce implementation
    if (typeof adapter.validateConfig !== "function") {
        throw new Error(`Adapter ${type} must implement validateConfig(config)`);
    }
    if (typeof adapter.validateSecrets !== "function") {
        throw new Error(`Adapter ${type} must implement validateSecrets(secrets)`);
    }
    if (typeof adapter.supportsPolling !== "boolean") {
        throw new Error(`Adapter ${type} must export supportsPolling`);
    }
    if (adapter.supportsPolling) {
        if (typeof adapter.poll !== "function") {
            throw new Error(`Adapter ${type} must implement poll(config, secrets)`);
        }
    }

    return adapter;
}

function getAllowedPollingTypes() {
    return Object.entries(adapters)
        .filter(([_, value]) => value.supportsPolling)
        .map(([key]) => key);
}

module.exports = {
    getAdapter,
    getAllowedPollingTypes
};