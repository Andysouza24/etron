// frontend adapter for the "micromax-dashboard" connection type
// no config and no secrets

const SOURCE_TYPE = "micromax-dashboard";
const EXPORT_PREFIX = "exports/";
const FILE_NAME_PATTERN = /^[A-Za-z0-9._-]+\.json$/;

const buildObjectKey = (fileName) => {
  if (!fileName || !FILE_NAME_PATTERN.test(fileName)) {
    throw new Error("fileName must match /^[A-Za-z0-9._-]+\\.json$/");
  }
  return `${EXPORT_PREFIX}${fileName}`;
};

const parseObjectKey = (key) => {
  if (!key || !key.startsWith(EXPORT_PREFIX)) return null;
  const fileName = key.slice(EXPORT_PREFIX.length);
  if (!fileName || fileName.includes("/")) return null;
  if (!FILE_NAME_PATTERN.test(fileName)) return null;
  return { fileName };
};

export const createMicromaxDashboardAdapter = (
  authService,
  apiClient,
  options = {}
) => {
  let currentConnection = null;
  let isConnected = false;

  const connect = async (connectionData = {}) => {
    const newConnection = {
      id: `micromax-dashboard_${Date.now()}`,
      name: connectionData.name || "Micromax Dashboard",
      status: "connected",
      createdAt: new Date().toISOString(),
    };
    currentConnection = newConnection;
    isConnected = true;
    return { connected: true, connection: currentConnection };
  };

  const disconnect = async () => {
    currentConnection = null;
    isConnected = false;
    return { connected: true };
  };

  // The parent connection has no endpoint to ping; the backend manages the
  // ingest pipeline. Return a success result so that flows that rely on a
  // local test still resolve.
  const testConnection = async () => ({
    status: "success",
    sampleData: {
      message:
        "Micromax Dashboard connection has no local endpoint. Files are imported automatically.",
      timestamp: new Date().toISOString(),
    },
  });

  // Child file data sources are created by the backend ingest pipeline. The
  // parent never exposes its own data sources from the frontend.
  const getDataSources = async () => {
    if (!isConnected) {
      throw new Error("Not connected to Micromax Dashboard");
    }
    return [];
  };

  // The parent never holds row data. Direct fetches should go through the
  // child `micromax-dashboard-file` adapter or the backend `viewData`
  // endpoint.
  const fetchRawData = async () => {
    throw new Error(
      "Micromax Dashboard parent connection holds no data; fetch from a child file data source instead."
    );
  };

  return {
    type: SOURCE_TYPE,
    connect,
    disconnect,
    testConnection,
    getDataSources,
    fetchRawData,
    getCurrentConnection: () => currentConnection,
    isConnected: () => isConnected,
    // Expose helpers so other modules can build/parse object keys consistently.
    EXPORT_PREFIX,
    FILE_NAME_PATTERN,
    buildObjectKey,
    parseObjectKey,
  };
};

export {
  SOURCE_TYPE,
  EXPORT_PREFIX,
  FILE_NAME_PATTERN,
  buildObjectKey,
  parseObjectKey,
};
