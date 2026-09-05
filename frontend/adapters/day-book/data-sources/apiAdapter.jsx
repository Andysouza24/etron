import { router } from "expo-router";

import { getSavedWorkspaceId, getWorkspaceId } from "../../../storage/workspaceStorage";
import endpoints from "../../../utils/api/endpoints";
import { apiPost } from "../../../utils/api/apiClient";

import ApiConnectStep from "./api/wizard-steps/ApiConnectStep";
import FieldCategoryReviewStep from "../../../components/modules/day-book/data-sources/wizard/steps/FieldCategoryReviewStep";
import GeneralSettingsStep from "../../../components/modules/day-book/data-sources/wizard/steps/GeneralSettingsStep";
import ApiSettingsExtra from "./api/wizard-steps/ApiSettingsExtra";

import { formatDate, createBaseAdapter } from "./baseAdapter";

const TYPE = "api";
const PROVIDER = "Custom API";

// Map the various legacy/UI auth shapes onto the backend
// `{ authType, secrets }` contract used by the data-sources Lambda.
const buildAuthPayload = (connectionData = {}) => {
  const parseMaybe = (v) => {
    if (v == null || typeof v !== "string" || !v.trim()) return null;
    try {
      return JSON.parse(v);
    } catch {
      return { type: "apiKey", value: v.trim() };
    }
  };
  const auth = parseMaybe(connectionData.authentication);
  const rawType = auth?.type || connectionData.authType || null;
  const lc = rawType ? String(rawType).toLowerCase() : null;
  const authType = (() => {
    if (!lc) return undefined;
    if (lc === "apikey") return "apiKey";
    if (lc === "jwt" || lc === "bearer" || lc === "jwt-bearer") return "bearer";
    return rawType;
  })();

  const secrets = {};
  switch (lc) {
    case "apikey": {
      const v =
        auth?.value ??
        connectionData.apiKey ??
        connectionData.secrets?.apiKey;
      if (v != null) secrets.apiKey = String(v);
      break;
    }
    case "bearer": {
      const t =
        auth?.token ??
        connectionData.token ??
        connectionData.secrets?.token;
      if (t != null) secrets.token = String(t);
      break;
    }
    case "basic": {
      const u =
        auth?.username ??
        connectionData.username ??
        connectionData.secrets?.username;
      const p =
        auth?.password ??
        connectionData.password ??
        connectionData.secrets?.password;
      if (u != null) secrets.username = String(u);
      if (p != null) secrets.password = String(p);
      break;
    }
    default:
      break;
  }
  return {
    authType,
    secrets: Object.keys(secrets).length ? secrets : undefined,
  };
};

export const createCustomApiAdapter = (authService, apiClient) => {
  const base = createBaseAdapter({ provider: PROVIDER, type: TYPE });

  const requireWorkspaceId = async () => {
    const workspaceId = await getSavedWorkspaceId();
    if (!workspaceId) throw new Error("No workspace selected");
    return workspaceId;
  };

  // Delegates to POST /day-book/data-sources/test-connection. The backend
  // resolves the right adapter, applies auth, and probes the endpoint.
  const testConnection = async (configOrUrl) => {
    const isObject = configOrUrl && typeof configOrUrl === "object";
    const endpoint = isObject
      ? configOrUrl.endpoint ?? configOrUrl.url
      : configOrUrl;
    const source = isObject ? configOrUrl : { endpoint };
    const { authType, secrets } = buildAuthPayload(source);

    const workspaceId = await requireWorkspaceId();
    const url = endpoints.modules.day_book.data_sources.testConnection;

    try {
      const response = await apiClient.post(
        url,
        {
          sourceType: TYPE,
          config: { authType, endpoint },
          secrets,
        },
        { params: { workspaceId } }
      );
      const result = response?.data ?? {};
      if (result.status && result.status !== "success") {
        throw new Error(result.errorMessage || "Connection test failed");
      }
      return {
        status: "success",
        sampleData: result.preview ?? { message: "OK" },
      };
    } catch (error) {
      const serverMsg =
        error?.response?.data?.errorMessage ||
        error?.response?.data?.message ||
        error?.message;
      throw new Error(`Connection test failed: ${serverMsg}`);
    }
  };

  const connect = async (connectionData) => {
    const endpoint = connectionData?.url || connectionData?.endpoint;
    if (!connectionData || !endpoint || !connectionData.name) {
      throw new Error("Connection data with endpoint and name is required");
    }

    const testResult = await testConnection(connectionData);

    const newConnection = {
      id: `api_${Date.now()}`,
      name: connectionData.name,
      url: endpoint,
      status: "active",
      createdAt: new Date().toISOString(),
      lastTested: new Date().toISOString(),
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

  // Reads ingested data for a persisted data source via the backend
  // (GET /day-book/data-sources/{id}/view-data). No live HTTP from the device.
  const fetchRawData = async (dataSourceId) => {
    if (!dataSourceId) {
      throw new Error(
        "dataSourceId is required to fetch data via the backend"
      );
    }
    const workspaceId = await requireWorkspaceId();
    const url = endpoints.modules.day_book.data_sources.viewData(dataSourceId);

    const start = Date.now();
    const response = await apiClient.get(url, { params: { workspaceId } });
    return {
      data: response?.data?.data ?? response?.data ?? [],
      statusCode: response?.status,
      headers: response?.headers,
      responseTime: `${Date.now() - start}ms`,
    };
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

    formatDate,

    destroy,
  };
};

// wizard finalise: activates previously-created pending data source by persisting user-confirmed schema and flipping status to active
const finaliseCustomApi = async (draft) => {
  const { dataSourceId, name, confirmedSchema, schemaPreview } = draft;
  if (!dataSourceId) throw new Error("Setup has not started yet");
  if (!name?.trim()) throw new Error("Connection name is required");
  // empty schema is allowed when the source had no rows at preview time
  // backend activates without saving a schema and flags requiresReview when data first arrives
  const isEmptyPreview = schemaPreview?.isEmpty || (schemaPreview && (schemaPreview.schema?.length ?? 0) === 0);
  if (!isEmptyPreview && !confirmedSchema?.length) {
    throw new Error("Schema has not been reviewed");
  }

  const workspaceId = await getWorkspaceId();
  await apiPost(
    endpoints.modules.day_book.data_sources.activate(dataSourceId),
    { workspaceId, confirmedSchema: confirmedSchema || [], name: name.trim() }
  );

  router.navigate("/modules/day-book/data-management");
  return { dataSourceId };
};

export const adapterDescriptor = {
  type: TYPE,
  aliases: ["custom-api"],
  category: "api",
  factory: createCustomApiAdapter,
  wizard: {
    title: "Custom API",
    initialDraft: { form: {} },
    steps: [
      { key: "connect", title: "Connect", Component: ApiConnectStep },
      {
        key: "field-review",
        title: "Review fields",
        Component: FieldCategoryReviewStep,
        applies: (draft) => Boolean(draft.schemaPreview),
      },
      {
        key: "general-settings",
        title: "Settings",
        Component: GeneralSettingsStep,
        props: {
          ExtraSettings: ApiSettingsExtra,
          finaliseLabel: "Create Connection",
        },
      },
    ],
    finalise: finaliseCustomApi,
  },
};
