import React from "react";
import ConnectionDataSourceLayout from "../../../components/modules/day-book/data-sources/ConnectionDataSourceLayout";

import { delay, validateSourceId, formatDate } from "./baseAdapter";

export const createGoogleSheetsAdapter = (
  authService,
  apiClient,
  options = {}
) => {
  // Production-only mode: no demo
  const isDemoMode = false;

  let connectedAccount = null;
  let accessToken = null;
  let isConnected = false;

  const connect = async () => {
    try {
      const cognitoUser = await authService.getCurrentUser();
      if (!cognitoUser) {
        throw new Error("User must be authenticated first");
      }

      const session = await authService.fetchAuthSession();
      const tokens = session.tokens;

      // Optional: record identity details if present
      if (tokens?.idToken?.payload) {
        connectedAccount = {
          email: tokens.idToken.payload.email,
          name: tokens.idToken.payload.name || tokens.idToken.payload.email,
          avatar: tokens.idToken.payload.picture,
          provider: "Google",
        };
      }

      // Exchange Cognito token for Google access token (not implemented here)
      // accessToken = await apiClient.post(...)

      isConnected = true;
      return {
        success: true,
        account: connectedAccount,
      };
    } catch (error) {
      throw new Error(`Google Sheets connect failed: ${error.message}`);
    }
  };

  const disconnect = async () => {
    try {
      if (authService?.signOut) {
        await authService.signOut();
      }
      connectedAccount = null;
      accessToken = null;
      isConnected = false;
      return { success: true };
    } catch (error) {
      throw new Error(`Failed to disconnect: ${error.message}`);
    }
  };

  const getDataSources = async () => {
    if (!isConnected) throw new Error("Not connected to Google Sheets");
    throw new Error("Google Sheets data listing not implemented");
  };

  const getData = async (sourceId, options = {}) => {
    validateSourceId(sourceId);
    if (!isConnected) throw new Error("Not connected to Google Sheets");
    throw new Error("Google Sheets data fetch not implemented");
  };

  const getConnectionInfo = () => ({
    isConnected,
    account: connectedAccount,
    provider: "Google Sheets",
    dataSourceCount: 0,
    isDemoMode: false,
  });

  const switchAccount = async () => {
    await disconnect();
    return { requiresReauth: true };
  };

  const filterDataSources = (query, dataSources = []) => {
    if (!query) return dataSources;
    return dataSources.filter((sheet) =>
      sheet.name.toLowerCase().includes(query.toLowerCase())
    );
  };

  return {
    connect,
    disconnect,
    getDataSources,
    getData,
    isConnected: () => isConnected,
    getConnectionInfo,
    switchAccount,
    filterDataSources,
    formatDate,
  };
};

export const GoogleSheetsConnectionScreen = () => {
  const getItemDescription = (dataSource, formatDateFn) =>
    `Status: ${dataSource.status} • Last Modified: ${formatDateFn(dataSource.lastModified)}`;
  const getItemIcon = () => "google-spreadsheet";

  return (
    <ConnectionDataSourceLayout
      title="Google Sheets"
      adapterType="google-sheets"
      serviceDisplayName="Google Sheets"
      getItemDescription={getItemDescription}
      getItemIcon={getItemIcon}
      showLocationFilter={false}
      searchPlaceholder="Search Google Sheets connections"
      emptyStateMessage="No Google Sheets connections found"
      demoModeMessage="Using sample Google Sheets data for development"
      enablePersistentConnection={true}
      dataSourceName="My Google Sheets Connection"
      dataManagementPath="/modules/day-book/data-management"
    />
  );
};

export const adapterDescriptor = {
  type: "google-sheets",
  category: "cloud-storage",
  factory: createGoogleSheetsAdapter,
  ConnectionScreen: GoogleSheetsConnectionScreen,
};
