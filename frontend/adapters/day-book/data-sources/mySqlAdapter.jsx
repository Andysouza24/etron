import {
  delay,
  validateSourceId,
  formatDate,
  createBaseAdapter,
} from "./baseAdapter";

const TYPE = "mysql";
const PROVIDER = "MySQL";

const normalizeConnectionData = (connectionData) => {
  if (!connectionData) return {};
  return {
    ...connectionData,
    host: connectionData.host || connectionData.hostname,
    port: connectionData.port || 3306,
    username: connectionData.username || "root",
    password: connectionData.password || "",
    database: connectionData.database || connectionData.databaseName || "",
  };
};

export const createMySqlAdapter = (authService, apiClient, options = {}) => {
  const base = createBaseAdapter({ provider: PROVIDER, type: TYPE });

  const testConnection = async (connectionData) => {
    const normalized = normalizeConnectionData(connectionData);
    if (!normalized.host || !normalized.username) {
      throw new Error("Host and username are required for MySQL connection");
    }

    // TODO: Implement real backend test endpoint call
    await delay(500);
    return {
      status: "success",
      responseTime: "120ms",
      statusCode: 200,
      contentType: "mysql",
      sampleData: {
        message: "MySQL connection successful",
        timestamp: new Date().toISOString(),
        host: normalized.host,
        database: normalized.database,
      },
    };
  };

  const connect = async (connectionData) => {
    const normalized = normalizeConnectionData(connectionData);
    if (!normalized.host || !connectionData?.name || !normalized.username) {
      throw new Error(
        "Connection data with host, name, and username is required"
      );
    }

    const testResult = await testConnection(normalized);
    if (testResult.status !== "success") {
      throw new Error("Connection test failed");
    }

    const newConnection = {
      id: `mysql_${Date.now()}`,
      name: connectionData.name,
      host: normalized.host,
      port: normalized.port,
      username: normalized.username,
      database: normalized.database,
      password: normalized.password,
      status: "active",
      createdAt: new Date().toISOString(),
      lastTested: new Date().toISOString(),
      testResult,
    };

    base.setCurrentConnection(newConnection);
    return { success: true, connection: newConnection };
  };

  const disconnect = async () => {
    base.clear();
    return { success: true };
  };

  const getDataSources = async () => {
    base.requireConnected("Not connected to any MySQL server");
    throw new Error("MySQL table listing not implemented");
  };

  const getData = async (sourceId) => {
    validateSourceId(sourceId);
    base.requireConnected("Not connected to any MySQL server");
    throw new Error("MySQL query not implemented in mobile adapter");
  };

  return {
    connect,
    disconnect,
    testConnection,
    getDataSources,
    getData,
    isConnected: () => base.state.isConnected,
    getConnectionInfo: () => base.getConnectionInfo(),
    switchConnection: base.switchConnection,
    updateConnection: async () => {
      throw new Error("MySQL update connection not implemented");
    },
    deleteConnection: async () => {
      throw new Error("MySQL delete connection not implemented");
    },
    filterDataSources: base.filterDataSources,
    formatDate,
  };
};

export const adapterDescriptor = {
  type: TYPE,
  category: "database",
  factory: createMySqlAdapter,
};
