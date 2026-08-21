import React, { useEffect, useState, useMemo } from "react";
import { View, Alert, StyleSheet, ScrollView } from "react-native";
import { Text, TextInput, Button, useTheme, HelperText, ActivityIndicator, Switch, Divider } from "react-native-paper";
import { useLocalSearchParams, router } from "expo-router";
import Header from "../../../../../../../components/layout/Header";
import { commonStyles } from "../../../../../../../assets/styles/stylesheets/common";
import useDataSources from "../../../../../../../hooks/modules/day_book/data-sources/useDataSource";
import { useHasPermission } from "../../../../../../../hooks/useHasPermission";
import { useDataSourceContext } from "../../../../../../../contexts/DataSourceContext";
import ResponsiveScreen from "../../../../../../../components/layout/ResponsiveScreen";

const MANAGE_DATASOURCES_PERMISSION = "modules.daybook.datasources.manage_dataSources";
const MANAGE_COLUMN_DISPLAY_PERMISSION = "modules.daybook.datasources.manage_column_display_settings";

const UpdateDataSourceScreen = () => {
	const theme = useTheme();
	const { id } = useLocalSearchParams();
	const sourceId = Array.isArray(id) ? id[0] : id;

	const { getDataSource, updateDataSource, refreshFromDefaultSchema } = useDataSources();
	const { refreshDashboardRawData } = useDataSourceContext();
	const { allowed: canManageDataSources } = useHasPermission(MANAGE_DATASOURCES_PERMISSION);
	const { allowed: canManageColumnDisplay } = useHasPermission(MANAGE_COLUMN_DISPLAY_PERMISSION);

	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [refreshing, setRefreshing] = useState(false);
	const [refreshingDefault, setRefreshingDefault] = useState(false);
	const [error, setError] = useState(null);
	const [source, setSource] = useState(null);

	// Editable fields
	const [name, setName] = useState("");
	const [endpoint, setEndpoint] = useState("");
	const [currencyDisplay, setCurrencyDisplay] = useState({}); // currency display toggles keyed by column name

	useEffect(() => {
		let mounted = true;
		const run = async () => {
			setLoading(true);
			setError(null);
			try {
				const s = await getDataSource(sourceId);
				if (!mounted) return;
				setSource(s);
				setName(s?.name || "");
				setEndpoint(s?.config?.endpoint ?? s?.config?.url ?? "");
				const initial = {};
				for (const col of (Array.isArray(s?.schema) ? s.schema : [])) {
					if (col?.category === "value" && col.currencySymbol) {
						initial[col.name] = col.displayCurrencySymbol !== false;
					}
				}
				setCurrencyDisplay(initial);
			} catch (e) {
				if (!mounted) return;
				setError(e?.message || "Failed to load data source");
			} finally {
				if (mounted) setLoading(false);
			}
		};
		if (sourceId) run();
		return () => { mounted = false; };
	}, [sourceId, getDataSource]);

	// TODO: fix this, so it is just api - less confusion
	const isApiType = useMemo(() => (source?.type === 'custom-api' || source?.type === 'api'), [source]);
	const isDashboardRawDataType = useMemo(
		() => (source?.type === 'micromax-dashboard-file' || source?.sourceType === 'micromax-dashboard-file'),
		[source]
	);

	const createdLabel = useMemo(() => {
		const raw = source?.createdAt || source?.created || source?.metadata?.createdAt || null;
		if (!raw) return 'Created: Unknown';
		try {
			const d = new Date(raw);
			return `Created: ${d.toLocaleString()}`;
		} catch {
			return `Created: ${String(raw)}`;
		}
	}, [source]);

	const validate = () => {
		if (!name?.trim()) return { name: 'Name is required' };
		if (isApiType && !endpoint?.trim()) return { endpoint: 'Endpoint is required for API sources' };
		return null;
	};

	const currencyColumns = useMemo(() => {
		if (!Array.isArray(source?.schema)) return [];
		return source.schema.filter(
			(col) => col?.category === "value" && col?.currencySymbol
		);
	}, [source]);

	const [fieldErrors, setFieldErrors] = useState({});

	const handleRefreshNow = async () => {
		if (!sourceId) return;
		setRefreshing(true);
		try {
			await refreshDashboardRawData(sourceId);
			Alert.alert(
				'Refresh started',
				'A refresh has been queued. The data source will update once processing completes.'
			);
		} catch (e) {
			Alert.alert('Refresh failed', e?.message || 'Unable to refresh this data source.');
		} finally {
			setRefreshing(false);
		}
	};

	const handleRefreshFromDefault = async () => {
		if (!sourceId) return;
		setRefreshingDefault(true);
		try {
			await refreshFromDefaultSchema(sourceId);
			Alert.alert(
				'Schema refreshed',
				'The data source is reprocessing against its default schema.'
			);
		} catch (e) {
			Alert.alert(
				'Refresh failed',
				e?.message || 'Unable to refresh from default schema.'
			);
		} finally {
			setRefreshingDefault(false);
		}
	};

	const onSave = async () => {
		const errs = validate();
		if (errs) { setFieldErrors(errs); return; }
		setFieldErrors({});
		setSaving(true);
		try {
			const sanitize = (obj) => {
				if (!obj || typeof obj !== 'object') return obj;
				const out = Array.isArray(obj) ? [] : {};
				Object.entries(obj).forEach(([k, v]) => {
					if (v === undefined) return;
					if (v && typeof v === 'object') out[k] = sanitize(v);
					else out[k] = v;
				});
				return out;
			};
			const updates = {};
			if (name !== source?.name) updates.name = name;
			// Only include endpoint when present or changed; keep other config
			if (isApiType) {
				const nextConfig = { ...(source?.config || {}) };
				nextConfig.endpoint = endpoint;
				updates.config = nextConfig;
			}
			// column display settings only send changes
			const displayChanges = {};
			// currency display visibility
			for (const col of (Array.isArray(source?.schema) ? source.schema : [])) {
				if (col?.category !== "value" || !col.currencySymbol) continue;
				const original = col.displayCurrencySymbol !== false;
				const next = !!currencyDisplay[col.name];
				if (original !== next) {
					displayChanges[col.name] = { displayCurrencySymbol: next };
				}
			}
			if (Object.keys(displayChanges).length > 0 && canManageColumnDisplay) {
				updates.settings = {
					...(updates.settings || {}),
					displaySettings: {
						...((updates.settings && updates.settings.displaySettings) || {}),
						columnDisplaySettings: displayChanges,
					},
				};
			}
			const cleaned = sanitize(updates);
			await updateDataSource(sourceId, cleaned);
			Alert.alert('Updated', 'Data source updated successfully', [{ text: 'OK', onPress: () => router.back() }]);
		} catch (e) {
			Alert.alert('Error', e?.message || 'Failed to update data source');
		} finally {
			setSaving(false);
		}
	};

	return (
		<ResponsiveScreen
			header={<Header title={'Edit Data Source'} showBack />}
		>
			{loading ? (
				<View style={styles.center}> 
					<ActivityIndicator />
				</View>
			) : error ? (
				<View style={[styles.center, { padding: 16 }]}> 
					<Text style={{ color: theme.colors.error }}>{error}</Text>
				</View>
			) : (
				<ScrollView contentContainerStyle={styles.container}>
					<Text variant="titleMedium" style={{ marginBottom: 12 }}>Update data source details</Text>
					<TextInput
						mode="outlined"
						label="Name"
						value={name}
						onChangeText={setName}
						error={!!fieldErrors.name}
						style={styles.input}
					/>
					{!!fieldErrors.name && <HelperText type="error">{fieldErrors.name}</HelperText>}

					{isApiType && (
						<>
							<TextInput
								mode="outlined"
								label="Endpoint"
								value={endpoint}
								onChangeText={setEndpoint}
								autoCapitalize="none"
								keyboardType="url"
								error={!!fieldErrors.endpoint}
								style={styles.input}
							/>
							{!!fieldErrors.endpoint && <HelperText type="error">{fieldErrors.endpoint}</HelperText>}
						</>
					)}

					{isDashboardRawDataType && (
						<View style={styles.section}>
							<Divider style={{ marginVertical: 12 }} />
							<Text variant="titleSmall" style={{ marginBottom: 4 }}>
								Micromax Dashboard file
							</Text>
							<Text
								variant="bodySmall"
								style={{ color: theme.colors.onSurfaceVariant, marginBottom: 4 }}
							>
								File name: {source?.config?.fileName || '—'}
							</Text>
							<Text
								variant="bodySmall"
								style={{ color: theme.colors.onSurfaceVariant, marginBottom: 12 }}
							>
								This data source updates automatically when the file is uploaded
								to the export bucket. Use the button below to re-process the
								current file now.
							</Text>
							<Button
								mode="outlined"
								onPress={handleRefreshNow}
								loading={refreshing}
								disabled={refreshing || !canManageDataSources}
								icon="refresh"
							>
								Refresh now
							</Button>
							<Text
								variant="bodySmall"
								style={{ color: theme.colors.onSurfaceVariant, marginTop: 12, marginBottom: 8 }}
							>
								Refreshing from the default schema restores any columns shipped
								with this dashboard file. Existing column settings are preserved
								where possible.
							</Text>
							<Button
								mode="outlined"
								onPress={handleRefreshFromDefault}
								loading={refreshingDefault}
								disabled={refreshingDefault || !canManageDataSources}
								icon="file-refresh"
							>
								Refresh from default schema
							</Button>
						</View>
					)}

					{currencyColumns.length > 0 && canManageColumnDisplay && (
						<View style={styles.section}>
							<Divider style={{ marginVertical: 12 }} />
							<Text variant="titleSmall" style={{ marginBottom: 4 }}>Currency display</Text>
							<Text
								variant="bodySmall"
								style={{ color: theme.colors.onSurfaceVariant, marginBottom: 8 }}
							>
								Choose which currency-value columns show their symbol in data previews.
							</Text>
							{currencyColumns.map((col) => (
								<View key={col.name} style={styles.toggleRow}>
									<Text variant="bodyMedium" style={{ flex: 1 }} numberOfLines={1}>
										{col.name} ({col.currencySymbol})
									</Text>
									<Switch
										value={!!currencyDisplay[col.name]}
										onValueChange={(v) =>
											setCurrencyDisplay((prev) => ({ ...prev, [col.name]: v }))
										}
										accessibilityLabel={`Toggle currency symbol display for ${col.name}`}
									/>
								</View>
							))}
						</View>
					)}

					<View style={{ marginTop: 16 }}>
						<Button mode="contained" onPress={onSave} loading={saving} disabled={saving}>
							Save Changes
						</Button>
					</View>
				</ScrollView>
			)}
		</ResponsiveScreen>
	);
};

export default UpdateDataSourceScreen;

const styles = StyleSheet.create({
	container: {
		padding: 16,
	},
	input: {
		marginBottom: 8,
	},
	section: {
		marginTop: 4,
	},
	toggleRow: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingVertical: 6,
		gap: 12,
	},
	center: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
	},
});
