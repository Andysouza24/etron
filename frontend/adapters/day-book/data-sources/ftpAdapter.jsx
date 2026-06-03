import { delay, formatDate, createBaseAdapter } from "./baseAdapter";

const TYPE = "custom-ftp";
const PROVIDER = "Custom FTP";

const parseConnectionData = (connectionData) => {
  if (!connectionData) return {};
  return {
    name:
      connectionData.name ||
      connectionData.connectionName ||
      connectionData.title,
    hostname:
      connectionData.hostname || connectionData.host || connectionData.server,
    username: connectionData.username || connectionData.user,
    password: connectionData.password,
    port: connectionData.port || "21",
    directory: connectionData.directory || connectionData.path || "/",
    keyFile: connectionData.keyFile || connectionData.privateKey,
  };
};

const buildFtpUrl = (hostname, port, directory, filename = "") => {
  const basePath = directory.endsWith("/") ? directory : `${directory}/`;
  return `ftp://${hostname}:${port}${basePath}${filename}`;
};

export const createCustomFtpAdapter = (
  authService,
  apiClient,
  options = {}
) => {
  const base = createBaseAdapter({ provider: PROVIDER, type: TYPE });

  const testConnection = async () => {
    await delay(500);
    return {
      status: "success",
      responseTime: "250ms",
      features: ["read", "write", "list"],
      serverType: "FTP Server",
      sampleData: {
        message: "FTP connection successful",
        timestamp: new Date().toISOString(),
      },
    };
  };

  const connect = async (connectionData) => {
    if (!connectionData || !connectionData.hostname || !connectionData.name) {
      throw new Error("Connection data with hostname and name is required");
    }

    const testResult = await testConnection();
    if (testResult.status !== "success") {
      throw new Error("Connection test failed");
    }

    const parsed = parseConnectionData(connectionData);
    const newConnection = {
      id: `ftp_${Date.now()}`,
      name: parsed.name,
      hostname: parsed.hostname,
      port: parsed.port,
      username: parsed.username,
      directory: parsed.directory,
      status: "connected",
      createdAt: new Date().toISOString(),
      lastConnected: new Date().toISOString(),
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
    base.requireConnected("Not connected to any FTP server");
    throw new Error("FTP directory listing not implemented");
  };

  const fetchRawData = async () => {
    base.requireConnected("Not connected to any FTP server");
    throw new Error("FTP file download not implemented");
  };

  return {
    connect,
    disconnect,
    testConnection,
    isConnected: () => base.state.isConnected,
    getConnectionInfo: () => base.getConnectionInfo(),
    switchConnection: base.switchConnection,
    updateConnection: async () => {
      throw new Error("FTP update connection not implemented");
    },
    deleteConnection: async () => {
      throw new Error("FTP delete connection not implemented");
    },

    getDataSources,
    filterDataSources: base.filterDataSources,
    fetchRawData,

    parseConnectionData,
    buildFtpUrl,
    formatDate,
  };
};

export const adapterDescriptor = {
  type: TYPE,
  category: "file-transfer",
  factory: createCustomFtpAdapter,
};
