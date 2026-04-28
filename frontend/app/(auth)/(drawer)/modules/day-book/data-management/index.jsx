// Author(s): Holly Wyatt, Noah Bradley

import { useState, useRef, useCallback, useEffect } from "react";
import { RefreshControl, Alert, ScrollView, View, StyleSheet } from "react-native";
import { router, useFocusEffect } from "expo-router";

import Header from "../../../../../../components/layout/Header";
import ResponsiveScreen from "../../../../../../components/layout/ResponsiveScreen";
import DataConnectionCard from "../../../../../../components/modules/day-book/data-sources/DataConnectionCard";
import DataPreviewModal from "../../../../../../components/modules/day-book/data-sources/DataPreviewModal";
import DataSourceCategorySection from "../../../../../../components/modules/day-book/data-sources/DataSourceCategorySection";
import DataSourcesSummary from "../../../../../../components/modules/day-book/data-sources/DataSourcesSummary";
import DataSourcesEmptyState from "../../../../../../components/modules/day-book/data-sources/DataSourcesEmptyState";
import DataSourcesErrorState from "../../../../../../components/modules/day-book/data-sources/DataSourcesErrorState";

import endpoints from "../../../../../../utils/api/endpoints";
import { apiPost, apiDelete } from "../../../../../../utils/api/apiClient";
import formatRelativeTime from "../../../../../../utils/format/formatRelativeTime";
import { getWorkspaceId } from "../../../../../../storage/workspaceStorage";
import { useDataSourceContext } from "../../../../../../contexts/DataSourceContext";
import { getAdapterInfo } from "../../../../../../adapters/day-book/data-sources/DataAdapterFactory";
import { useHasPermission } from "../../../../../../hooks/useHasPermission";
import useDataPreview from "../../../../../../hooks/modules/day_book/data-sources/useDataPreview";

const MICROMAX_PARENT_TYPE = "micromax-dashboard";
const MICROMAX_FILE_TYPE = "micromax-dashboard-file";
const PROCESSING_REFRESH_INTERVAL_MS = 3000;

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

	// While any source is processing, refresh periodically to keep progress bars updating.
	const anyProcessing = dataSourcesList.some(
		(s) => (s.status || "").toLowerCase() === "processing"
	);
	useEffect(() => {
		if (!anyProcessing) return undefined;
		const interval = setInterval(() => {
			ctxRefresh().catch(() => {});
		}, PROCESSING_REFRESH_INTERVAL_MS);
		return () => clearInterval(interval);
	}, [anyProcessing, ctxRefresh]);

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

	// Keep the parent Micromax record out of the card grid but expose a category-level settings button.
	const micromaxParent = dataSourcesList.find(
		(source) => (source.sourceType || source.type) === MICROMAX_PARENT_TYPE
	);

	const visibleSources = dataSourcesList.filter(
		(source) => (source.sourceType || source.type) !== MICROMAX_PARENT_TYPE
	);

	const groupedSources = visibleSources.reduce((acc, source) => {
		const adapterInfo = getAdapterInfo(source.sourceType || source.type);
		const category = adapterInfo?.category || "other";
		if (!acc[category]) acc[category] = [];
		acc[category].push(source);
		return acc;
	}, {});

	if (micromaxParent && !groupedSources[MICROMAX_PARENT_TYPE]) {
		groupedSources[MICROMAX_PARENT_TYPE] = [];
	}

	const openMicromaxSettings = () => {
		if (!micromaxParent) return;
		router.navigate(
			`/modules/day-book/data-management/micromax-dashboard-settings/${micromaxParent.dataSourceId}`
		);
	};

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

	const renderDataSourceCard = (source) => {
		const adapterInfo = getAdapterInfo(source.sourceType || source.type);
		if (!adapterInfo) return null;

		const sourceType = source.sourceType || source.type;
		const isMicromaxFile = sourceType === MICROMAX_FILE_TYPE;
		const isRefreshingThis = refreshingSourceId === source.dataSourceId;

		const typeLabel = adapterInfo.displayName || adapterInfo.name || sourceType;
		const lastSyncText = source.lastUpdate ? `Last sync: ${formatRelativeTime(source.lastUpdate)}` : undefined;
		const subtitle = isRefreshingThis
			? `${typeLabel} - Refreshing...`
			: lastSyncText
				? `${typeLabel} - ${lastSyncText}`
				: typeLabel;

		return (
			<View key={source.dataSourceId} style={styles.cardSpacing}>
				<DataConnectionCard
					label={source.name}
					subtitle={subtitle}
					status={source.status}
					progressStage={source.progressStage}
					progressPercent={source.progressPercent}
					onNavigate={() => navigateToViewSource(source)}
					onDelete={isMicromaxFile ? undefined : () => handleDisconnectSource(source)}
					onTest={isMicromaxFile ? undefined : () => handleTestConnection(source)}
					onSettings={() => navigateToEditSource(source)}
					onViewData={() => openPreview(source)}
					onSync={
						isMicromaxFile && manageDataSourcesPermission && !isRefreshingThis
							? () => handleRescanFile(source)
							: undefined
					}
					viewDataAllowed={viewDataPermission}
					manageDataSourceAllowed={manageDataSourcesPermission}
				/>
			</View>
		);
	};

	let body;

	if (hasError) {
		body = <DataSourcesErrorState message={error} onRetry={handleRefresh} />;
	} else {
		body = (
			<ScrollView
				style={styles.container}
				showsVerticalScrollIndicator={false}
				refreshControl={
					<RefreshControl
						refreshing={isRefreshing || loading}
						onRefresh={handleRefresh}
						title="Pull to refresh"
					/>
				}
			>
				{dataSourcesList.length > 0 && (
					<DataSourcesSummary
						total={dataSourcesList.length}
						activeCount={activeCount}
						errorCount={errorCount}
						lastRefreshAt={lastManualRefresh}
					/>
				)}

				{Object.entries(groupedSources).map(([category, sources]) => {
					const isMicromax = category === MICROMAX_PARENT_TYPE;
					const showSettings = isMicromax && !!micromaxParent && manageDataSourcesPermission;
					const emptyMessage = isMicromax
						? "No files have been received yet. Files uploaded to the export bucket will appear here automatically."
						: undefined;

					return (
						<DataSourceCategorySection
							key={category}
							category={category}
							sources={sources}
							showSettings={showSettings}
							onOpenSettings={openMicromaxSettings}
							renderSource={renderDataSourceCard}
							emptyMessage={emptyMessage}
						/>
					);
				})}

				{dataSourcesList.length === 0 && !loading && <DataSourcesEmptyState />}
			</ScrollView>
		);
	}

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
			center={false}
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

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	cardSpacing: {
		marginBottom: 12,
	},
});
