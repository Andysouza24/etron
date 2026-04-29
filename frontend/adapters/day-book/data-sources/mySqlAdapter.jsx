import React from "react";
import ConnectionPage from "../../../components/layout/ConnectionPage";
import { MySqlFormSection } from "../../../components/layout/FormSelection";
import {
  validateMySqlForm,
  generateMySqlNameFromHostname,
  buildMySqlConnectionData,
} from "../../../utils/connectionValidators";

import { delay, validateSourceId, formatDate } from "./baseAdapter";

const parseConnectionConfig = (config) => {
  if (!config) return {};
  return {
    host: config.host || config.hostname || "localhost",
    port: config.port || 3306,
    username: config.username || "root",
    password: config.password || "",
    database: config.database || config.databaseName || "",
  };
};

export const createMySqlAdapter = (authService, apiClient, options = {}) => {
  const isDemoMode = false;
  const endpoints = options.endpoints || {};

  let connections = [];
  let currentConnection = null;
  let isConnected = false;

  const connect = async (connectionData) => {
    try {
      // Accept either host or hostname from UI/service
      if (connectionData && !connectionData.host && connectionData.hostname) {
        connectionData.host = connectionData.hostname;
      }
      if (
        !connectionData ||
        !connectionData.host ||
        !connectionData.name ||
        !connectionData.username
      ) {
        throw new Error(
          "Connection data with host, name, and username is required"
        );
      }

      const testResult = await testConnection(connectionData);

      if (testResult.status !== "success") {
        throw new Error("Connection test failed");
      }

      const newConnection = {
        id: `mysql_${Date.now()}`,
        name: connectionData.name,
        host: connectionData.host || connectionData.hostname,
        port: connectionData.port || 3306,
        username: connectionData.username || "root",
        database: connectionData.database || connectionData.databaseName || "",
        status: "active",
        createdAt: new Date().toISOString(),
        lastTested: new Date().toISOString(),
        password: connectionData.password || "",
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
      throw new Error(`MySQL connect failed: ${error.message}`);
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

  const testConnection = async (connectionData) => {
    try {
      // Normalize hostname -> host for convenience
      if (connectionData && !connectionData.host && connectionData.hostname) {
        connectionData.host = connectionData.hostname;
      }
      const {
        host,
        port = 3306,
        username = "root",
        password = "",
        database = "",
      } = connectionData || {};

      if (!host || !username) {
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
          host,
          database,
        },
      };
    } catch (error) {
      throw new Error(`Connection test failed: ${error.message}`);
    }
  };

  const getDataSources = async () => {
    if (!isConnected) {
      throw new Error("Not connected to any MySQL server");
    }
    throw new Error("MySQL table listing not implemented");
  };

  const getData = async (sourceId, options = {}) => {
    validateSourceId(sourceId);

    if (!isConnected) {
      throw new Error("Not connected to any MySQL server");
    }

    // Not implemented on client; should be handled by backend service
    throw new Error("MySQL query not implemented in mobile adapter");
  };

  const getConnectionInfo = () => ({
    isConnected,
    connection: currentConnection,
    provider: "MySQL",
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
    throw new Error("MySQL update connection not implemented");
  };

  const deleteConnection = async (connectionId) => {
    throw new Error("MySQL delete connection not implemented");
  };

  const filterDataSources = (query, dataSources = []) => {
    if (!query) return dataSources;
    return dataSources.filter((source) =>
      source.name.toLowerCase().includes(query.toLowerCase())
    );
  };

  return {
    connect,
    disconnect,
    testConnection,
    getDataSources,
    getData,
    isConnected: () => isConnected,
    getConnectionInfo,
    switchConnection,
    updateConnection,
    deleteConnection,
    filterDataSources,
    formatDate,
  };
};

export const MySqlConnectionScreen = () => (
  <ConnectionPage
    connectionType="mysql"
    title="MySQL Database"
    FormComponent={MySqlFormSection}
    formValidator={validateMySqlForm}
    connectionDataBuilder={buildMySqlConnectionData}
    nameGenerator={generateMySqlNameFromHostname}
  />
);
