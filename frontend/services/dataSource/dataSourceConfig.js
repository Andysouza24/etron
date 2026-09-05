// Payload sanitization and config/secrets normalization for data-source
// create and test-connection requests. Shared by DataSourceService so the
// create and test paths build identical backend payloads.

// Recursively drop undefined values from an object or array.
export function sanitize(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    const out = Array.isArray(obj) ? [] : {};
    Object.entries(obj).forEach(([k, v]) => {
        if (v === undefined) return; // drop undefined
        if (v && typeof v === 'object') out[k] = sanitize(v);
        else out[k] = v;
    });
    return out;
}

// Map adapter type aliases onto the backend's source-type contract.
// TODO: fix this, so it is just api
export function normalizeType(t) {
    if (!t) return t;
    const map = { 'custom-api': 'api', 'csv-file': 'csv', 'custom-ftp': 'ftp' };
    return map[t] || t;
}

// Parse a value that may be a JSON string, leaving non-strings untouched.
function parseMaybeJSON(val) {
    if (val == null) return val;
    if (typeof val !== 'string') return val;
    try { return JSON.parse(val); } catch { return val; }
}

// Build { configOut, secrets } per the backend contract for a source type.
// `includeSpecialTypes` enables the create-only branches (dashboard-raw-data
// and parent micromax/test-connection sources); the test path omits them.
export function buildConfigAndSecrets(cfg, srcType, { includeSpecialTypes = false } = {}) {
    const clone = cfg ? { ...cfg } : {};

    const authRaw = parseMaybeJSON(clone.authentication);
    // Normalize auth: allow a plain string to represent an API key.
    let auth = null;
    if (authRaw && typeof authRaw === 'object') auth = authRaw;
    else if (typeof authRaw === 'string' && authRaw.trim()) auth = { type: 'apiKey', value: authRaw.trim() };

    // Derive authType per contract (map 'apikey' -> 'apiKey', jwt variants -> 'bearer').
    const authType = (() => {
        const t = auth?.type || clone.authType;
        if (!t) return undefined; // allow no-auth
        const lc = String(t).toLowerCase();
        if (lc === 'apikey') return 'apiKey';
        if (lc === 'jwt' || lc === 'jwt bearer' || lc === 'jwt-bearer') return 'bearer';
        return String(t);
    })();

    const lcType = (srcType || '').toLowerCase();

    if (includeSpecialTypes) {
        // Dashboard raw data: simple { fileName, description } config, no secrets.
        if (lcType === 'dashboard-raw-data') {
            const fileName = clone.fileName?.trim();
            const description = clone.description?.trim();
            const configOut = sanitize({ fileName, description });
            return { configOut, secrets: {} };
        }
        // Parent connection - no config, no secrets; pipeline auto-discovers children.
        if (lcType === 'micromax-dashboard' || lcType === 'test-connection') {
            return { configOut: {}, secrets: {} };
        }
    }

    // MySQL: hostname/database in config; credentials in secrets only.
    if (lcType === 'mysql') {
        const hostname = clone.hostname || clone.host || clone.server;
        const port = clone.port != null ? String(clone.port) : '3306';
        const username = clone.username;
        const database = clone.databaseName || clone.database;

        const secrets = {};
        const user = clone.secrets?.username ?? clone.username;
        if (user != null) secrets.username = String(user);
        const pw = clone.password ?? clone.secrets?.password;
        if (pw != null) secrets.password = String(pw);

        const configOut = sanitize({ hostname, port, username, database, databaseName: database });
        return { configOut, secrets };
    }

    // FTP: hostname/port/filePath in config; credentials (+ optional key file) in secrets.
    if (lcType === 'ftp') {
        const hostname = clone.hostname || clone.host;
        const port = clone.port != null ? String(clone.port) : '21';
        const filePath = clone.filePath || clone.directory || '/';
        const configOut = sanitize({ hostname, port, filePath });

        const secrets = {};
        const user = clone.secrets?.username ?? clone.username;
        const pw = clone.secrets?.password ?? clone.password;
        const keyFile = clone.secrets?.keyFile ?? clone.keyFile;
        if (user != null) secrets.username = String(user);
        if (pw != null) secrets.password = String(pw);
        if (keyFile != null) secrets.keyFile = String(keyFile);
        return { configOut, secrets };
    }

    // Default API-like case. endpoint is optional in the contract.
    const endpoint = clone.endpoint ?? clone.url ?? '';

    const secrets = {};
    switch ((authType || '').toLowerCase()) {
        case 'apikey': {
            // Use the provided authentication value as the apiKey; do not infer from URL.
            const apiKeyValue = (auth && auth.value != null)
                ? auth.value
                : (typeof authRaw === 'string' && authRaw.trim())
                    ? authRaw.trim()
                    : (clone.apiKey ?? clone.secrets?.apiKey);
            if (apiKeyValue != null) secrets.apiKey = String(apiKeyValue);
            break;
        }
        case 'bearer': {
            if (auth?.token != null) secrets.token = String(auth.token);
            else if (clone.token != null) secrets.token = String(clone.token);
            else if (clone.secrets?.token != null) secrets.token = String(clone.secrets.token);
            break;
        }
        case 'basic': {
            if (auth?.username != null) secrets.username = String(auth.username);
            if (auth?.password != null) secrets.password = String(auth.password);
            if (clone.username != null) secrets.username = String(clone.username);
            if (clone.password != null) secrets.password = String(clone.password);
            if (clone.secrets?.username != null) secrets.username = String(clone.secrets.username);
            if (clone.secrets?.password != null) secrets.password = String(clone.secrets.password);
            break;
        }
        case 'query': {
            if (auth?.value != null) secrets.token = String(auth.value);
            else if (clone.secrets?.token != null) secrets.token = String(clone.secrets.token);
            break;
        }
        default: {
            // No secrets
        }
    }
    const configOut = sanitize({ authType, endpoint });
    return { configOut, secrets };
}
