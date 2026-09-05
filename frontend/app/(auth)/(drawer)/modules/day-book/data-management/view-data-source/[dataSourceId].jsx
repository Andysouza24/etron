// authors: holly wyatt, noah bradley

import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { Card } from "react-native-paper";
import { useLocalSearchParams, router } from "expo-router";
import Header from "../../../../../../../components/layout/Header";
import { commonStyles } from "../../../../../../../assets/styles/stylesheets/common";
import ResponsiveScreen from "../../../../../../../components/layout/ResponsiveScreen";
import { apiGet, apiPost } from "../../../../../../../utils/api/apiClient";
import endpoints from "../../../../../../../utils/api/endpoints";
import { getWorkspaceId } from "../../../../../../../storage/workspaceStorage";
import ItemNotFound from "../../../../../../../components/common/errors/MissingItem";
import DataSourceErrorBanner from "../../../../../../../components/modules/day-book/data-sources/DataSourceErrorBanner";
import DataSourceInfoCard from "../../../../../../../components/modules/day-book/data-sources/DataSourceInfoCard";
import DataPreviewTable from "../../../../../../../components/modules/day-book/data-sources/DataPreviewTable";

const SelectDataSource = () => {
	const { dataSourceId } = useLocalSearchParams();
	const lastFetchedIdRef = useRef(null);

	const [dataSourceExists, setDataSourceExists] = useState(true);
	const [dataSource, setDataSource] = useState(null);
	const [loadingSource, setLoadingSource] = useState(true);
	const [previewLoading, setPreviewLoading] = useState(false);
	const [previewData, setPreviewData] = useState(null);

	const editHref = `/modules/day-book/data-management/edit-data-source/${dataSourceId}`;
	const reviseHref = `/modules/day-book/data-management/revise-schema/${dataSourceId}`;

	const loadDataSource = useCallback(async () => {
		setLoadingSource(true);
		try {
			const workspaceId = await getWorkspaceId();
			const result = await apiGet(
				endpoints.modules.day_book.data_sources.getDataSource(dataSourceId),
				{ workspaceId },
			);
			const source = result.data;
			if (!source) {
				setDataSourceExists(false);
			} else {
				setDataSource(source);
				setDataSourceExists(true);
			}
		} catch (error) {
			console.error("[ViewDataSource] loadDataSource:", error);
			setDataSourceExists(false);
		} finally {
			setLoadingSource(false);
		}
	}, [dataSourceId]);

	useEffect(() => {
		if (lastFetchedIdRef.current === dataSourceId) return;
		lastFetchedIdRef.current = dataSourceId;
		loadDataSource();
	}, [dataSourceId, loadDataSource]);

	const handleTestConnection = async () => {
		if (!dataSource) return;
		try {
			const body = {
				sourceType: dataSource.sourceType || dataSource.type,
				config: dataSource.config ?? {},
				secrets: dataSource.secrets ?? {},
			};
			await apiPost(endpoints.modules.day_book.data_sources.testConnection, body);
			Alert.alert("Test Connection", "Connection test requested.");
		} catch (err) {
			console.error("[ViewDataSource] handleTestConnection:", err);
			Alert.alert("Test failed", err?.message || String(err));
		}
	};

	const handleViewData = async () => {
		setPreviewLoading(true);
		setPreviewData(null);
		try {
			const workspaceId = await getWorkspaceId();
			const result = await apiGet(
				endpoints.modules.day_book.data_sources.viewData(dataSourceId),
				{ workspaceId },
			);
			setPreviewData(result.data);
		} catch (err) {
			console.error("[ViewDataSource] viewData:", err);
			Alert.alert("Unable to load preview", err?.message || String(err));
		} finally {
			setPreviewLoading(false);
		}
	};

	const handleRevise = () => {
		router.navigate(reviseHref);
	};

	return (
		<ResponsiveScreen
			header={<Header title={"View Data Source"} showBack />}
			center={!dataSourceExists}
			tapToDismissKeyboard={false}
		>
			{loadingSource ? (
				<View style={[commonStyles.screen, styles.center]}>
					<ActivityIndicator size="large" />
				</View>
			) : dataSourceExists ? (
				<>
					{dataSource?.status === "error" ? (
						<DataSourceErrorBanner
							errorType={dataSource.errorType}
							errorMessage={dataSource.errorMessage}
							onRevise={handleRevise}
						/>
					) : null}

					<DataSourceInfoCard
						dataSource={dataSource}
						editHref={editHref}
						previewLoading={previewLoading}
						onViewData={handleViewData}
						onTestConnection={handleTestConnection}
					/>

					{previewData ? (
						<Card>
							<Card.Title title="Preview" />
							<View style={styles.previewBody}>
								<DataPreviewTable preview={previewData} />
							</View>
						</Card>
					) : null}
				</>
			) : (
				<ItemNotFound
					icon="database-off"
					item="data source"
					itemId={dataSourceId}
					listRoute="/modules/day-book/data-management"
				/>
			)}
		</ResponsiveScreen>
	);
};

export default SelectDataSource;

const styles = StyleSheet.create({
	previewBody: {
		padding: 12,
	},
	center: {
		justifyContent: "center",
		alignItems: "center",
		flex: 1,
	},
});

