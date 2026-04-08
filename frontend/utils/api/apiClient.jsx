import { fetchAuthSession } from 'aws-amplify/auth';
import axios from 'axios';

async function getHeaders() {
    const session = await fetchAuthSession();
    const idToken = session.tokens.idToken.toString();
    //console.log(idToken);
    
    return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`
    };
}

async function request(method, path, body = {}, params = {}, config = {}) {
    const baseHeaders = await getHeaders();
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
    try {
        const response = await axios(requestConfig);
        return response;
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

// Default export: axios-like client used throughout services/adapters
const apiClient = {
    async get(url, config = {}) {
        const baseHeaders = await getHeaders();
        const headers = { ...baseHeaders, ...(config.headers || {}) };
        const resp = await axios({ method: 'get', url, headers, params: config.params, timeout: config.timeout });
        return { data: resp.data, status: resp.status, headers: resp.headers };
    },
    async post(url, data = {}, config = {}) {
        const baseHeaders = await getHeaders();
        const headers = { ...baseHeaders, ...(config.headers || {}) };
        const resp = await axios({ method: 'post', url, headers, data, params: config.params, timeout: config.timeout });
        return { data: resp.data, status: resp.status, headers: resp.headers };
    },
    async put(url, data = {}, config = {}) {
        const baseHeaders = await getHeaders();
        const headers = { ...baseHeaders, ...(config.headers || {}) };
        const resp = await axios({ method: 'put', url, data, headers, params: config.params, timeout: config.timeout });
        return { data: resp.data, status: resp.status, headers: resp.headers };
    },
    async patch(url, data = {}, config = {}) {
        const baseHeaders = await getHeaders();
        const headers = { ...baseHeaders, ...(config.headers || {}) };
        const resp = await axios({ method: 'patch', url, data, headers, params: config.params, timeout: config.timeout });
        return { data: resp.data, status: resp.status, headers: resp.headers };
    },
    async delete(url, config = {}) {
        const baseHeaders = await getHeaders();
        const headers = { ...baseHeaders, ...(config.headers || {}) };
        const resp = await axios({ method: 'delete', url, headers, params: config.params, timeout: config.timeout });
        return { data: resp.data, status: resp.status, headers: resp.headers };
    },
};

export default apiClient;