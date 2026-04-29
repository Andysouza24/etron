import React from "react";
import ConnectionPage from "../../../components/layout/ConnectionPage";
import { ApiFormSection } from "../../../components/layout/FormSelection";
import {
  validateApiForm,
  generateApiNameFromUrl,
  buildApiConnectionData,
} from "../../../utils/connectionValidators";

import { formatDate, createBaseAdapter } from "./baseAdapter";
import {
  parseHeaders,
  parseAuthentication,
  applyAuthentication,
  buildAuthHeaders,
  buildApiUrl,
  summarizeRequestError,
  dispatchHttp,
} from "./httpHelpers";

const TYPE = "api";
const PROVIDER = "Custom API";

const buildRequestHeaders = (connectionData) => {
  const isLegacy =
    connectionData?.headers !== undefined ||
    connectionData?.authentication !== undefined;
  const baseHeaders = { Accept: "application/json" };

  if (isLegacy) {
    const parsedHeaders = parseHeaders(connectionData.headers);
    const auth = parseAuthentication(connectionData.authentication);
    const cfg = applyAuthentication(
      { headers: { ...baseHeaders, ...parsedHeaders } },
      auth
    );
    return cfg.headers || { ...baseHeaders, ...parsedHeaders };
  }

  return {
    ...baseHeaders,
    ...buildAuthHeaders(connectionData?.authType, connectionData?.secrets),
  };
};

export const createCustomApiAdapter = (
  authService,
  apiClient,
  options = {}
) => {
  const base = createBaseAdapter({ provider: PROVIDER, type: TYPE });

  const testConnection = async (configOrUrl, headers = "", authentication = "") => {
    const isObject = configOrUrl && typeof configOrUrl === "object";
    const endpoint = isObject ? configOrUrl.endpoint : configOrUrl;
    const config = isObject
      ? configOrUrl
      : { endpoint, headers, authentication };

    const requestHeaders = buildRequestHeaders(config);
    const requestUrl = buildApiUrl(endpoint, "", {});

    try {
      const response = await dispatchHttp(apiClient, "GET", requestUrl, null, {
        headers: requestHeaders,
        timeout: 10000,
        params: {},
      });

      const statusCode = response.statusCode ?? 200;
      if (statusCode >= 400) {
        throw new Error(
          summarizeRequestError(
            { response: { status: statusCode, headers: response.headers, data: response.data } },
            requestUrl
          )
        );
      }

      const contentType =
        response.headers?.["content-type"] ||
        response.headers?.["Content-Type"] ||
        "";

      return {
        status: "success",
        responseTime: response.responseTime,
        statusCode,
        contentType,
        sampleData: response.data ?? { message: "OK" },
      };
    } catch (error) {
      const concise = summarizeRequestError(error, endpoint);
      throw new Error(`Connection test failed: ${concise}`);
    }
  };

  const connect = async (connectionData) => {
    const endpoint = connectionData?.url || connectionData?.endpoint;
    if (!connectionData || !endpoint || !connectionData.name) {
      throw new Error("Connection data with endpoint and name is required");
    }

    const testResult = await testConnection({
      endpoint,
      authType: connectionData?.authType,
      secrets: connectionData?.secrets,
    });

    if (!["success", "connected"].includes(testResult.status)) {
      throw new Error("Connection test failed");
    }

    const newConnection = {
      id: `api_${Date.now()}`,
      name: connectionData.name,
      url: endpoint,
      status: "active",
      createdAt: new Date().toISOString(),
      lastTested: new Date().toISOString(),
      headers: connectionData.headers || "{}",
      authentication: connectionData.authentication || "",
      testResult,
    };

    base.setCurrentConnection(newConnection);
    return { connected: true, connection: newConnection };
  };

  const disconnect = async () => {
    base.clear();
    return { connected: true };
  };

  const getDataSources = async () => {
    base.requireConnected("Not connected to any API");
    const { currentConnection } = base.state;

    if (options?.endpoints && currentConnection) {
      const entries = [];
      Object.entries(options.endpoints).forEach(([key, value]) => {
        if (!value) return;
        const path = typeof value === "string" ? value : value.path || "/";
        const method =
          typeof value === "string" ? "GET" : value.method || "GET";
        entries.push({
          id: `${currentConnection.id}_${key}`,
          name: `${currentConnection.name} - ${key}`,
          path,
          method,
          type: "endpoint",
          lastModified: currentConnection.lastTested,
          url: currentConnection.url,
        });
      });
      if (entries.length) return entries;
    }

    return [
      {
        id: `${currentConnection.id}_default`,
        name: `${currentConnection.name} - Default Endpoint`,
        path: "/",
        method: "GET",
        type: "endpoint",
        lastModified: currentConnection.lastTested,
        url: currentConnection.url,
      },
    ];
  };

  const fetchRawData = async (endpoint = "/", method = "GET", params = {}) => {
    const { currentConnection, isConnected } = base.state;
    const absolute =
      typeof endpoint === "string" && /^https?:\/\//i.test(endpoint);
    if (!isConnected && !absolute) {
      throw new Error("Not connected to any API");
    }

    const requestHeaders = {
      "Content-Type": "application/json",
      ...buildRequestHeaders(currentConnection || {}),
    };

    const upper = String(method).toUpperCase();
    const isGet = upper === "GET";
    const baseUrl = currentConnection?.url;
    const url = baseUrl
      ? buildApiUrl(baseUrl, endpoint, isGet ? params : {})
      : buildApiUrl(endpoint, "", isGet ? params : {});

    return dispatchHttp(apiClient, upper, url, isGet ? undefined : params, {
      headers: requestHeaders,
      timeout: 30000,
      params: {},
    });
  };

  const destroy = () => {
    base.clear();
  };

  return {
    connect,
    disconnect,
    testConnection,
    isConnected: () => base.state.isConnected,
    getConnectionInfo: () => base.getConnectionInfo(),
    switchConnection: base.switchConnection,
    updateConnection: async () => ({ connected: true }),
    deleteConnection: async () => ({ connected: true }),

    getDataSources,
    filterDataSources: base.filterDataSources,
    fetchRawData,

    parseHeaders,
    parseAuthentication,
    applyAuthentication,
    buildApiUrl,
    formatDate,

    destroy,
  };
};

export const ApiConnectionScreen = () => (
  <ConnectionPage
    connectionType="custom-api"
    title="Custom API"
    FormComponent={ApiFormSection}
    formValidator={validateApiForm}
    connectionDataBuilder={buildApiConnectionData}
    nameGenerator={generateApiNameFromUrl}
  />
);

export const adapterDescriptor = {
  type: TYPE,
  aliases: ["custom-api"],
  category: "api",
  factory: createCustomApiAdapter,
  ConnectionScreen: ApiConnectionScreen,
};
