// Authenticated HTTP client wrapping axios with Amplify session tokens.
// Exposes named verb helpers (apiGet/apiPost/…) and an axios-like default object.
// All calls auto-retry once on 401/403 after force-refreshing the session.

import { fetchAuthSession } from 'aws-amplify/auth';
import axios from 'axios';

// Optional handler invoked when auth cannot be recovered.
// Registered by the auth layout to sign the user out and bounce to /landing.
let unauthorizedHandler = null;
let unauthorizedInFlight = false;

export function setUnauthorizedHandler(fn) {
    unauthorizedHandler = typeof fn === 'function' ? fn : null;
}

function triggerUnauthorized(reason) {
    if (!unauthorizedHandler || unauthorizedInFlight) return;
    unauthorizedInFlight = true;
    try {
        Promise.resolve(unauthorizedHandler(reason))
            .catch((e) => console.error('[apiClient] unauthorized handler failed:', e))
            .finally(() => { unauthorizedInFlight = false; });
    } catch (e) {
        console.error('[apiClient] unauthorized handler threw:', e);
        unauthorizedInFlight = false;
    }
}

async function getHeaders({ forceRefresh = false } = {}) {
    const session = await fetchAuthSession(forceRefresh ? { forceRefresh: true } : undefined);
    const idToken = session?.tokens?.idToken?.toString();
    if (!idToken) {
        const err = new Error('No auth token available');
        err.status = 401;
        throw err;
    }
    return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
    };
}

function isAuthError(err) {
    const status = err?.response?.status ?? err?.status;
    return status === 401 || status === 403;
}

// Runs an axios call with an automatic single retry on 401/403:
//   1. attempt with current cached token
//   2. on auth error, force-refresh the Amplify session and retry once
//   3. if still failing or the refresh itself fails, trigger the
//      unauthorized handler (sign out + redirect) and surface the error
async function executeAuthed(buildConfig) {
    let headers;
    try {
        headers = await getHeaders();
    } catch (err) {
        if (isAuthError(err)) triggerUnauthorized('no-session');
        throw err;
    }

    try {
        return await axios(buildConfig(headers));
    } catch (err) {
        if (!isAuthError(err)) throw err;

        let refreshedHeaders;
        try {
            refreshedHeaders = await getHeaders({ forceRefresh: true });
        } catch (refreshErr) {
            triggerUnauthorized('refresh-failed');
            throw err;
        }

        try {
            return await axios(buildConfig(refreshedHeaders));
        } catch (retryErr) {
            if (isAuthError(retryErr)) triggerUnauthorized('retry-401');
            throw retryErr;
        }
    }
}

async function request(method, path, body = {}, params = {}, config = {}) {
    const buildConfig = (baseHeaders) => {
        const mergedHeaders = { ...baseHeaders, ...(config.headers || {}) };
        const requestConfig = {
            method,
            url: path,
            headers: mergedHeaders,
            params: config.params || params,
            timeout: config.timeout,
        };
        if (["post", "put", "patch"].includes(String(method).toLowerCase())) {
            requestConfig.data = body;
        }
        return requestConfig;
    };
    try {
        return await executeAuthed(buildConfig);
    } catch (error) {
        if (error.response) {
            throw new Error(
                `Server error ${error.response.status}: ${JSON.stringify(error.response.data)}`
            );
        }
        throw new Error(error.message);
    }
}

export async function apiPost(path, body = {}, params = {}) {
    return request('post', path, body, params);
}

export async function apiGet(path, params = {}) {
    return request('get', path, {}, params);
}

export async function apiPut(path, body = {}) {
    return request('put', path, body, {});
}

export async function apiPatch(path, body = {}) {
    return request('patch', path, body, {});
}

export async function apiDelete(path, params = {}) {
    return request('delete', path, {}, params);
}

// Shared request runner for the object-style client below.
// Only post/put/patch carry a body, so `data` is omitted for get/delete.
async function clientRequest(method, url, { data, config = {} } = {}) {
    const resp = await executeAuthed((baseHeaders) => {
        const requestConfig = {
            method,
            url,
            headers: { ...baseHeaders, ...(config.headers || {}) },
            params: config.params,
            timeout: config.timeout,
        };
        if (data !== undefined) requestConfig.data = data;
        return requestConfig;
    });
    return { data: resp.data, status: resp.status, headers: resp.headers };
}

// Default export: axios-like client used throughout services/adapters
const apiClient = {
    get(url, config = {}) {
        return clientRequest('get', url, { config });
    },
    post(url, data = {}, config = {}) {
        return clientRequest('post', url, { data, config });
    },
    put(url, data = {}, config = {}) {
        return clientRequest('put', url, { data, config });
    },
    patch(url, data = {}, config = {}) {
        return clientRequest('patch', url, { data, config });
    },
    delete(url, config = {}) {
        return clientRequest('delete', url, { config });
    },
};

export default apiClient;