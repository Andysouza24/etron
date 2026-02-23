// Author(s): Holly Wyatt, Noah Bradley

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { RefreshControl, Alert, ScrollView, View, StyleSheet, Pressable, FlatList, Dimensions } from "react-native";
import { Text, ActivityIndicator, Card, Chip, IconButton, useTheme, Modal, Portal, DataTable } from "react-native-paper";
import { router, useFocusEffect } from "expo-router";
import Header from "../../../../../../components/layout/Header";
import { getAdapterInfo, getCategoryDisplayName } from "../../../../../../adapters/day-book/data-sources/DataAdapterFactory";

import endpoints from "../../../../../../utils/api/endpoints";
import { apiGet, apiPut, apiDelete, apiPost } from "../../../../../../utils/api/apiClient";
import { getWorkspaceId } from "../../../../../../storage/workspaceStorage";
import ResponsiveScreen from "../../../../../../components/layout/ResponsiveScreen";
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import PermissionGate from "../../../../../../components/common/PermissionGate";
import { hasPermission } from "../../../../../../utils/permissions";
import { useHasPermission } from "../../../../../../hooks/useHasPermission";

const StatusPill = ({ status }) => {
	if (!status) return null;
	const s = String(status).toLowerCase();
	let mode = "outlined";
	let label = status;
	let style = { marginLeft: 8 };

	if (s === "active" || s === "connected") {
		mode = "flat";
		style = [{ marginLeft: 8 }];
		label = "Active";
	} else if (s === "pending_upload" || s === "pending") {
		mode = "flat";
		style = [{ marginLeft: 8 }];
		label = "Pending";
	} else if (s === "error" || s === "failed") {
		mode = "flat";
		style = [{ marginLeft: 8 }];
		label = "Error";
	}

	return <Chip compact mode={mode} style={style}>{label}</Chip>;
};

const DataConnectionCard = ({
	label,
	subtitle,
	status,
	onNavigate,
	onSync,
	onDelete,
	onTest,
	onSettings,
	onViewData,
	onUpload,
	uploading = false,
	viewDataAllowed = false,
	manageDataSourceAllowed = false,
	height = 60,
}) => {
	const theme = useTheme();
	return (
		<Card style={{ borderRadius: 12, overflow: "hidden" }}>
			<Card.Title
				title={label}
				subtitle={subtitle}
				right={() => <StatusPill status={status} />}
				onPress={onNavigate}
			/>
			<Card.Actions style={{ justifyContent: "space-between", paddingHorizontal: 8, paddingBottom: 8 }}>
				<View style={{ flexDirection: "row" }}>
					{onSync && (<IconButton icon="play-circle" accessibilityLabel="Sync" onPress={onSync} />)}
					<PermissionGate allowed={manageDataSourceAllowed} >
						<IconButton icon="cog" accessibilityLabel="Settings" onPress={onSettings} />
					</PermissionGate>
					<PermissionGate allowed={manageDataSourceAllowed} >
						<IconButton icon="lan-pending" accessibilityLabel="Test Connection" onPress={onTest} />
					</PermissionGate>
					<PermissionGate
						allowed={viewDataAllowed}
						onAllowed={onViewData}
					>
						<IconButton icon="table-eye" accessibilityLabel="View Data" />
					</PermissionGate>
					{onUpload && (
						<IconButton
							icon={uploading ? "progress-upload" : "upload"}
							accessibilityLabel="Upload CSV"
							onPress={onUpload}
							disabled={uploading}
						/>
					)}
				</View>
				<PermissionGate allowed={manageDataSourceAllowed} >
					<IconButton icon="delete-outline" accessibilityLabel="Delete" onPress={onDelete} />
				</PermissionGate>
			</Card.Actions>
		</Card>
	);
};

const DataManagement = () => {
	const [dataSourcesList, setDataSourcesList] = useState([]);
	const [loading, setLoading] = useState(true);
	const [hasError, setHasError] = useState(false);
	const [error, setError] = useState("");
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [lastManualRefresh, setLastManualRefresh] = useState(0);
	const [uploadingMap, setUploadingMap] = useState({});
	const [workspaceId, setWorkspaceId] = useState(null);
	const { allowed: viewDataPermission } = useHasPermission("modules.daybook.datasources.view_data");
	const { allowed: manageDataSourcesPermission } = useHasPermission("modules.daybook.datasources.manage_dataSources");

	const [previewOpen, setPreviewOpen] = useState(false);
	const [previewStatus, setPreviewStatus] = useState('idle');
	const [previewColumns, setPreviewColumns] = useState([]);
	const [previewRows, setPreviewRows] = useState([]);
	const ROW_CHUNK = 20;
	const [rowLimit, setRowLimit] = useState(ROW_CHUNK);
	const [loadingMoreRows, setLoadingMoreRows] = useState(false);
	const displayedRows = useMemo(
		() => previewRows.slice(0, rowLimit),
		[previewRows, rowLimit]
	);

	const prevCountRef = useRef(0);
	const hasInitiallyLoadedRef = useRef(false);

	const { width, height } = Dimensions.get("window");
	const MODAL_MAX_W = Math.min(width * 0.95, 900);
	const MODAL_MAX_H = Math.min(height * 0.8, 520);

	const fetchDataSources = useCallback(async () => {
		setHasError(false);
		setError("");
		try {
			const workspaceId = await getWorkspaceId();
			setWorkspaceId(workspaceId);

			const result = await apiGet(endpoints.modules.day_book.data_sources.getDataSources, {workspaceId});

			setDataSourcesList(result.data);
			console.log("Fetched data sources:", result.data);
			prevCountRef.current = result.data.length;
		} catch (error) {
			console.error("Error fetching data sources", error);
			setHasError(true);
			setError(error);
		} finally {
			setLoading(false);
		}
  	}, [workspaceId]);

	useFocusEffect(
		useCallback(() => {
			if (!hasInitiallyLoadedRef.current) {
				fetchDataSources();
				hasInitiallyLoadedRef.current = true;
			}
		}, [fetchDataSources])
	);

	const handleUploadLocalCsv = useCallback(async (source) => {
		try {
			const pick = await DocumentPicker.getDocumentAsync({
				type: ['text/csv', 'application/vnd.ms-excel', 'application/csv', 'text/comma-separated-values'],
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
				method: 'PUT',
				body: blob,
				headers: { 'Content-Type': 'text/csv' },
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

	const handleSyncSource = useCallback(
		async (source) => {
			try {
				setIsRefreshing(true);
				await apiPut(endpoints.modules.day_book.data_sources.updateData(source.dataSourceId), { workspaceId });
				await fetchDataSources();
				Alert.alert("Sync complete", "Data source sync completed successfully.");
			} catch (error) {
				console.error("Error attempting sync:", error);
				Alert.alert("Error trying to sync", String(error));
			} finally {
				setIsRefreshing(false);
			}
		}, [fetchDataSources, workspaceId]
	);

	const handleDisconnectSource = useCallback(
		(source) => {
			Alert.alert(
				"Disconnect data source",
				`Are you sure you want to disconnect "${source.name || source.dataSourceId}"?`,
				[
					{ text: "Cancel", style: "cancel" },
					{
						text: "Disconnect",
						style: "destructive",
						onPress: async () => {
							setLoading(true);
							try {
								await apiDelete(endpoints.modules.day_book.data_sources.removeDataSource(source.dataSourceId), {workspaceId});
								await fetchDataSources();
							} catch (error) {
								console.error("Error disconnecting data source", error);
								Alert.alert("Error", String(error));
							} finally {
								setLoading(false);
							}
						},
					},
				]
			);
		}, [fetchDataSources, workspaceId]
	);

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
			setPreviewStatus('loading');
			setRowLimit(ROW_CHUNK);
			console.log("source.dataSourceId:", source.dataSourceId);
			console.log("workspaceId:", workspaceId);
			const res = await apiGet(
				endpoints.modules.day_book.data_sources.viewData(source.dataSourceId),
				{ workspaceId }
			);
			const { data = [], schema = [] } = res.data || {};
			setPreviewRows(Array.isArray(data) ? data : []);
			setPreviewColumns(schema.map(s => s.name));
			setPreviewStatus('ready');
		} catch (err) {
			console.error("Error loading preview data:", err);
			setPreviewStatus('error');
		}
	}, [workspaceId]);

	const onPreviewBottomReached = useCallback(() => {
		if (loadingMoreRows) return;
		if (rowLimit >= previewRows.length) return;
		setLoadingMoreRows(true);
		requestAnimationFrame(() => {
			setRowLimit(prev => Math.min(prev + ROW_CHUNK, previewRows.length));
			setLoadingMoreRows(false);
		});
	}, [previewRows.length, rowLimit, loadingMoreRows]);

	const groupSourcesByCategory = useCallback(() => {
		const grouped = {};
		dataSourcesList.forEach((source) => {
			const adapterInfo = getAdapterInfo(source.sourceType || source.type);
			const category = adapterInfo?.category || "other";
			if (!grouped[category]) grouped[category] = [];
			grouped[category].push(source);
		});
		return grouped;
	}, [dataSourcesList]);

	const groupedSources = groupSourcesByCategory();

	const renderDataSourceCard = useCallback((source) => {
		const adapterInfo = getAdapterInfo(source.sourceType || source.type);
		if (!adapterInfo) return null;

		const typeLabel =
		adapterInfo.displayName ||
		adapterInfo.name ||
		(source.sourceType || source.type);
		const lastSyncText = source.lastUpdate
			? `Last sync: ${formatLastSync(source.lastUpdate)}`
			: undefined;

		const subtitle = lastSyncText ? `${typeLabel} - ${lastSyncText}` : typeLabel;
		return (
			<View key={source.dataSourceId} style={{ marginBottom: 12 }}>
				<DataConnectionCard
					label={source.name}
					height={60}
					subtitle={subtitle}
					status={source.status}
					onNavigate={() => router.navigate(`/modules/day-book/data-management/view-data-source/${source.dataSourceId}`)}
					//onSync={() => handleSyncSource(source)}
					onDelete={() => handleDisconnectSource(source)}
					onTest={() => handleTestConnection(source)}
					onSettings={() => router.navigate(`/modules/day-book/data-management/edit-data-source/${source.dataSourceId}`)}
					onViewData={() => handleViewData(source)}
					/*{...( (source.sourceType || source.type) === 'local-csv'
						? { onUpload: () => handleUploadLocalCsv(source),
							uploading: !!uploadingMap[source.dataSourceId] }
						: {} )}*/
					viewDataAllowed={viewDataPermission}
					manageDataSourceAllowed={manageDataSourcesPermission}
				/>
			</View>
		);
	}, [formatLastSync, handleSyncSource, viewDataPermission, manageDataSourcesPermission, handleDisconnectSource, handleTestConnection, handleViewData, handleUploadLocalCsv, uploadingMap]);

	let body = null;

	if (loading && !isRefreshing) {
	} else if (hasError) {
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

				{/* Grouped Data Sources */}
				{Object.entries(groupedSources).map(([category, sources]) => (
					<View key={category}>
						<Text variant="titleMedium" style={styles.categoryTitle}>
							{getCategoryDisplayName(category)} ({sources.length})
						</Text>
						{sources.map(renderDataSourceCard)}
					</View>
				))}

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
			header={<Header
				title="Data Management"
				showMenu
				showPlus
				onRightIconPress={() =>
					router.navigate("/modules/day-book/data-management/create-data-connection")
				}
				rightIconPermission={manageDataSourcesPermission}
			/>}
			center={false}
			scroll={true}
			loadingOverlayActive={loading}
		>
			{body}
			<Portal>
				<Modal
					visible={previewOpen}
					onDismiss={() => {
						setPreviewOpen(false);
						setPreviewStatus('idle');
						setPreviewColumns([]);
						setPreviewRows([]);
						setRowLimit(ROW_CHUNK);
					}}
					contentContainerStyle={{ alignSelf: "center" }}
				>
					<Card style={{ width: MODAL_MAX_W, maxHeight: MODAL_MAX_H, borderRadius: 12 }}>
						<Card.Title title="Data Preview" />
						<Card.Content>
							{previewStatus === 'loading' && (
								<View style={{ height: MODAL_MAX_H - 120, alignItems: 'center', justifyContent: 'center' }}>
									<ActivityIndicator size="large" />
								</View>
							)}
							{previewStatus === 'error' && (
								<Text>Couldn't load data. Please try again.</Text>
							)}
							{previewStatus === 'ready' && (
								<ScrollView horizontal showsHorizontalScrollIndicator>
									<View
										style={{
											minWidth: previewColumns.length * 120,
											maxHeight: MODAL_MAX_H - 120,
										}}
									>
										<DataTable>
											<DataTable.Header>
												{previewColumns.map((col, i) => (
												<DataTable.Title key={i} numberOfLines={1}>
													<Text>{String(col)}</Text>
												</DataTable.Title>
												))}
											</DataTable.Header>
											<FlatList
												data={displayedRows}
												keyExtractor={(_, idx) => String(idx)}
												renderItem={({ item }) => (
													<DataTable.Row>
														{previewColumns.map((col, j) => (
															<DataTable.Cell key={j} style={{ width: 120 }} numberOfLines={1}>
																<Text>{String(item?.[col])}</Text>
															</DataTable.Cell>
														))}
													</DataTable.Row>
												)}
												nestedScrollEnabled
												style={{ maxHeight: MODAL_MAX_H - 160 }}
												initialNumToRender={20}
												windowSize={10}
												removeClippedSubviews
												onEndReached={onPreviewBottomReached}
												onEndReachedThreshold={0.1}
												ListFooterComponent={
													loadingMoreRows ? <ActivityIndicator size="small" /> : null
												}
											/>
										</DataTable>
									</View>
								</ScrollView>
							)}
						</Card.Content>
					</Card>
				</Modal>
			</Portal>
		</ResponsiveScreen>
	);
};

export default DataManagement;

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	loadingContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
	},
	loadingText: {
		marginTop: 16,
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
	debugSection: {
		padding: 10,
		backgroundColor: "#f0f0f0",
		borderRadius: 5,
		marginTop: 20,
		marginBottom: 50,
	},
	debugText: {
		fontSize: 12,
		color: "#666",
	},
});