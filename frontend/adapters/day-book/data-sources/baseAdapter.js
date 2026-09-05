// shared utilities and a composable base adapter
// common states -> connections list, current connection, isConnected
// exposes overrrideable hooks

export const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const validateSourceId = (sourceId) => {
  if (!sourceId) {
    throw new Error("Source ID is required");
  }
};

export const formatDate = (dateString) => {
  const date = new Date(dateString);
  return (
    date.toLocaleDateString() +
    " " +
    date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  );
};

export const validateConnectionData = (connectionData, requiredFields) => {
  const missing = requiredFields.filter(
    (field) => !connectionData[field]?.trim()
  );
  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(", ")}`);
  }
};

export const sanitizeConnectionData = (connectionData) => {
  const sanitized = {};
  Object.keys(connectionData).forEach((key) => {
    const value = connectionData[key];
    sanitized[key] = typeof value === "string" ? value.trim() : value;
  });
  return sanitized;
};

export const createConnectionId = (type, connectionData) => {
  const timestamp = Date.now();
  const identifier =
    connectionData.name ||
    connectionData.url ||
    connectionData.hostname ||
    "connection";
  const sanitized = identifier.toLowerCase().replace(/[^a-z0-9]/g, "-");
  return `${type}-${sanitized}-${timestamp}`;
};

export const validateUrl = (url) => {
  try {
    const parsed = new URL(url);
    return {
      isValid: true,
      protocol: parsed.protocol,
      hostname: parsed.hostname,
      port: parsed.port,
    };
  } catch (error) {
    return { isValid: false, error: error.message };
  }
};

export const createTestResult = (success, data = {}, error = null) => {
  return {
    status: success ? "success" : "error",
    timestamp: new Date().toISOString(),
    data: success ? data : null,
    error: error ? error.message || error : null,
    ...data,
  };
};

// Default search filter used by connection-list adapters
// Concrete adapters can override `filterDataSources` if they need richer matching
const defaultFilterDataSources = (query, dataSources = []) => {
  if (!query) return dataSources;
  const q = String(query).toLowerCase();
  return dataSources.filter((source) => {
    const name = source?.name?.toLowerCase?.() || "";
    const path = source?.path?.toLowerCase?.() || "";
    const type = source?.type?.toLowerCase?.() || "";
    return name.includes(q) || path.includes(q) || type.includes(q);
  });
};

// Composable base for connection-style adapters (api, ftp, mysql, ...)
// Returns a state record with helpers that mutate it.
// Concrete adapters destructure the helpers they want and add provider-specific behaviour
export const createBaseAdapter = ({ provider, type } = {}) => {
  const state = {
    connections: [],
    currentConnection: null,
    isConnected: false,
  };

  const setCurrentConnection = (connection) => {
    state.currentConnection = connection;
    state.isConnected = !!connection;
    if (connection) {
      state.connections = [
        connection,
        ...state.connections.filter((c) => c.id !== connection.id),
      ];
    }
  };

  const clear = () => {
    state.currentConnection = null;
    state.connections = [];
    state.isConnected = false;
  };

  const switchConnection = async (connectionId) => {
    const connection = state.connections.find((c) => c.id === connectionId);
    if (!connection) {
      throw new Error("Connection not found");
    }
    state.currentConnection = connection;
    state.isConnected = true;
    return { success: true, connected: true, connection };
  };

  const getConnectionInfo = (extra = {}) => ({
    isConnected: state.isConnected,
    connection: state.currentConnection,
    provider,
    dataSourceCount: state.connections.length,
    isDemoMode: false,
    ...extra,
  });

  const requireConnected = (message) => {
    if (!state.isConnected) {
      throw new Error(message || `Not connected to ${provider || type}`);
    }
  };

  return {
    state,
    setCurrentConnection,
    clear,
    switchConnection,
    getConnectionInfo,
    requireConnected,
    filterDataSources: defaultFilterDataSources,
  };
};
