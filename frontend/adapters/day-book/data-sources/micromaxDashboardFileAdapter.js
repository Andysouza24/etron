// frontend adapter for the "micromax-dashboard-file" data source type
// each instance is a separate file under the micromax dashboard data source

import {
  EXPORT_PREFIX,
  FILE_NAME_PATTERN,
  buildObjectKey,
  parseObjectKey,
} from "./micromaxDashboardAdapter";

const SOURCE_TYPE = "micromax-dashboard-file";
const PARENT_SOURCE_TYPE = "micromax-dashboard";

const validateConfig = (config) => {
  if (!config || typeof config !== "object") {
    return { valid: false, error: "config is required" };
  }
  if (!config.fileName || typeof config.fileName !== "string") {
    return { valid: false, error: "config.fileName is required" };
  }
  if (!FILE_NAME_PATTERN.test(config.fileName)) {
    return { valid: false, error: "config.fileName must be a flat .json filename" };
  }
  if (!config.parentDataSourceId || typeof config.parentDataSourceId !== "string") {
    return { valid: false, error: "config.parentDataSourceId is required" };
  }
  return { valid: true };
};

export const createMicromaxDashboardFileAdapter = (
  authService,
  apiClient,
  options = {}
) => {
  const config = options?.config || {};
  let currentConnection = config.fileName
    ? {
        id: options?.dataSourceId || `micromax-dashboard-file_${Date.now()}`,
        name: config.fileName,
        fileName: config.fileName,
        parentDataSourceId: config.parentDataSourceId,
        objectKey: config.fileName ? buildObjectKey(config.fileName) : null,
        status: "connected",
      }
    : null;

  // Children are created by the backend pipeline; the frontend never connects
  // a child directly. These hooks exist purely to satisfy the adapter
  // contract.
  const connect = async () => {
    throw new Error(
      "micromax-dashboard-file data sources are created automatically by the backend ingest pipeline."
    );
  };

  const disconnect = async () => {
    currentConnection = null;
    return { connected: true };
  };

  const testConnection = async () => {
    const validation = validateConfig(config);
    if (!validation.valid) {
      throw new Error(`Connection test failed: ${validation.error}`);
    }
    return {
      status: "success",
      sampleData: {
        message: `Bound to ${buildObjectKey(config.fileName)}`,
        timestamp: new Date().toISOString(),
      },
    };
  };

  const getDataSources = async () => {
    if (!currentConnection) return [];
    return [
      {
        id: currentConnection.id,
        name: currentConnection.name,
        type: SOURCE_TYPE,
        fileName: currentConnection.fileName,
        objectKey: currentConnection.objectKey,
        parentDataSourceId: currentConnection.parentDataSourceId,
      },
    ];
  };

  // Row data is fetched server-side via the `viewData` endpoint. Calling
  // `fetchRawData` against this adapter is unsupported.
  const fetchRawData = async () => {
    throw new Error(
      "micromax-dashboard-file data is served by the backend viewData endpoint; this adapter does not fetch raw data."
    );
  };

  return {
    type: SOURCE_TYPE,
    parentType: PARENT_SOURCE_TYPE,
    connect,
    disconnect,
    testConnection,
    getDataSources,
    fetchRawData,
    getCurrentConnection: () => currentConnection,
    isConnected: () => !!currentConnection,
    validateConfig,
    EXPORT_PREFIX,
    FILE_NAME_PATTERN,
    buildObjectKey,
    parseObjectKey,
  };
};

export {
  SOURCE_TYPE,
  PARENT_SOURCE_TYPE,
  EXPORT_PREFIX,
  FILE_NAME_PATTERN,
  validateConfig,
  buildObjectKey,
  parseObjectKey,
};

export const adapterDescriptor = {
  type: SOURCE_TYPE,
  category: "micromax-dashboard",
  factory: createMicromaxDashboardFileAdapter,
  // No standalone connection screen — children are created by the backend.
  ConnectionScreen: null,
};
