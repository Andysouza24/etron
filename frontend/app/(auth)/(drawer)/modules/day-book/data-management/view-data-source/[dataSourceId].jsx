// authors: holly wyatt, noah bradley

import React, { useEffect, useState } from "react";
import {
	View,
	StyleSheet,
	ScrollView,
	Pressable,
	ActivityIndicator,
} from "react-native";
import { Text, Card, DataTable, useTheme, Button } from "react-native-paper";
import { useLocalSearchParams, router, Link } from "expo-router";
import Header from "../../../../../../../components/layout/Header";
import { commonStyles } from "../../../../../../../assets/styles/stylesheets/common";
import {
	getSupportedTypes,
	getAdapterInfo,
} from "../../../../../../../adapters/day-book/data-sources/DataAdapterFactory";
import useDataSources from "../../../../../../../hooks/modules/day_book/data-sources/useDataSource";
import ResponsiveScreen from "../../../../../../../components/layout/ResponsiveScreen";
import formatDateTime from "../../../../../../../utils/format/formatISODate"
import { apiGet } from "../../../../../../../utils/api/apiClient";
import endpoints from "../../../../../../../utils/api/endpoints";
import { getWorkspaceId } from "../../../../../../../storage/workspaceStorage";
import { getCachedPermissions } from "../../../../../../../storage/permissionsStorage";
import { getUserInfo } from "../../../../../../../storage/userStorage";
import ItemNotFound from "../../../../../../../components/common/errors/MissingItem";
import { formatCellValue } from "../../../../../../../utils/numberParser";

const SelectDataSource = () => {
	const theme = useTheme();
	const { dataSourceId } = useLocalSearchParams();
	const { getDataSource, fetchDataSource, dataSourceService } = useDataSources();
	const lastFetchedIdRef = React.useRef(null);

	const [dataSourceExists, setDataSourceExists] = useState(true);
	const [workspaceId, setWorkspaceId] = useState(null);
	const [dataSource, setDataSource] = useState(null);
	//const [adapters, setAdapters] = useState([]);
	//const [loadingAdapters, setLoadingAdapters] = useState(true);
	const [loadingSource, setLoadingSource] = useState(true);
	const [previewLoading, setPreviewLoading] = useState(false);
	const [previewData, setPreviewData] = useState(null);
	const [showAllRows, setShowAllRows] = useState(false);

	const editHref = `/modules/day-book/data-management/edit-data-source/${dataSourceId}}`

	/*const loadAdapters = async () => {
		try {
			const types = await getSupportedTypes();
			const adapterList = types.map((type) => ({
				type,
				info: getAdapterInfo(type),
			}));
			setAdapters(adapterList);
		} catch (err) {
			console.error("Failed to load supported adapter types:", err);
		} finally {
			setLoadingAdapters(false);
		}
	};*/

	useEffect(() => {
		loadDataSource();
		//loadAdapters();
	}, []);

	const loadDataSource = async () => {
		const workspaceId = await getWorkspaceId();
		setWorkspaceId(workspaceId);

		setLoadingSource(true);
		try {
			const workspaceId = await getWorkspaceId();
			const result = await apiGet(endpoints.modules.day_book.data_sources.getDataSource(dataSourceId), { workspaceId });
			const source = result.data;
			if (!source) {
				setDataSourceExists(false);
			} else {
				setDataSource(source);
				setDataSourceExists(true);
			}
		} catch (error) {
			console.error("Error loading data source:", error);
			setDataSourceExists(false);
		} finally {
			setLoadingSource(false);
		}
	};

	const handleViewData = async () => {
		setPreviewLoading(true);
		setPreviewData(null);
		
		console.log("VIEW DATA");

		/*const permissions = await getPermissions();
		console.log("permissions:", permissions);*/
		try {
			//const result = await apiGet(endpoints.workspace.roles.getRoleOfUser(workspaceId));
			const userInfo = await getUserInfo();
			console.log("userinfo:", userInfo);
			console.log("workspaceId:", workspaceId);
			console.log("userId:", userInfo.userId);
			const result = await apiGet(endpoints.workspace.users.getUser(workspaceId, userInfo.userId));
			const permissions = result.data;
			console.log("permissions:", permissions);
		} catch (error) {
			console.log("Error doiong that:", error);
		}

		try {
			/*console.log('[SelectDataSource] Loading preview via viewData endpoint', { id: effectiveId, type: dataSource.type });
			const res = await dataSourceService.viewData(effectiveId);
			const data = Array.isArray(res?.data) ? res.data : [];
			const headers = Array.isArray(res?.headers) ? res.headers : (data.length ? Object.keys(data[0]) : []);
			setPreviewData({ data, headers });
			console.log('[SelectDataSource] Preview (from viewData):', { rows: data.length, cols: headers.length });*/
			const result = await apiGet(endpoints.modules.day_book.data_sources.viewData(dataSourceId), { workspaceId });
			const previewData = result.data;
			console.log("previewData:", previewData);
			setPreviewData(previewData);
		} catch (error) {
			console.error('Preview via viewData failed:', error);
			//setPreviewData({ error: err?.message || String(err) });
		} finally {
			setPreviewLoading(false);
		}
	};

	const adapterInfo = dataSource ? getAdapterInfo(dataSource.type) : null;
	const subtitleText =
		typeof adapterInfo?.description === "string"
			? adapterInfo.description
			: dataSource?.type;

	const createdAtValue = dataSource?.createdAt || dataSource?.lastSync || null;

	const OrganisedData = () => {
		const allRows = Array.isArray(previewData.data) ? previewData.data : [];
		// build headers: prefer provided headers, else union of keys from first 50 rows, else ['value'] for primitives
		const inferHeaders = () => {
			if (Array.isArray(previewData.headers) && previewData.headers.length) return previewData.headers;
			const sample = allRows.slice(0, 50);
			const isObjectRows = sample.some((r) => r && typeof r === 'object' && !Array.isArray(r));
			if (!isObjectRows) return ['value'];
			const set = new Set();
			sample.forEach((r) => { if (r && typeof r === 'object') Object.keys(r).forEach((k) => set.add(k)); });
			return Array.from(set);
		};
		const headers = inferHeaders();
		const schemaByName = {};
		if (Array.isArray(previewData.schema)) {
			for (const col of previewData.schema) {
				if (col && col.name) schemaByName[col.name] = col;
			}
		}
		const toDisplayRows = allRows.slice(0, showAllRows ? 25 : 10);
		const formatVal = (v, header) => {
			if (v == null) return '';
			const col = schemaByName[header];
			if (col && col.currencySymbol && col.displayCurrencySymbol !== false && col.category === 'value') {
				return formatCellValue(v, col);
			}
			const isDateLike = (s) => typeof s === 'string' && /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s);
			if (typeof v === 'string') {
				if (isDateLike(v)) { try { return new Date(v).toLocaleString(); } catch { return v; } }
				return v.length > 200 ? v.slice(0, 200) + '…' : v;
			}
			if (typeof v === 'number' || typeof v === 'boolean') return String(v);
			// objects/arrays
			try {
				const s = JSON.stringify(v);
				return s.length > 200 ? s.slice(0, 200) + '…' : s;
			} catch {
				return String(v);
			}
		};
		const normalizeRow = (row) => {
			if (row && typeof row === 'object' && !Array.isArray(row)) return row;
			return { value: row };
		};
		const totalRows = allRows.length;
		const totalCols = headers.length;
		return (
			<View>
				<View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, justifyContent: 'space-between' }}>
					<Text variant="labelLarge">
						Rows: {totalRows} • Columns: {totalCols} • Showing first {showAllRows ? 25 : 10}
					</Text>
					{totalRows > 10 && (
						<Button mode="text" onPress={() => setShowAllRows((v) => !v)}>
							{showAllRows ? 'Show 10' : 'Show 25'}
						</Button>
					)}
				</View>
				<ScrollView horizontal>
					<DataTable>
						<DataTable.Header>
							{headers.map((h) => (
								<DataTable.Title key={h} style={{ width: 70 }}>
									<Text style={{ fontWeight: '700' }}>{h}</Text>
								</DataTable.Title>
							))}
						</DataTable.Header>
						{toDisplayRows.map((row, idx) => {
							const obj = normalizeRow(row);
							const zebra = idx % 2 === 1;
							return (
								<DataTable.Row key={idx} style={zebra ? { backgroundColor: theme.colors.primary } : null}>
									{headers.map((h) => (
										<DataTable.Cell key={h} style={{ width: 70 }}>
											<Text style={zebra ? { color: '#000' } : null}>{formatVal(obj[h], h)}</Text>
										</DataTable.Cell>
									))}
								</DataTable.Row>
							);
						})}
					</DataTable>
				</ScrollView>
			</View>
		);
	}

	return (
		<ResponsiveScreen
			header={<Header title={"View Data Source"} showBack />}
			center={dataSourceExists ? false : true}
			tapToDismissKeyboard={false}
		>
			{ loadingSource ? (
				<View style={[commonStyles.screen, styles.center]}>
					<ActivityIndicator size="large" />
				</View>
			) : dataSourceExists ? (<>
				<Card style={styles.card}>
					<Card.Title
						title={dataSource.name}
						//subtitle={subtitleText}
					/>
					<View style={{ padding: 16 }}>
						<Text>Type: {dataSource.sourceType}</Text>
						<Text>Status: {dataSource.status}</Text>
						<Text>Last Update: {formatDateTime(dataSource.lastUpdate)}</Text>
						<Text>Created: {formatDateTime(createdAtValue)}</Text>
						<View style={{ flexDirection: 'row', marginTop: 12 }}>
							<Button onPress={handleViewData} mode="contained" disabled={previewLoading} style={{ marginRight: 8 }}>
								{previewLoading ? 'Loading...' : 'View Data'}
							</Button>
							<Link href={editHref} asChild>
								<Button mode="outlined">Edit Data Source</Button>
							</Link>
						</View>
					</View>
				</Card>

				{previewData ? (
					<Card>
						<Card.Title title="Preview" />
						<View style={{ padding: 12 }}>
							<OrganisedData />							
						</View>
					</Card>
				) : null}
			</>) : (
				<ItemNotFound
					icon = "database-off"
					item = "data source"
					itemId = {dataSourceId}
					listRoute = "/modules/day-book/data-management"
				/>
			)}
		</ResponsiveScreen>
	);
};

export default SelectDataSource;

const styles = StyleSheet.create({
	container: {
		padding: 16,
	},
	title: {
		marginBottom: 16,
		fontWeight: "600",
	},
	card: {
		marginBottom: 12,
	},
	center: {
		justifyContent: "center",
		alignItems: "center",
		flex: 1,
	},
});
