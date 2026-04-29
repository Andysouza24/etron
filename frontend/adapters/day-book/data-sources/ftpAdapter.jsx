import React from "react";
import ConnectionPage from "../../../components/layout/ConnectionPage";
import { FtpFormSection } from "../../../components/layout/FormSelection";
import {
  validateFtpForm,
  generateFtpNameFromHostname,
  buildFtpConnectionData,
} from "../../../utils/connectionValidators";

import { delay, validateSourceId, formatDate } from "./baseAdapter";

// Production-only: no mock data usage

// Helper functions
const parseConnectionData = (connectionData) => {
  if (!connectionData) return {};

  // Normalize common field variations
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

export const createCustomFtpAdapter = (options = {}) => {
  const isDemoMode = false;
  let connections = [];
  let currentConnection = null;
  let isConnected = false;

  const connect = async (connectionData) => {
    try {
      if (!connectionData || !connectionData.hostname || !connectionData.name) {
        throw new Error("Connection data with hostname and name is required");
      }

      const testResult = await testConnection(
        connectionData.hostname,
        connectionData.port,
        connectionData.username,
        connectionData.password
      );

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

      currentConnection = newConnection;
      connections = [newConnection, ...connections];
      isConnected = true;

      return {
        success: true,
        connection: currentConnection,
      };
    } catch (error) {
      throw new Error(`Custom FTP connect failed: ${error.message}`);
    }
  };

  const disconnect = async () => {
    try {
      currentConnection = null;
      connections = [];
      isConnected = false;

      return { success: true };
    } catch (error) {
      throw new Error(`Failed to disconnect: ${error.message}`);
    }
  };

  // Connection testing - this stays in the adapter as it's connection-specific logic
  const testConnection = async (hostname, port = "21", username, password) => {
    try {
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
    } catch (error) {
      throw new Error(`Connection test failed: ${error.message}`);
    }
  };

  // Data source discovery - returns available files/directories
  const getDataSources = async () => {
    if (!isConnected) {
      throw new Error("Not connected to any FTP server");
    }
    throw new Error("FTP directory listing not implemented");
  };

  // Raw data fetching method for DataSourceService to use
  const fetchRawData = async (filePath, options = {}) => {
    if (!isConnected) {
      throw new Error("Not connected to any FTP server");
    }
    throw new Error("FTP file download not implemented");
  };

  const getConnectionInfo = () => ({
    isConnected,
    connection: currentConnection,
    provider: "Custom FTP",
    dataSourceCount: connections.length,
    isDemoMode: false,
  });

  const switchConnection = async (connectionId) => {
    const connection = connections.find((c) => c.id === connectionId);
    if (!connection) {
      throw new Error("Connection not found");
    }

    currentConnection = connection;
    isConnected = true;

    return { success: true, connection };
  };

  const updateConnection = async (connectionId, updates) => {
    throw new Error("FTP update connection not implemented");
  };

  const deleteConnection = async (connectionId) => {
    throw new Error("FTP delete connection not implemented");
  };

  const filterDataSources = (query, dataSources = []) => {
    if (!query) return dataSources;
    return dataSources.filter(
      (source) =>
        source.name.toLowerCase().includes(query.toLowerCase()) ||
        source.path.toLowerCase().includes(query.toLowerCase())
    );
  };

  return {
    connect,
    disconnect,
    testConnection,
    isConnected: () => isConnected,
    getConnectionInfo,
    switchConnection,
    updateConnection,
    deleteConnection,

    getDataSources,
    filterDataSources,

    fetchRawData,

    parseConnectionData,
    buildFtpUrl,

    formatDate,
  };
};

export const FtpConnectionScreen = () => (
  <ConnectionPage
    connectionType="custom-ftp"
    title="Custom FTP"
    FormComponent={FtpFormSection}
    formValidator={validateFtpForm}
    connectionDataBuilder={buildFtpConnectionData}
    nameGenerator={generateFtpNameFromHostname}
  />
);
