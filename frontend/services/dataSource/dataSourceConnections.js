import endpoints from "../../utils/api/endpoints";
import { getWorkspaceId as getSavedWorkspaceId } from "../../storage/workspaceStorage";
import { sanitize, normalizeType, buildConfigAndSecrets } from "./dataSourceConfig";

// Connection workflows for data sources: test-connection and create/connect.
// DataSourceService delegates to these, injecting its apiClient, endpoint
// resolver, in-flight dedupe map, and (for connect) its own testConnection.

// Test a data-source connection by posting a built payload to the test endpoint.
// Returns a success descriptor carrying the backend testResult, or throws.
export async function testConnection({ apiClient, resolveEndpoint }, type, config, name) {
    try {
        const { configOut, secrets } = buildConfigAndSecrets(config, normalizeType(type));
        const payload = sanitize({
            name,
            sourceType: normalizeType(type),
            config: configOut || {},
            secrets: secrets && Object.keys(secrets).length ? secrets : undefined,
        });

        const workspaceId = await getSavedWorkspaceId();
        if (!workspaceId) throw new Error('No workspace selected');
        const endpointUrl = resolveEndpoint(endpoints.modules.day_book.data_sources.testConnection);
        console.log(payload);
        console.log('[DataSourceService] testConnection POST', { endpointUrl, workspaceId, payloadSummary: { type: payload.sourceType, hasConfig: !!payload.config, hasPassword: !!(payload.secrets && payload.secrets.password), endpoint: payload.config?.endpoint, hostname: payload.config?.hostname, databaseName: payload.config?.databaseName || payload.config?.database, filePath: payload.config?.filePath } });
        const response = await apiClient.post(endpointUrl, payload, { params: { workspaceId } });
        const testResult = response?.data ?? response;
        console.log('[DataSourceService] testConnection success', { status: response?.status });
        return {
            type: payload.sourceType,
            name,
            config: payload.config,
            status: 'success',
            testResult,
            createdAt: new Date().toISOString(),
            lastTested: new Date().toISOString(),
        };
    } catch (error) {
        // Surface server-provided message when available
        const serverMsg = error?.response?.data?.message || error?.response?.data?.error;
        const msg = serverMsg || error?.message || 'Connection test failed';
        console.error('[DataSourceService] testConnection failed', { status: error?.response?.status, msg });
        throw new Error(`Connection test failed: ${msg}`);
    }
}

// Create/connect a data source: best-effort test first, then post the create
// payload to the local or remote add endpoint. Dedupes concurrent calls by key.
export function connectDataSource({ apiClient, resolveEndpoint, connectInFlight, testConnection: runTestConnection }, type, config, name) {
    const key = `${type}::${name}::${config?.url || config?.connectionString || ''}`;
    if (connectInFlight.has(key)) {
        console.log('[DataSourceService] connectDataSource deduped (in-flight)', { key });
        return connectInFlight.get(key);
    }
    const run = async () => {
        // Always real connection, no demo branch
        try {
            console.log('[DataSourceService] connectDataSource calling testConnection', { type, name });
            let connectionData;
            try {
                connectionData = await runTestConnection(type, config, name);
            } catch (e) {
                console.warn('[DataSourceService] testConnection failed, proceeding to create anyway', { message: e?.message });
                connectionData = { status: 'skipped', error: e?.message };
            }

            console.log('[DataSourceService] connectDataSource - test result', {
                type,
                connectionDataSummary: {
                    status: connectionData?.status,
                    testResultKeys: connectionData?.testResult ? Object.keys(connectionData.testResult) : null,
                    sampleDataDemoFlag: connectionData?.testResult?.sampleData?.demoMode,
                    demoModeFlag: connectionData?.testResult?.demoMode,
                }
            });

            // prepare payload matching backend contract
            // query param: workspaceId
            // body: { name, type, config }
            // NOTE: endpoints file exposes addRemote / addLocal (no generic 'add')
            const dataSourceEndpoints = endpoints?.modules?.day_book?.data_sources || {};
            let endpointUrl = null;
            // choose local vs remote creation endpoint (defaults to remote)
            if (config?.isLocal || config?.mode === 'local') {
                endpointUrl = resolveEndpoint(dataSourceEndpoints.addLocal);
            } else {
                endpointUrl = resolveEndpoint(dataSourceEndpoints.addRemote);
            }
            if (!endpointUrl) {
                console.error('[DataSourceService] connectDataSource no add endpoint configured', { availableKeys: Object.keys(dataSourceEndpoints) });
                throw new Error('Data source add endpoint not configured');
            }

            const normalizedType = normalizeType(type);
            const { configOut, secrets } = buildConfigAndSecrets(config, normalizedType, { includeSpecialTypes: true });

            const payload = sanitize({
                name,
                sourceType: normalizedType,
                method: config?.method || 'overwrite',
                config: configOut || {},
                secrets: secrets && Object.keys(secrets).length ? secrets : undefined,
            });

            const workspaceId = await getSavedWorkspaceId();
            console.log('[DataSourceService] DEBUG workspaceId for add:', workspaceId);
            console.log('[DataSourceService] DEBUG payload for add:', JSON.stringify(payload));
            if (!workspaceId) throw new Error('No workspace selected');
            // include workspaceId in body as fallback
            payload.workspaceId = workspaceId;
            console.log('[DataSourceService] createDataSource POST', { endpointUrl, workspaceId, payloadSummary: { name: payload.name, sourceType: payload.sourceType, hasSecrets: !!payload.secrets, hasPassword: !!(payload.secrets && payload.secrets.password), endpoint: payload.config?.endpoint, hostname: payload.config?.hostname, databaseName: payload.config?.databaseName || payload.config?.database, filePath: payload.config?.filePath } });
            try {
                const response = await apiClient.post(endpointUrl, payload, { params: { workspaceId } });
                // Normalize response in case server returns raw object vs { data }
                const created = response?.data ?? response;
                if (!created || typeof created !== 'object') {
                    throw new Error('Backend did not return a created resource');
                }
                const normalize = (s) => {
                    const typeVal = s?.type || s?.sourceType || s?.adapterType || payload.sourceType;
                    const nameVal = s?.name || payload.name;
                    const status = s?.status || 'active';
                    const id = s?.id || s?._id || s?.dataSourceId || null;
                    const configVal = s?.config || payload.config || {};
                    return { ...s, id, type: typeVal, name: nameVal, status, config: configVal };
                };
                const normalized = normalize(created);
                if (!normalized.id) {
                    throw new Error('Backend did not return a resource id');
                }
                return normalized;
            } catch (postErr) {
                // Surface full error details for debugging
                console.error('[DataSourceService] createDataSource POST failed', {
                    endpointUrl,
                    payload,
                    errorMessage: postErr?.message,
                    errorResponse: postErr?.response || null,
                    fullError: postErr
                });
                if (postErr?.response) {
                    console.error('[DataSourceService] POST error response data:', postErr.response.data);
                }
                throw postErr;
            }
        } catch (error) {
            throw error;
        }
    };
    const promise = run().finally(() => {
        // Clear in-flight key after completion
        connectInFlight.delete(key);
    });
    connectInFlight.set(key, promise);
    return promise;
}
