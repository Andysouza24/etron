import React, { useEffect, useState, useMemo } from "react";
import { View, Alert, StyleSheet, ScrollView } from "react-native";
import { Text, TextInput, Button, useTheme, HelperText, ActivityIndicator } from "react-native-paper";
import { useLocalSearchParams, router } from "expo-router";
import Header from "../../../../../../../components/layout/Header";
import { commonStyles } from "../../../../../../../assets/styles/stylesheets/common";
import useDataSources from "../../../../../../../hooks/modules/day_book/data-sources/useDataSource";
import ResponsiveScreen from "../../../../../../../components/layout/ResponsiveScreen";

const UpdateDataSourceScreen = () => {
	const theme = useTheme();
	const { id } = useLocalSearchParams();
	const sourceId = Array.isArray(id) ? id[0] : id;

	const { getDataSource, updateDataSource } = useDataSources();

	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState(null);
	const [source, setSource] = useState(null);

	// Editable fields
	const [name, setName] = useState("");
	const [endpoint, setEndpoint] = useState("");

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

	const [fieldErrors, setFieldErrors] = useState({});

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
	center: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
	},
});
