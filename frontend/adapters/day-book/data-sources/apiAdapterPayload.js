// maps the loose Custom API form payload onto the backend's { sourceType, config, secrets } contract 
// used by /test-connection, /remote (with pendingSetup) and /{id}/preview-schema

const SOURCE_TYPE = "api";

const parseMaybeJson = (value) => {
    if (value == null || typeof value !== "string" || !value.trim()) return null;
    try {
        return JSON.parse(value);
    } catch {
        return { type: "apiKey", value: value.trim() };
    }
};

const normaliseAuthType = (rawType) => {
    if (!rawType) return undefined;
    const lc = String(rawType).toLowerCase();
    if (lc === "apikey") return "apiKey";
    if (lc === "jwt" || lc === "bearer" || lc === "jwt-bearer") return "bearer";
    if (lc === "basic") return "basic";
    return rawType;
};

const buildSecrets = (lc, source, auth) => {
    const secrets = {};
    switch (lc) {
        case "apikey": {
            const v = auth?.value ?? source.apiKey ?? source.secrets?.apiKey;
            if (v != null) secrets.apiKey = String(v);
            break;
        }
        case "bearer":
        case "jwt": {
            const t = auth?.token ?? source.token ?? source.secrets?.token;
            if (t != null) secrets.token = String(t);
            break;
        }
        case "basic": {
            const u = auth?.username ?? source.username ?? source.secrets?.username;
            const p = auth?.password ?? source.password ?? source.secrets?.password;
            if (u != null) secrets.username = String(u);
            if (p != null) secrets.password = String(p);
            break;
        }
        default:
            break;
    }
    return Object.keys(secrets).length ? secrets : undefined;
};

// returns { sourceType, config, secrets } ready to send to the backend
// pass an object built by buildApiConnectionData (or any equivalent shape)
export const buildApiBackendPayload = (connectionData = {}) => {
    const auth = parseMaybeJson(connectionData.authentication);
    const rawType = auth?.type || connectionData.authType || null;
    const lc = rawType ? String(rawType).toLowerCase() : null;
    const authType = normaliseAuthType(rawType);

    const endpoint = connectionData.endpoint ?? connectionData.url;
    const config = { authType, endpoint };
    const secrets = buildSecrets(lc, connectionData, auth);

    return { sourceType: SOURCE_TYPE, config, secrets };
};

export const API_SOURCE_TYPE = SOURCE_TYPE;
