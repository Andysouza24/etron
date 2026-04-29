import React from "react";
import ConnectionDataSourceLayout from "../../../components/layout/ConnectionDataSourceLayout";

import { delay, validateSourceId, formatDate } from "./baseAdapter";

export const createExcelAdapter = (authService, apiClient, options = {}) => {
  // Production-only mode
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

      if (tokens?.idToken?.payload) {
        connectedAccount = {
          email: tokens.idToken.payload.email,
          name: tokens.idToken.payload.name || tokens.idToken.payload.email,
          avatar: tokens.idToken.payload.picture,
          provider: "Microsoft",
        };
      }

      // accessToken = await apiClient.post(...)

      isConnected = true;
      return {
        success: true,
        account: connectedAccount,
      };
    } catch (error) {
      throw new Error(`Microsoft Excel connect failed: ${error.message}`);
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
    if (!isConnected) {
      throw new Error("Not connected to Microsoft Excel");
    }
    throw new Error("Microsoft Excel data listing not implemented");
  };

  const getData = async (sourceId, options = {}) => {
    validateSourceId(sourceId);
    if (!isConnected) {
      throw new Error("Not connected to Microsoft Excel");
    }
    throw new Error("Microsoft Excel data fetch not implemented");
  };

  const getWorksheets = async (sourceId) => {
    validateSourceId(sourceId);
    if (!isConnected) {
      throw new Error("Not connected to Microsoft Excel");
    }
    throw new Error("Microsoft Excel worksheet listing not implemented");
  };

  const getConnectionInfo = () => ({
    isConnected,
    account: connectedAccount,
    provider: "Microsoft Excel",
    dataSourceCount: 0,
    isDemoMode: false,
    supportedFileTypes: [".xlsx", ".xls"],
    supportedLocations: ["OneDrive", "SharePoint"],
  });

  const switchAccount = async () => {
    await disconnect();
    return { requiresReauth: true };
  };

  const filterDataSources = (
    query,
    dataSources = [],
    locationFilter = "All"
  ) => {
    let filtered = dataSources;
    if (query) {
      filtered = filtered.filter((sheet) =>
        sheet.name.toLowerCase().includes(query.toLowerCase())
      );
    }
    if (locationFilter && locationFilter !== "All") {
      filtered = filtered.filter((sheet) => sheet.location === locationFilter);
    }
    return filtered;
  };

  const getFilterOptions = () => {
    return [
      { label: "All", count: 0, value: "All" },
      { label: "OneDrive", count: 0, value: "OneDrive" },
      { label: "SharePoint", count: 0, value: "SharePoint" },
    ];
  };

  return {
    connect,
    disconnect,
    getDataSources,
    getData,
    getWorksheets,
    isConnected: () => isConnected,
    getConnectionInfo,
    switchAccount,
    filterDataSources,
    getFilterOptions,
    formatDate,
  };
};

export const ExcelConnectionScreen = () => {
  const getItemDescription = (dataSource, formatDateFn) =>
    `Status: ${dataSource.status} • Last Modified: ${formatDateFn(dataSource.lastModified)}`;
  const getItemIcon = () => "microsoft-excel";

  return (
    <ConnectionDataSourceLayout
      title="Excel"
      adapterType="microsoft-excel"
      serviceDisplayName="Microsoft Excel"
      getItemDescription={getItemDescription}
      getItemIcon={getItemIcon}
      showLocationFilter={false}
      searchPlaceholder="Search Excel connections"
      emptyStateMessage="No Excel connections found"
      demoModeMessage="Using sample Excel files for development"
      enablePersistentConnection={true}
      dataSourceName="My Excel Connection"
      dataManagementPath="/modules/day-book/data-management"
    />
  );
};

export const adapterDescriptor = {
  type: "microsoft-excel",
  category: "cloud-storage",
  factory: createExcelAdapter,
  ConnectionScreen: ExcelConnectionScreen,
};
