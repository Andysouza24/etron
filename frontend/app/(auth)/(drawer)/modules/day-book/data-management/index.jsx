// Author(s): Holly Wyatt, Noah Bradley

import { useState, useRef, useCallback } from "react";
import { Alert } from "react-native";
import { router, useFocusEffect } from "expo-router";

import Header from "../../../../../../components/layout/Header";
import ResponsiveScreen from "../../../../../../components/layout/ResponsiveScreen";
import DataPreviewModal from "../../../../../../components/modules/day-book/data-sources/DataPreviewModal";
import DataSourcesErrorState from "../../../../../../components/modules/day-book/data-sources/DataSourcesErrorState";
import DataSourcesList from "../../../../../../components/modules/day-book/data-sources/DataSourcesList";

import endpoints from "../../../../../../utils/api/endpoints";
import { apiPost, apiDelete } from "../../../../../../utils/api/apiClient";
import { getWorkspaceId } from "../../../../../../storage/workspaceStorage";
import { useDataSourceContext } from "../../../../../../contexts/DataSourceContext";
import { useHasPermission } from "../../../../../../hooks/useHasPermission";
import useDataPreview from "../../../../../../hooks/modules/day_book/data-sources/useDataPreview";

const MICROMAX_PARENT_TYPE = "micromax-dashboard";

const DataManagement = () => {
	const {
		dataSources: ctxDataSources,
		system,
		refreshDataSources: ctxRefresh,
		refreshDashboardRawData,
	} = useDataSourceContext();
	const dataSourcesList = ctxDataSources.list;
	const loading = system.isLoading && dataSourcesList.length === 0;
	const hasError = system.hasError;
	const error = system.error || "";
	const { allowed: viewDataPermission } = useHasPermission("modules.daybook.datasources.view_data");
	const { allowed: manageDataSourcesPermission } = useHasPermission("modules.daybook.datasources.manage_dataSources");

	const [isRefreshing, setIsRefreshing] = useState(false);
	const [lastManualRefresh, setLastManualRefresh] = useState(0);
	const [workspaceId, setWorkspaceId] = useState(null);
	const [refreshingSourceId, setRefreshingSourceId] = useState(null);

	const {
		previewOpen,
		previewStatus,
		previewSchema,
		previewRows,
		openPreview,
		dismissPreview,
	} = useDataPreview(workspaceId);

	const hasInitiallyLoadedRef = useRef(false);

	const fetchDataSources = useCallback(async () => {
		try {
			const wid = await getWorkspaceId();
			setWorkspaceId(wid);
			await ctxRefresh();
		} catch (err) {
			console.error("[DataManagement] fetchDataSources:", err);
		}
	}, [ctxRefresh]);

	useFocusEffect(
		useCallback(() => {
			if (!hasInitiallyLoadedRef.current) {
				fetchDataSources();
				hasInitiallyLoadedRef.current = true;
			}
		}, [fetchDataSources])
	);

	const handleRefresh = useCallback(async () => {
		try {
			setIsRefreshing(true);
			await fetchDataSources();
			setLastManualRefresh(Date.now());
		} catch (err) {
			console.error("[DataManagement] handleRefresh:", err);
			Alert.alert("Refresh failed", "Unable to refresh data sources.");
		} finally {
			setIsRefreshing(false);
		}
	}, [fetchDataSources]);

	const activeCount = dataSourcesList.filter((s) => {
		const st = (s.status || "").toLowerCase();
		return st === "active" || st === "connected";
	}).length;
	const errorCount = dataSourcesList.filter(
		(s) => (s.status || "").toLowerCase() === "error"
	).length;

	const handleDisconnectSource = useCallback((source) => {
		Alert.alert(
			"Disconnect data source",
			`Are you sure you want to disconnect "${source.name || source.dataSourceId}"?`,
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Disconnect",
					style: "destructive",
					onPress: async () => {
						setIsRefreshing(true);
						try {
							await apiDelete(
								endpoints.modules.day_book.data_sources.removeDataSource(source.dataSourceId),
								{ workspaceId }
							);
							await fetchDataSources();
						} catch (err) {
							console.error("[DataManagement] handleDisconnectSource:", err);
							Alert.alert("Error", String(err));
						} finally {
							setIsRefreshing(false);
						}
					},
				},
			]
		);
	}, [fetchDataSources, workspaceId]);

	const handleTestConnection = useCallback(async (source) => {
		try {
			const body = {
				sourceType: source.sourceType || source.type,
				config: source.config ?? {},
				secrets: source.secrets ?? {},
			};
			await apiPost(endpoints.modules.day_book.data_sources.testConnection, body);
			Alert.alert("Test Connection", "Connection test requested.");
		} catch (err) {
			console.error("[DataManagement] handleTestConnection:", err);
			Alert.alert("Error", String(err));
		}
	}, []);

	const navigateToViewSource = useCallback((source) => {
		router.navigate(`/modules/day-book/data-management/view-data-source/${source.dataSourceId}`);
	}, []);

	const navigateToEditSource = useCallback((source) => {
		router.navigate(`/modules/day-book/data-management/edit-data-source/${source.dataSourceId}`);
	}, []);

	const openMicromaxSettings = useCallback(() => {
		const micromaxParent = dataSourcesList.find(
			(source) => (source.sourceType || source.type) === MICROMAX_PARENT_TYPE
		);
		if (!micromaxParent) return;
		router.navigate(
			`/modules/day-book/data-management/micromax-dashboard-settings/${micromaxParent.dataSourceId}`
		);
	}, [dataSourcesList]);

	const handleRescanFile = useCallback(async (source) => {
		if (!source?.dataSourceId) return;
		setRefreshingSourceId(source.dataSourceId);
		try {
			await refreshDashboardRawData(source.dataSourceId);
			Alert.alert(
				"Refresh started",
				`${source.name} will update once processing completes.`
			);
		} catch (err) {
			console.error("[DataManagement] handleRescanFile:", err);
			Alert.alert("Refresh failed", err?.message || "Unable to refresh this file.");
		} finally {
			setRefreshingSourceId(null);
		}
	}, [refreshDashboardRawData]);

	const body = hasError ? (
		<DataSourcesErrorState message={error} onRetry={handleRefresh} />
	) : (
		<DataSourcesList
			dataSources={dataSourcesList}
			activeCount={activeCount}
			errorCount={errorCount}
			lastRefreshAt={lastManualRefresh}
			refreshingSourceId={refreshingSourceId}
			loading={loading}
			isRefreshing={isRefreshing}
			onRefresh={handleRefresh}
			viewDataAllowed={viewDataPermission}
			manageDataSourcesAllowed={manageDataSourcesPermission}
			onNavigateToView={navigateToViewSource}
			onNavigateToEdit={navigateToEditSource}
			onDisconnect={handleDisconnectSource}
			onTest={handleTestConnection}
			onPreview={openPreview}
			onRescan={handleRescanFile}
			onOpenMicromaxSettings={openMicromaxSettings}
		/>
	);

	return (
		<ResponsiveScreen
			header={
				<Header
					title="Data Management"
					showMenu
					showPlus
					onRightIconPress={() =>
						router.navigate("/modules/day-book/data-management/create-data-connection")
					}
					rightIconPermission={manageDataSourcesPermission}
				/>
			}
			scroll={false}
			padded={false}
			center={false}
			tapToDismissKeyboard={false}
			loadingOverlayActive={loading}
		>
			{body}
			<DataPreviewModal
				visible={previewOpen}
				status={previewStatus}
				schema={previewSchema}
				rows={previewRows}
				onDismiss={dismissPreview}
			/>
		</ResponsiveScreen>
	);
};

export default DataManagement;
