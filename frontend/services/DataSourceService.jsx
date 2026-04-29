import { getAdapterInfo, createDataAdapter } from "../adapters/day-book/data-sources/DataAdapterFactory";
import endpoints from "../utils/api/endpoints";
import AuthService from "./AuthService";
import { getWorkspaceId as getSavedWorkspaceId } from "../storage/workspaceStorage";


class DataSourceService {
  constructor(apiClient) {
    this.apiClient = apiClient;
    this.activeAdapters = new Map();
    this.providerConnections = new Map();
    this._connectInFlight = new Map();
    this.demoConfigUnsubscribe = null;
  }


  async getAuthService() {
    return AuthService.createAuthServiceObject();
  }

  // Handle endpoints that may be defined as a function or a string
  resolveEndpoint(epOrFn, ...args) {
    try {
      return typeof epOrFn === 'function' ? epOrFn(...args) : epOrFn;
    } catch {
      return epOrFn;
    }
  }

  async getConnectedDataSources() {
    if (this._getConnectedPromise) {
      console.log('[DataSourceService] getConnectedDataSources deduped - returning in-flight promise');
      return this._getConnectedPromise;
    }
    const startedAt = Date.now();
    console.log('[DataSourceService] getConnectedDataSources start');
    this._getConnectedPromise = (async () => {
      try {
  const endpointUrl = this.resolveEndpoint(endpoints.modules.day_book.data_sources.getDataSources);
  const workspaceId = await getSavedWorkspaceId();
        if (!workspaceId) {
          throw new Error('No workspace selected. Please select a workspace.');
        }
  // Only send workspaceId per request
  const params = { workspaceId };
        let response;
        try {
          // Outgoing request log
          console.log('[DataSourceService] getConnectedDataSources GET', { endpointUrl, params });
          console.log("params :) :", params);
          response = await this.apiClient.get(endpointUrl, { params });
          // Quick response summary (avoid logging full payload)
          const rawType = Array.isArray(response?.data)
            ? 'array'
            : typeof response?.data;
          const arrayLen = Array.isArray(response?.data) ? response.data.length : undefined;
          const dataKeys = response?.data && typeof response.data === 'object' && !Array.isArray(response.data) ? Object.keys(response.data) : undefined;
          console.log('[DataSourceService] getConnectedDataSources GET success', {
            status: response?.status,
            dataType: rawType,
            arrayLen,
            keys: dataKeys,
          });
          try {
            const preview = (() => { try { return JSON.stringify(response?.data)?.slice(0, 400); } catch { return String(response?.data)?.slice(0, 400); } })();
            console.log('[DataSourceService] getConnectedDataSources data preview', preview);
          } catch {}
        } catch (error) {
          // Error details for the outgoing request
          console.error('[DataSourceService] getConnectedDataSources GET failed', {
            endpointUrl,
            params,
            status: error?.response?.status,
            message: error?.message,
            responseDataType: typeof error?.response?.data,
          });
          try {
            const errPreview = (() => { const d = error?.response?.data; try { return JSON.stringify(d)?.slice(0, 400); } catch { return String(d)?.slice(0, 400); } })();
            console.error('[DataSourceService] getConnectedDataSources error data preview', errPreview);
          } catch {}
          let backendMsg = '';
          if (error?.response?.data) {
            if (typeof error.response.data === 'string') {
              backendMsg = error.response.data;
            } else if (typeof error.response.data === 'object') {
              backendMsg = error.response.data.error || error.response.data.message || JSON.stringify(error.response.data);
            }
          }
          if (!backendMsg) backendMsg = error?.message || 'Unknown error';
          const status = error?.response?.status;
          if (status === 400) {
            throw new Error(`Server error 400: ${backendMsg}`);
          }
          throw new Error(backendMsg);
        }
        const raw = response?.data;
        const getArray = (obj) => {
          if (Array.isArray(obj)) return obj;
          if (!obj || typeof obj !== 'object') return null;
          const direct = obj.data || obj.items || obj.results || obj.list || obj.value || obj.records || obj.rows || obj.sources || obj.Items;
          if (Array.isArray(direct)) return direct;
          const underData = obj.data && typeof obj.data === 'object' ? (obj.data.items || obj.data.results || obj.data.data || obj.data.records || obj.data.rows || obj.data.sources || obj.data.Items) : null;
          if (Array.isArray(underData)) return underData;
          // Fallback: first array value in object
          const firstArray = Object.values(obj).find((v) => Array.isArray(v));
          if (Array.isArray(firstArray)) return firstArray;
          return null;
        };
        const list = getArray(raw) || [];
        if (!Array.isArray(raw)) {
          if (raw?.error || raw?.message) {
            throw new Error(`Server error: ${raw?.error || raw?.message}`);
          }
        }
        const normalize = (s) => {
          const type = s?.type || s?.sourceType || s?.adapterType || s?.kind || 'api';
          const name = s?.name || s?.title || s?.label || '';
          const status = s?.status || s?.connectionStatus || s?.state || null;
          const id = s?.id || s?._id || s?.dataSourceId || null;
          const config = s?.config || s?.configuration || {};
          return { ...s, id, type, name, status, config };
        };
        const normalized = list.map(normalize);
        const filtered = normalized.filter((source) => !source.config?.isProvider && source.name);
        const byId = new Map();
        const byNameType = new Map();
        for (const src of filtered) {
          if (src.id && !byId.has(src.id)) {
            byId.set(src.id, src);
            continue;
          }
          if (!src.id) {
            const key = `${src.type}::${src.name}`.toLowerCase();
            if (!byNameType.has(key)) byNameType.set(key, src);
          }
        }
        let realSources = [...byId.values(), ...byNameType.values()];
        // Post-processing summary
        console.log('[DataSourceService] getConnectedDataSources parsed', {
          totalReturned: list.length,
          uniqueCount: realSources.length,
        });
        const needsEnrichment = (s) => !s || !s.id || !s.status || !s.config || Object.keys(s.config || {}).length === 0;
        const toEnrich = realSources.filter(needsEnrichment).map((s) => s.id).filter(Boolean);
        if (toEnrich.length) {
          try {
            const details = await Promise.all(
              toEnrich.map(async (id) => {
                try {
                  const ent = await this.getDataSource(id);
                  return { id, entity: ent };
                } catch {
                  return { id, entity: null };
                }
              })
            );
            const detailMap = new Map();
            details.forEach(({ id, entity }) => {
              if (!entity) return;
              const normalizedDetail = ((s) => {
                const type = s?.type || s?.sourceType || s?.adapterType || s?.kind || 'api';
                const name = s?.name || s?.title || s?.label || '';
                const status = s?.status || s?.connectionStatus || s?.state || null;
                const nid = s?.id || s?._id || s?.dataSourceId || id;
                const config = s?.config || s?.configuration || {};
                return { ...s, id: nid, type, name, status, config };
              })(entity);
              detailMap.set(id, normalizedDetail);
            });
            if (detailMap.size) {
              realSources = realSources.map((s) => {
                const d = detailMap.get(s.id);
                if (!d) return s;
                return { ...s, ...d, config: d.config || s.config, status: d.status || s.status };
              });
            }
          } catch {}
        }
        return realSources;
      } catch (error) {
        const msg = error?.message || (error?.response && JSON.stringify(error.response?.data)) || '';
        if (error?.response?.status === 400 || msg.includes('Missing required query parameters')) {
          throw new Error(msg || 'Server error 400: Missing required query parameters');
        }
        throw new Error(msg);
      }
    })();
    try {
      const result = await this._getConnectedPromise;
      return result;
    } finally {
      this._getConnectedPromise = null;
      console.log('[DataSourceService] getConnectedDataSources end', { durationMs: Date.now() - startedAt });
    }
  }

  getProviderConnection(type) {
    return this.providerConnections.get(type);
  }

  isProviderConnected(type) {
    const connection = this.getProviderConnection(type);
    return connection && connection.status === "connected";
  }

  async getDataSource(sourceId) {
    // Guard against recursive re-entry
    if (this._getDataSourcePromise && this._lastGetDataSourceId === sourceId) {
  console.log('[DataSourceService] getDataSource deduped - returning in-flight promise', { sourceId });
      return this._getDataSourcePromise;
    }
    this._lastGetDataSourceId = sourceId;
    const startedAt = Date.now();
    console.log('[DataSourceService] getDataSource start', { sourceId });
    this._getDataSourcePromise = (async () => {
    try {
  const workspaceId = await getSavedWorkspaceId();
  if (!workspaceId) throw new Error('No workspace selected');
  const endpointUrl = this.resolveEndpoint(endpoints.modules.day_book.data_sources.getDataSource, sourceId);
  // Only send workspaceId per request
  const params = { workspaceId };
      console.log('[DataSourceService] getDataSource GET', { endpointUrl, sourceId, params });
      const response = await this.apiClient.get(endpointUrl, { params });
      try {
        const status = response?.status;
        const hasData = !!response?.data;
        const dtype = Array.isArray(response?.data) ? 'array' : typeof response?.data;
        const dlen = Array.isArray(response?.data) ? response.data.length : undefined;
        const dkeys = response?.data && typeof response.data === 'object' && !Array.isArray(response.data) ? Object.keys(response.data) : undefined;
        const preview = (() => { try { return JSON.stringify(response?.data)?.slice(0, 400); } catch { return String(response?.data)?.slice(0, 400); } })();
        console.log('[DataSourceService] getDataSource raw response', { status, hasData, dtype, dlen, dkeys });
        console.log('[DataSourceService] getDataSource data preview', preview);
      } catch {}
      const raw = response?.data;
      const entity = (raw && typeof raw === 'object' && (raw.data || raw.item || raw.Item)) || raw;
      if (!entity || typeof entity !== 'object') {
        console.warn('[DataSourceService] getDataSource unexpected payload shape', { hasRaw: !!raw });
      }
         // Normalize to ensure consumers can reliably read `id` and `type`
         const normalized = { ...entity };
         if (!normalized.id) normalized.id = normalized.dataSourceId || normalized._id || sourceId;
         if (!normalized.type) normalized.type = normalized.sourceType || normalized.type;
         return normalized;
    } catch (error) {
      throw new Error("Unable to load data source");
    }
    })();
    try {
      return await this._getDataSourcePromise;
    } finally {
      console.log('[DataSourceService] getDataSource end', { sourceId, durationMs: Date.now() - startedAt });
      this._getDataSourcePromise = null;
      this._lastGetDataSourceId = null;
    }
  }

  async fetchDataFromSource(sourceId, options = {}) {
    try {
      const dataSource = await this.getDataSource(sourceId);
      if (!dataSource) throw new Error(`Data source ${sourceId} not found`);
      const adapter = await this.getAdapter(dataSource.type, dataSource.config);
      if (!adapter.fetchRawData || typeof adapter.fetchRawData !== "function")
        throw new Error(`Adapter for ${dataSource.type} does not support data fetching`);
      const {
        endpoint = dataSource.config?.endpoint || dataSource.config?.defaultEndpoint || "/",
        method = "GET",
        params = {},
      } = options;
      const rawResponse = await adapter.fetchRawData(sourceId, endpoint, method, params);
      try {
        const meta = {
          statusCode: rawResponse?.statusCode,
          responseTime: rawResponse?.responseTime,
          contentType: rawResponse?.headers?.["content-type"] || rawResponse?.headers?.["Content-Type"] || 'unknown',
        };
        const samplePreview = (() => { try { return JSON.stringify(rawResponse?.data)?.slice(0, 300); } catch { return String(rawResponse?.data)?.slice(0, 300); } })();
        console.log('[DataSourceService] fetchDataFromSource raw response meta', meta);
        console.log('[DataSourceService] fetchDataFromSource data preview', samplePreview);
      } catch {}
      const transformedData = this.transformRawData(rawResponse, dataSource, {
        endpoint,
        method,
        sourceId,
      });
      await this.updateLastSync(sourceId);
      return transformedData;
    } catch (error) {
      try {
        await this.updateDataSourceStatus(sourceId, "error", error.message);
      } catch {}
      throw new Error(`Failed to fetch data: ${error.message}`);
    }
  }

  transformRawData(rawResponse, dataSource, requestInfo) {
    let data = [];
    let headers = [];
    if (Array.isArray(rawResponse.data)) {
      data = rawResponse.data;
      headers = data.length > 0 ? Object.keys(data[0]) : [];
    } else if (rawResponse.data && typeof rawResponse.data === "object") {
      data = [rawResponse.data];
      headers = Object.keys(rawResponse.data);
    } else {
      data = [{ value: rawResponse.data }];
      headers = ["value"];
    }
    return {
      id: requestInfo.sourceId,
      name: `${dataSource.name} - ${requestInfo.endpoint}`,
      data,
      headers,
      metadata: {
        sourceId: requestInfo.sourceId,
        sourceName: dataSource.name,
        sourceType: dataSource.type,
        endpoint: requestInfo.endpoint,
        method: requestInfo.method,
  statusCode: rawResponse.statusCode,
        responseTime: rawResponse.responseTime,
        contentType: rawResponse.headers?.["content-type"] || "unknown",
        lastUpdated: new Date().toISOString(),
        recordCount: data.length,
        isDemoData: dataSource.config?.isDemoMode || this.isDemoModeActive(),
  demoMode: "disabled",
      },
    };
  }

  async getAdapter(type, config = {}) {
    const adapterKey = `${type}_${JSON.stringify(config)}`;
    if (this.activeAdapters.has(adapterKey)) return this.activeAdapters.get(adapterKey);
    try {
      const authService = await this.getAuthService();
      const adapter = createDataAdapter(type, {
        ...config,
        apiClient: this.apiClient,
        endpoints,
        authService,
      });
      if (!adapter) throw new Error(`No adapter found for type: ${type}`);
      this.activeAdapters.set(adapterKey, adapter);
      return adapter;
    } catch (error) {
      throw new Error(`Failed to initialize ${type} adapter: ${error.message}`);
    }
  }

  async connectDataSource(type, config, name) {
    const key = `${type}::${name}::${config?.url || config?.connectionString || ''}`;
    if (this._connectInFlight.has(key)) {
      console.log('[DataSourceService] connectDataSource deduped (in-flight)', { key });
      return this._connectInFlight.get(key);
    }
  const run = async () => {
  // Always real connection, no demo branch
  try {
      console.log('[DataSourceService] connectDataSource calling testConnection', { type, name });
      let connectionData;
      try {
        connectionData = await this.testConnection(type, config, name);
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
        endpointUrl = this.resolveEndpoint(dataSourceEndpoints.addLocal);
      } else {
        endpointUrl = this.resolveEndpoint(dataSourceEndpoints.addRemote);
      }
      if (!endpointUrl) {
        console.error('[DataSourceService] connectDataSource no add endpoint configured', { availableKeys: Object.keys(dataSourceEndpoints) });
        throw new Error('Data source add endpoint not configured');
      }
  const sanitize = (obj) => {
        if (!obj || typeof obj !== 'object') return obj;
        const out = Array.isArray(obj) ? [] : {};
        Object.entries(obj).forEach(([k, v]) => {
          if (v === undefined) return; // drop undefined
          if (v && typeof v === 'object') out[k] = sanitize(v);
          else out[k] = v;
        });
        return out;
      };

      // Normalize adapter type to API contract (e.g., 'custom-api' -> 'api')
      // TODO: fix this, so it is just api
      const normalizeType = (t) => {
        if (!t) return t;
        const map = { 'custom-api': 'api', 'csv-file': 'csv', 'custom-ftp': 'ftp' };
        return map[t] || t;
      };

  // build config + secrets payload per backend contract:
  // remote create expects: { name, sourceType, method, expiry, config, secrets }
  const buildConfigAndSecrets = (cfg, srcType) => {
        const clone = cfg ? { ...cfg } : {};
        // Try to parse possible stringified fields
        const parseMaybeJSON = (val) => {
          if (val == null) return val;
          if (typeof val !== 'string') return val;
          try { return JSON.parse(val); } catch { return val; }
        };
        const authRaw = parseMaybeJSON(clone.authentication);
        // Normalize auth: allow plain string to represent an API key
        let auth = null;
        if (authRaw && typeof authRaw === 'object') auth = authRaw;
        else if (typeof authRaw === 'string' && authRaw.trim()) auth = { type: 'apiKey', value: authRaw.trim() };

        // Derive authType per contract (map 'apikey' -> 'apiKey')
        const authType = (() => {
          const t = auth?.type || clone.authType;
          if (!t) return undefined; // allow no-auth
          const lc = String(t).toLowerCase();
          if (lc === 'apikey') return 'apiKey';
          if (lc === 'jwt' || lc === 'jwt bearer' || lc === 'jwt-bearer') return 'bearer';
          return String(t);
        })();

  // Dashboard raw data: simple { fileName, description } config, no secrets.
  if ((srcType || '').toLowerCase() === 'dashboard-raw-data') {
          const fileName = clone.fileName?.trim();
          const description = clone.description?.trim();
          const configOut = sanitize({ fileName, description });
          return { configOut, secrets: {} };
        }

  // parent connection - no config, no secrets
  // pipeline auto discovers files in bucket and creates child data sources for each
  if ((srcType || '').toLowerCase() === 'micromax-dashboard') {
          return { configOut: {}, secrets: {} };
        }

  // MySQL: include hostname and database fields; keep password in secrets only
  if ((srcType || '').toLowerCase() === 'mysql') {
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

        // FTP: include hostname, port, filePath in config; secrets include username/password (+ optional keyFile)
        if ((srcType || '').toLowerCase() === 'ftp') {
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

        // Default API-like case
        // endpoint is optional in contract -- default to empty string to match example
        const endpoint = clone.endpoint ?? clone.url ?? '';

        const secrets = {};
        switch ((authType || '').toLowerCase()) {
          case 'apikey': {
            // Use provided authentication value as apiKey; do not infer from URL/connectionString
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
      };

      const normalizedType = normalizeType(type);
      const { configOut, secrets } = buildConfigAndSecrets(config, normalizedType);

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
    const response = await this.apiClient.post(endpointUrl, payload, { params: { workspaceId } });
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
      this._connectInFlight.delete(key);
    });
    this._connectInFlight.set(key, promise);
    return promise;
  }

  async updateDataSource(sourceId, updates) {
    if (this.isDemoModeActive()) {
      await this.simulateDemoDelay("update");
      const sourceIndex = this.demoSources.findIndex((s) => s.id === sourceId);
      if (sourceIndex !== -1) {
        this.demoSources[sourceIndex] = {
          ...this.demoSources[sourceIndex],
          ...updates,
          lastSync: new Date().toISOString(),
        };
        return this.demoSources[sourceIndex];
      }
      throw new Error(`Demo source ${sourceId} not found`);
    }
    try {
      // Log the outgoing update payload and target endpoint
      const sanitize = (obj) => {
        if (!obj || typeof obj !== 'object') return obj;
        const out = Array.isArray(obj) ? [] : {};
        Object.entries(obj).forEach(([k, v]) => {
          if (v === undefined) return; // drop undefined
          if (v && typeof v === 'object') out[k] = sanitize(v);
          else out[k] = v;
        });
        return out;
      };
      const workspaceId = await getSavedWorkspaceId();
      if (!workspaceId) throw new Error('No workspace selected');
  const endpointUrl = this.resolveEndpoint(endpoints.modules.day_book.data_sources.update, sourceId);
      const payload = sanitize(updates);
      console.log('[DataSourceService] updateDataSource PUT', { endpointUrl, workspaceId, sourceId, payload });
      const response = await this.apiClient.put(
        endpointUrl,
        payload,
        { params: { workspaceId } }
      );
      if (updates.config) this.clearAdapterCache(sourceId);
      console.log('[DataSourceService] updateDataSource success', { sourceId, status: response?.status || 'ok' });
      return response.data;
    } catch {
      throw new Error("Failed to update data source");
    }
  }

  async refreshDashboardRawData(sourceId) {
    try {
      const workspaceId = await getSavedWorkspaceId();
      if (!workspaceId) throw new Error('No workspace selected');
      const endpointUrl = this.resolveEndpoint(endpoints.modules.day_book.data_sources.refreshDashboardRawData, sourceId);
      console.log('[DataSourceService] refreshDashboardRawData POST', { endpointUrl, workspaceId, sourceId });
      const response = await this.apiClient.post(endpointUrl, { workspaceId });
      return response.data;
    } catch (err) {
      console.error('[DataSourceService] refreshDashboardRawData:', err);
      throw new Error(err?.response?.data?.error || 'Failed to refresh dashboard raw data');
    }
  }

  async rescanMicromaxDashboard(parentSourceId) {
    try {
      const workspaceId = await getSavedWorkspaceId();
      if (!workspaceId) throw new Error('No workspace selected');
      const endpointUrl = this.resolveEndpoint(endpoints.modules.day_book.data_sources.rescanMicromaxDashboard, parentSourceId);
      console.log('[DataSourceService] rescanMicromaxDashboard POST', { endpointUrl, workspaceId, parentSourceId });
      const response = await this.apiClient.post(endpointUrl, { workspaceId });
      return response.data;
    } catch (err) {
      console.error('[DataSourceService] rescanMicromaxDashboard:', err);
      throw new Error(err?.response?.data?.error || 'Failed to rescan Micromax Dashboard files');
    }
  }

  async disconnectDataSource(sourceId) {
    try {
      const workspaceId = await getSavedWorkspaceId();
      if (!workspaceId) throw new Error('No workspace selected');
  const endpointUrl = this.resolveEndpoint(endpoints.modules.day_book.data_sources.removeDataSource, sourceId);
  console.log('[DataSourceService] disconnectDataSource DELETE', { endpointUrl, workspaceId, sourceId });
  const resp = await this.apiClient.delete(endpointUrl, { params: { workspaceId } });
      this.clearAdapterCache(sourceId);
  console.log('[DataSourceService] disconnectDataSource success', { sourceId, status: resp?.status || 'ok' });
      return true;
    } catch {
      throw new Error("Failed to disconnect data source");
    }
  }

  async testConnection(type, config, name) {
    try {
      // Build payload per backend contract
      const sanitize = (obj) => {
        if (!obj || typeof obj !== 'object') return obj;
        const out = Array.isArray(obj) ? [] : {};
        Object.entries(obj).forEach(([k, v]) => {
          if (v === undefined) return;
          if (v && typeof v === 'object') out[k] = sanitize(v);
          else out[k] = v;
        });
        return out;
      };
      const normalizeType = (t) => {
        if (!t) return t;
        const map = { 'custom-api': 'api', 'csv-file': 'csv', 'custom-ftp': 'ftp' };
        return map[t] || t;
      };
  const buildConfigAndSecrets = (cfg, srcType) => {
        const clone = cfg ? { ...cfg } : {};
        const parseMaybeJSON = (val) => {
          if (val == null) return val;
          if (typeof val !== 'string') return val;
          try { return JSON.parse(val); } catch { return val; }
        };
        const authRaw = parseMaybeJSON(clone.authentication);
        let auth = null;
        if (authRaw && typeof authRaw === 'object') auth = authRaw;
        else if (typeof authRaw === 'string' && authRaw.trim()) auth = { type: 'apiKey', value: authRaw.trim() };
        const authType = (() => {
          const t = auth?.type || clone.authType;
          if (!t) return undefined; // allow no-auth
          const lc = String(t).toLowerCase();
          if (lc === 'apikey') return 'apiKey';
          if (lc === 'jwt' || lc === 'jwt bearer' || lc === 'jwt-bearer') return 'bearer';
          return String(t);
        })();
  // MySQL specific mapping first
  if ((srcType || '').toLowerCase() === 'mysql') {
          const hostname = clone.hostname || clone.host || clone.server;
          const port = clone.port != null ? String(clone.port) : '3306';
          const username = clone.username;
          const database = clone.databaseName || clone.database;
          const secrets = {};
          const user = clone.secrets?.username ?? clone.username;
          if (user != null) secrets.username = String(user);
          const pw = clone.password ?? clone.secrets?.password;
          if (pw != null) secrets.password = String(pw);
          const configOut = { hostname, port, username, database, databaseName: database };
          return { configOut, secrets };
        }

        // FTP mapping
        if ((srcType || '').toLowerCase() === 'ftp') {
          const hostname = clone.hostname || clone.host;
          const port = clone.port != null ? String(clone.port) : '21';
          const filePath = clone.filePath || clone.directory || '/';
          const configOut = { hostname, port, filePath };
          const secrets = {};
          const user = clone.secrets?.username ?? clone.username;
          const pw = clone.secrets?.password ?? clone.password;
          const keyFile = clone.secrets?.keyFile ?? clone.keyFile;
          if (user != null) secrets.username = String(user);
          if (pw != null) secrets.password = String(pw);
          if (keyFile != null) secrets.keyFile = String(keyFile);
          return { configOut, secrets };
        }
        const endpoint = clone.endpoint ?? clone.url ?? '';
        const secrets = {};
        switch ((authType || '').toLowerCase()) {
          case 'apikey': {
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
          default: {}
        }
        const configOut = sanitize({ authType, endpoint });
        return { configOut, secrets };
      };

      const { configOut, secrets } = buildConfigAndSecrets(config, normalizeType(type));
      const payload = sanitize({
        name,
        sourceType: normalizeType(type),
        config: configOut || {},
        secrets: secrets && Object.keys(secrets).length ? secrets : undefined,
      });

      const workspaceId = await getSavedWorkspaceId();
      if (!workspaceId) throw new Error('No workspace selected');
      const endpointUrl = this.resolveEndpoint(endpoints.modules.day_book.data_sources.testConnection);
      console.log(payload);
  console.log('[DataSourceService] testConnection POST', { endpointUrl, workspaceId, payloadSummary: { type: payload.sourceType, hasConfig: !!payload.config, hasPassword: !!(payload.secrets && payload.secrets.password), endpoint: payload.config?.endpoint, hostname: payload.config?.hostname, databaseName: payload.config?.databaseName || payload.config?.database, filePath: payload.config?.filePath } });
      const response = await this.apiClient.post(endpointUrl, payload, { params: { workspaceId } });
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

  async updateLastSync(sourceId) {
    try {
      await this.updateDataSource(sourceId, { lastSync: new Date().toISOString() });
    } catch {}
  }

  async updateDataSourceStatus(sourceId, status, error = null) {
    try {
      const updates = { status };
      if (error) updates.error = error;
      await this.updateDataSource(sourceId, updates);
    } catch {}
  }

  clearAdapterCache(sourceId) {
    const keysToRemove = [];
    for (const key of this.activeAdapters.keys()) {
      if (key.includes(sourceId)) keysToRemove.push(key);
    }
    keysToRemove.forEach((key) => this.activeAdapters.delete(key));
  }

  clearAllAdapterCache() {
    this.activeAdapters.clear();
  }

  async getDataSourceStats() {
    try {
  const startedAt = Date.now();
  console.log('[DataSourceService] getDataSourceStats start');
      const sources = await this.getConnectedDataSources();
  const stats = {
        total: sources.length,
        connected: sources.filter((s) => s.status === "connected").length,
        errors: sources.filter((s) => s.status === "error").length,
        byType: this.groupByType(sources),
        byCategory: this.groupByCategory(sources),
      };
  console.log('[DataSourceService] getDataSourceStats end', { durationMs: Date.now() - startedAt, totals: stats });
  return stats;
    } catch (error) {
      throw error;
    }
  }

  groupByType(sources) {
    return sources.reduce((acc, source) => {
      acc[source.type] = (acc[source.type] || 0) + 1;
      return acc;
    }, {});
  }

  groupByCategory(sources) {
    return sources.reduce((acc, source) => {
      const adapterInfo = getAdapterInfo(source.type);
      const category = adapterInfo?.category || "other";
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {});
  }

  async getAvailableDataSources(sourceId) {
    try {
      console.log('[DataSourceService] getAvailableDataSources start', { sourceId });
      const dataSource = await this.getDataSource(sourceId);
      const adapter = await this.getAdapter(dataSource.type, dataSource.config);
      if (adapter.getDataSources && typeof adapter.getDataSources === "function") {
        const list = await adapter.getDataSources();
        console.log('[DataSourceService] getAvailableDataSources adapter list', { count: Array.isArray(list) ? list.length : 0 });
        return list;
      }
      const fallback = [
        {
          id: `${sourceId}_default`,
          name: `${dataSource.name} - Default`,
          type: "default",
          lastModified: dataSource.lastSync || dataSource.createdAt,
        },
      ];
      console.log('[DataSourceService] getAvailableDataSources fallback list', { count: fallback.length });
      return fallback;
    } catch {
      throw new Error("Failed to discover available data sources");
    }
  }

  async connectProvider(type) {
    try {
      const adapter = await this.getAdapter(type);
      if (!adapter || !adapter.connect)
        throw new Error(`Adapter for ${type} does not support provider connection`);
      const connectionResult = await adapter.connect();
      const providerConnection = {
        id: `provider_${type}_${Date.now()}`,
        type,
        name: `${this.getDisplayName(type)} Provider`,
        status: "connected",
        lastSync: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        config: {
          isProvider: true,
          connectionResult,
      isDemoMode: false,
        },
        testResult: {
          status: "success",
      responseTime: "200ms",
          statusCode: 200,
          contentType: "application/json",
        },
      };
    this.providerConnections.set(type, providerConnection);
      return providerConnection;
    } catch (error) {
      throw new Error(`Failed to connect ${type} provider: ${error.message}`);
    }
  }

  async disconnectProvider(type) {
    try {
  this.providerConnections.delete(type);
      this.clearAdapterCacheByType(type);
      return true;
    } catch (error) {
      throw new Error(`Failed to disconnect ${type} provider: ${error.message}`);
    }
  }

  clearAdapterCacheByType(type) {
    const keysToRemove = [];
    for (const key of this.activeAdapters.keys()) {
      if (key.startsWith(type)) keysToRemove.push(key);
    }
    keysToRemove.forEach((key) => this.activeAdapters.delete(key));
  }

  async syncDataSource(sourceId, options = {}) {
    return this.fetchDataFromSource(sourceId, options);
  }

  // New: fetch view data from backend endpoint
  async viewData(sourceId, params = {}) {
    const startedAt = Date.now();
    try {
      console.log("!!!!!!LOGGING SOURCEID: ", sourceId);
        if (!sourceId) {
          throw new Error('Missing sourceId for viewData request');
        }
      const workspaceId = await getSavedWorkspaceId();
      if (!workspaceId) throw new Error('No workspace selected');
      const endpointUrl = this.resolveEndpoint(endpoints.modules.day_book.data_sources.viewData, sourceId);
      const query = { workspaceId, ...(params || {}) };
      console.log('[DataSourceService] viewData GET', { endpointUrl, sourceId, params: query });
      const response = await this.apiClient.get(endpointUrl, { params: query });
      const raw = response?.data;
      // Normalize data array/object shapes from backend
      const pickArray = (obj) => {
        if (Array.isArray(obj)) return obj;
        if (!obj || typeof obj !== 'object') return null;
        const direct = obj.data || obj.items || obj.results || obj.records || obj.rows || obj.value;
        if (Array.isArray(direct)) return direct;
        const underData = obj.data && typeof obj.data === 'object' ? (obj.data.items || obj.data.results || obj.data.records || obj.data.rows || obj.data.value) : null;
        if (Array.isArray(underData)) return underData;
        // If object single row, return as array
        return obj && typeof obj === 'object' ? [obj] : null;
      };
      const data = pickArray(raw) || [];
      const headers = (() => {
        if (Array.isArray(data) && data.length > 0) {
          const first = data.find((r) => r && typeof r === 'object' && !Array.isArray(r));
          if (first && typeof first === 'object') return Object.keys(first);
        }
        return ['value'];
      })();
      console.log('[DataSourceService] viewData success', { status: response?.status, rows: data.length, cols: headers.length, durationMs: Date.now() - startedAt });
      return { data, headers };
    } catch (error) {
      const status = error?.response?.status;
      const msg = error?.response?.data?.error || error?.response?.data?.message || error?.message || 'Failed to load view data';
      console.error('[DataSourceService] viewData failed', { sourceId, status, msg, durationMs: Date.now() - startedAt });
      throw new Error(msg);
    }
  }


  refreshFromCentralizedConfig() {
    return false;
  }

  getDemoStatus() { return { effective: false }; }

  // Explicitly disable demo mode throughout the service
  isDemoModeActive() { return false; }
  async simulateDemoDelay() { return; }

  getDisplayName(type) {
    const displayNames = {
      "google-sheets": "Google Sheets",
      "google-drive": "Google Drive",
      "microsoft-excel": "Microsoft Excel",
      onedrive: "OneDrive",
      dropbox: "Dropbox",
  api: "API",
      "custom-api": "Custom API",
      database: "Database",
      "csv-file": "CSV File",
    };
    return displayNames[type] || type;
  }

  destroy() {
    if (this.demoConfigUnsubscribe) this.demoConfigUnsubscribe();
    this.clearAllAdapterCache();
    this.providerConnections.clear();
  }
}

export default DataSourceService;
