// Author(s): Holly Wyatt, Noah Bradley

import { useState, useRef, useCallback, useEffect } from "react";
import { RefreshControl, Alert, ScrollView, View, StyleSheet, Pressable } from "react-native";
import { Text, IconButton } from "react-native-paper";
import { router, useFocusEffect } from "expo-router";
import * as DocumentPicker from "expo-document-picker";

import Header from "../../../../../../components/layout/Header";
import ResponsiveScreen from "../../../../../../components/layout/ResponsiveScreen";
import DataConnectionCard from "../../../../../../components/modules/day-book/data-sources/DataConnectionCard";
import DataPreviewModal from "../../../../../../components/modules/day-book/data-sources/DataPreviewModal";
import ProgressSummary from "../../../../../../components/common/ProgressSummary";

import endpoints from "../../../../../../utils/api/endpoints";
import { apiGet, apiPut, apiDelete, apiPost } from "../../../../../../utils/api/apiClient";
import { getWorkspaceId } from "../../../../../../storage/workspaceStorage";
import { useDataSourceContext } from "../../../../../../contexts/DataSourceContext";
import { getAdapterInfo, getCategoryDisplayName } from "../../../../../../adapters/day-book/data-sources/DataAdapterFactory";
import { useHasPermission } from "../../../../../../hooks/useHasPermission";

const DataManagement = () => {
	const { dataSources: ctxDataSources, system, refreshDataSources: ctxRefresh, refreshDashboardRawData } = useDataSourceContext();
	const dataSourcesList = ctxDataSources.list;
	const loading = system.isLoading && dataSourcesList.length === 0;
	const hasError = system.hasError;
	const error = system.error || "";
	const { allowed: viewDataPermission } = useHasPermission("modules.daybook.datasources.view_data");
	const { allowed: manageDataSourcesPermission } = useHasPermission("modules.daybook.datasources.manage_dataSources");

	const [isRefreshing, setIsRefreshing] = useState(false);
	const [lastManualRefresh, setLastManualRefresh] = useState(0);
	const [uploadingMap, setUploadingMap] = useState({});
	const [workspaceId, setWorkspaceId] = useState(null);

	const [previewOpen, setPreviewOpen] = useState(false);
	const [previewStatus, setPreviewStatus] = useState("idle");
	const [previewSchema, setPreviewSchema] = useState([]);
	const [previewRows, setPreviewRows] = useState([]);

	const hasInitiallyLoadedRef = useRef(false);

	const fetchDataSources = useCallback(async () => {
		try {
			const wid = await getWorkspaceId();
			setWorkspaceId(wid);
			await ctxRefresh();
		} catch (error) {
			console.error("Error fetching data sources", error);
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

	// while any source is processing, refresh every few seconds to keep progress bars updating
	// TODO: fix
	const anyProcessing = dataSourcesList.some(
		(s) => (s.status || "").toLowerCase() === "processing"
	);
	useEffect(() => {
		if (!anyProcessing) return undefined;
		const interval = setInterval(() => {
			ctxRefresh().catch(() => {});
		}, 3000);
		return () => clearInterval(interval);
	}, [anyProcessing, ctxRefresh]);

	const handleUploadLocalCsv = useCallback(async (source) => {
		try {
			const pick = await DocumentPicker.getDocumentAsync({
				type: ["text/csv", "application/vnd.ms-excel", "application/csv", "text/comma-separated-values"],
				copyToCacheDirectory: true,
			});
			if (pick.canceled) return;
			const file = pick.assets?.[0];
			if (!file?.uri) return;

			setUploadingMap(prev => ({ ...prev, [source.dataSourceId]: true }));
			const res = await apiGet(
				endpoints.modules.day_book.data_sources.getUploadUrl(source.dataSourceId),
				{ workspaceId }
			);

			const uploadUrl = res?.data?.uploadUrl ?? res?.data;
			if (!uploadUrl) throw new Error("No uploadUrl returned.");

			const blobResp = await fetch(file.uri);
			const blob = await blobResp.blob();

			await fetch(uploadUrl, {
				method: "PUT",
				body: blob,
				headers: { "Content-Type": "text/csv" },
			});

			await apiPut(endpoints.modules.day_book.data_sources.updateData(source.dataSourceId), { workspaceId });
			await fetchDataSources();
			Alert.alert("Upload complete", "Your CSV has been uploaded.");
		} catch (error) {
			console.error("Upload CSV failed:", error);
			Alert.alert("Upload failed", String(error?.message || error));
		} finally {
			setUploadingMap(prev => ({ ...prev, [source.dataSourceId]: false }));
		}
	}, [workspaceId, fetchDataSources]);

	const handleRefresh = useCallback(async () => {
		try {
			setIsRefreshing(true);
			await fetchDataSources();
			setLastManualRefresh(Date.now());
		} catch (error) {
			console.error("Error refreshing:", error);
			Alert.alert("Refresh failed", "Unable to refresh data sources.");
		} finally {
			setIsRefreshing(false);
		}
	}, [fetchDataSources]);

	const count = dataSourcesList.length;
	const connected = dataSourcesList.filter((s) => {
		const st = (s.status || "").toLowerCase();
		return st === "active" || st === "connected";
	});
	const errorsArr = dataSourcesList.filter((s) => (s.status || "").toLowerCase() === "error");

	const formatLastSync = useCallback((dateString) => {
		if (!dateString) return "Unknown";
		const date = new Date(dateString);
		const now = new Date();
		const diffMs = now - date;
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMs / 3600000);
		const diffDays = Math.floor(diffMs / 86400000);

		if (diffMins < 1) return "Just now";
		if (diffMins < 60) return `${diffMins}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		return `${diffDays}d ago`;
	}, []);

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
						} catch (error) {
							console.error("Error disconnecting data source", error);
							Alert.alert("Error", String(error));
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
		} catch (error) {
			console.error("[DataManagement] handleTestConnection error", error);
			Alert.alert("Error", String(error));
		}
	}, []);

	const handleViewData = useCallback(async (source) => {
		try {
			setPreviewOpen(true);
			setPreviewStatus("loading");
			const res = await apiGet(
				endpoints.modules.day_book.data_sources.viewData(source.dataSourceId),
				{ workspaceId }
			);
			const { data = [], schema = [] } = res.data || {};
			setPreviewRows(Array.isArray(data) ? data : []);
			setPreviewSchema(Array.isArray(schema) ? schema : []);
			setPreviewStatus("ready");
		} catch (err) {
			console.error("Error loading preview data:", err);
			setPreviewStatus("error");
		}
	}, [workspaceId]);

	const dismissPreview = useCallback(() => {
		setPreviewOpen(false);
		setPreviewStatus("idle");
		setPreviewSchema([]);
		setPreviewRows([]);
	}, []);

	const navigateToViewSource = useCallback((source) => {
		router.navigate(`/modules/day-book/data-management/view-data-source/${source.dataSourceId}`);
	}, []);

	const navigateToEditSource = useCallback((source) => {
		router.navigate(`/modules/day-book/data-management/edit-data-source/${source.dataSourceId}`);
	}, []);

	// keep parent out of card grid but show category-level settings button
	const micromaxParent = dataSourcesList.find(
		(source) => (source.sourceType || source.type) === "micromax-dashboard"
	);

	const visibleSources = dataSourcesList.filter(
		(source) => (source.sourceType || source.type) !== "micromax-dashboard"
	);

	const groupedSources = visibleSources.reduce((acc, source) => {
		const adapterInfo = getAdapterInfo(source.sourceType || source.type);
		const category = adapterInfo?.category || "other";
		if (!acc[category]) acc[category] = [];
		acc[category].push(source);
		return acc;
	}, {});

	if (micromaxParent && !groupedSources["micromax-dashboard"]) {
		groupedSources["micromax-dashboard"] = [];
	}

	const openMicromaxSettings = () => {
		if (!micromaxParent) return;
		router.navigate(
			`/modules/day-book/data-management/micromax-dashboard-settings/${micromaxParent.dataSourceId}`
		);
	};

	const [refreshingSourceId, setRefreshingSourceId] = useState(null);

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
			Alert.alert("Refresh failed", err?.message || "Unable to refresh this file.");
		} finally {
			setRefreshingSourceId(null);
		}
	}, [refreshDashboardRawData]);

	const renderDataSourceCard = (source) => {
		const adapterInfo = getAdapterInfo(source.sourceType || source.type);
		if (!adapterInfo) return null;

		const sourceType = source.sourceType || source.type;
		const isMicromaxFile = sourceType === "micromax-dashboard-file";
		const isRefreshingThis = refreshingSourceId === source.dataSourceId;

		const typeLabel = adapterInfo.displayName || adapterInfo.name || sourceType;
		const lastSyncText = source.lastUpdate ? `Last sync: ${formatLastSync(source.lastUpdate)}` : undefined;
		const subtitle = isRefreshingThis
			? `${typeLabel} - Refreshing...`
			: lastSyncText
				? `${typeLabel} - ${lastSyncText}`
				: typeLabel;

		return (
			<View key={source.dataSourceId} style={{ marginBottom: 12 }}>
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
					onViewData={() => handleViewData(source)}
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

	let body = null;

	if (hasError) {
		body = (
			<View style={styles.errorContainer}>
				<Text variant="headlineSmall" style={styles.errorTitle}>
					Unable to Load Data Sources
				</Text>
				<Text variant="bodyMedium" style={styles.errorMessage}>
					{error}
				</Text>
				<Pressable style={styles.retryButton} onPress={handleRefresh}>
					<Text style={styles.retryButtonText}>Try Again</Text>
				</Pressable>
			</View>
		);
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
					<View style={styles.summarySection}>
						<Text variant="titleMedium" style={styles.summaryTitle}>
							Summary
						</Text>
						<View style={styles.summaryRow}>
							<Text>Total Sources: {count}</Text>
							<Text>Active: {connected.length}</Text>
							<Text>Errors: {errorsArr.length}</Text>
						</View>
						{lastManualRefresh > 0 && (
							<Text style={styles.lastUpdateText}>
								Last refreshed: {new Date(lastManualRefresh).toLocaleTimeString()}
							</Text>
						)}
					</View>
				)}

				{Object.entries(groupedSources).map(([category, sources]) => {
					const isMicromax = category === "micromax-dashboard";
					const showSettings = isMicromax && !!micromaxParent && manageDataSourcesPermission;
					const processingCount = sources.filter((s) => (s.status || "").toLowerCase() === "processing").length;
					const processedCount = sources.length - processingCount;
					const totalCount = sources.length;
					const showCategoryProgress = isMicromax && totalCount > 0 && processingCount > 0;
					return (
						<View key={category}>
							<View style={styles.categoryHeader}>
								<Text variant="titleMedium" style={styles.categoryTitle}>
									{getCategoryDisplayName(category)} ({sources.length})
								</Text>
								{showSettings && (
									<IconButton
										icon="cog-outline"
										size={20}
										onPress={openMicromaxSettings}
										accessibilityLabel="Micromax Dashboard settings"
									/>
								)}
							</View>
							{showCategoryProgress && (
								<ProgressSummary
									label="Processing"
									processed={processedCount}
									total={totalCount}
								/>
							)}
							{isMicromax && sources.length === 0 ? (
								<Text style={styles.emptyCategoryText}>
									No files have been received yet. Files uploaded to the export bucket will appear here automatically.
								</Text>
							) : (
								sources.map(renderDataSourceCard)
							)}
						</View>
					);
				})}

				{dataSourcesList.length === 0 && !loading && (
					<View style={styles.emptyState}>
						<Text variant="headlineSmall" style={styles.emptyStateTitle}>
							No Data Sources Connected
						</Text>
						<Text variant="bodyMedium" style={styles.emptyStateMessage}>
							Connect your first data source to start tracking your data.
						</Text>
					</View>
				)}
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
	errorContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		paddingHorizontal: 32,
	},
	retryButton: {
		paddingHorizontal: 24,
		borderRadius: 8,
		marginTop: 8,
	},
	retryButtonText: {
		color: "#007AFF",
		fontWeight: "600",
	},
	categoryTitle: {
		marginBottom: 12,
	},
	categoryHeader: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	emptyCategoryText: {
		fontSize: 13,
		color: "#666",
		marginBottom: 12,
		fontStyle: "italic",
	},
	summarySection: {
		marginBottom: 24,
		padding: 16,
		borderRadius: 8,
	},
	summaryTitle: {
		marginBottom: 8,
	},
	summaryRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		marginBottom: 8,
	},
	lastUpdateText: {
		fontSize: 12,
		color: "#666",
		fontStyle: "italic",
	},
	emptyState: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		paddingHorizontal: 32,
		paddingVertical: 48,
	},
	emptyStateTitle: {
		marginBottom: 8,
		textAlign: "center",
	},
	emptyStateMessage: {
		marginBottom: 24,
		textAlign: "center",
		color: "#666",
	},
});
