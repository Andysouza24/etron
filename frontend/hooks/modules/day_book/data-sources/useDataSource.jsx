import { useMemo } from "react";
import DataSourceService from "../../../../services/DataSourceService";
import apiClient from "../../../../utils/api/apiClient";

// singleton service instance
const dataSourceService = new DataSourceService(apiClient);

export default function useDataSource() {
  // memoize bound methods so their identities are stable across renders
  const getConnectedDataSources = useMemo(
    () => dataSourceService.getConnectedDataSources.bind(dataSourceService),
    []
  );
  const connectDataSource = useMemo(
    () => dataSourceService.connectDataSource.bind(dataSourceService),
    []
  );
  const updateDataSource = useMemo(
    () => dataSourceService.updateDataSource.bind(dataSourceService),
    []
  );
  const disconnectDataSource = useMemo(
    () => dataSourceService.disconnectDataSource.bind(dataSourceService),
    []
  );
  const getDataSource = useMemo(
    () => dataSourceService.getDataSource.bind(dataSourceService),
    []
  );
  const fetchDataFromSource = useMemo(
    () => dataSourceService.fetchDataFromSource.bind(dataSourceService),
    []
  );
  const getErrorContext = useMemo(
    () => dataSourceService.getErrorContext.bind(dataSourceService),
    []
  );
  const resolveError = useMemo(
    () => dataSourceService.resolveError.bind(dataSourceService),
    []
  );
  const refreshFromDefaultSchema = useMemo(
    () => dataSourceService.refreshFromDefaultSchema.bind(dataSourceService),
    []
  );

  // Alias expected by some screens
  const fetchDataSource = fetchDataFromSource;

  return {
    getConnectedDataSources,
    connectDataSource,
    updateDataSource,
    disconnectDataSource,
    getDataSource,
    fetchDataFromSource,
    fetchDataSource,
    getErrorContext,
    resolveError,
    refreshFromDefaultSchema,
    dataSourceService,
  };
}