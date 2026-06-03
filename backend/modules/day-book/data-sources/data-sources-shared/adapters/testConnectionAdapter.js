// parent adapter for the temporary "test-connection" data source type
// mirrors micromax-dashboard but reads from `test-exports/` instead of `exports/`
// every JSON file delivered to `test-exports/<fileName>.json` is a separate child data source of type test-connection-file

const SOURCE_TYPE = "test-connection";
const EXPORT_PREFIX = "test-exports/";

// allow only safe filenames inside `test-exports/` (no nested folders, no traversal).
const FILE_NAME_PATTERN = /^[A-Za-z0-9._-]+\.json$/;

function buildObjectKey(fileName) {
    if (!fileName || !FILE_NAME_PATTERN.test(fileName)) {
        throw new Error("fileName must match /^[A-Za-z0-9._-]+\\.json$/");
    }
    return `${EXPORT_PREFIX}${fileName}`;
}

// extracts the filename from an S3 key like `test-exports/foo.json`.
// returns null when the key isn't under the test-exports prefix or is nested.
function parseObjectKey(key) {
    if (!key || !key.startsWith(EXPORT_PREFIX)) return null;
    const fileName = key.slice(EXPORT_PREFIX.length);
    if (!fileName || fileName.includes("/")) return null;
    if (!FILE_NAME_PATTERN.test(fileName)) return null;
    return { fileName };
}

function validateConfig(config) {
    if (config && typeof config !== "object") {
        return { valid: false, error: "Config must be an object" };
    }
    return { valid: true };
}

function validateSecrets() {
    return { valid: true };
}

module.exports = {
    SOURCE_TYPE,
    EXPORT_PREFIX,
    FILE_NAME_PATTERN,
    validateConfig,
    validateSecrets,
    supportsPolling: false,
    buildObjectKey,
    parseObjectKey,
};
