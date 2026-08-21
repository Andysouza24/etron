// Author(s): Holly Wyatt
//
// Revise-schema flow for a data source that is stuck in the "error" state.
// Loads the error context (current stored schema, suggested revision built
// from the pending temp data, sample rows), lets the user flip between
// viewing the current schema and a schema they are revising, and submits
// the revision to the resolve-error endpoint.

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { View, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { Text, Card, Button, SegmentedButtons, Snackbar, useTheme } from "react-native-paper";
import { useLocalSearchParams, router } from "expo-router";
import Header from "../../../../../../../components/layout/Header";
import ResponsiveScreen from "../../../../../../../components/layout/ResponsiveScreen";
import DataSourceErrorBanner from "../../../../../../../components/modules/day-book/data-sources/DataSourceErrorBanner";
import SchemaFieldRow from "../../../../../../../components/modules/day-book/data-sources/SchemaFieldRow";
import DataPreviewTable from "../../../../../../../components/modules/day-book/data-sources/DataPreviewTable";
import useDataSource from "../../../../../../../hooks/modules/day_book/data-sources/useDataSource";

const TAB_CURRENT = "current";
const TAB_REVISED = "revised";

const ReviseSchemaScreen = () => {
	const theme = useTheme();
	const { dataSourceId } = useLocalSearchParams();
	const { getErrorContext, resolveError, refreshFromDefaultSchema } = useDataSource();

	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [context, setContext] = useState(null);
	const [revised, setRevised] = useState([]);
	const [tab, setTab] = useState(TAB_REVISED);
	const [snackbar, setSnackbar] = useState({ visible: false, text: "", tone: "info" });
	const [loadError, setLoadError] = useState(null);

	const loadContext = useCallback(async () => {
		setLoading(true);
		setLoadError(null);
		try {
			const result = await getErrorContext(dataSourceId);
			if (!result) {
				setLoadError("Unable to load error details. The data source may no longer exist.");
				return;
			}
			setContext(result);
			// pre-populate the revised schema with the suggestion. The user
			// can then tweak any field type before submitting.
			setRevised(Array.isArray(result.suggestedSchema) ? result.suggestedSchema : []);
		} catch (err) {
			console.error("[ReviseSchema] loadContext:", err);
			setLoadError(err?.message || "Failed to load error context");
		} finally {
			setLoading(false);
		}
	}, [dataSourceId]);

	useEffect(() => {
		if (!dataSourceId) return;
		loadContext();
	}, [dataSourceId, loadContext]);

	const oldSchema = useMemo(
		() => (Array.isArray(context?.oldSchema) ? context.oldSchema : []),
		[context?.oldSchema],
	);

	const sampleRows = useMemo(
		() => (Array.isArray(context?.sampleRows) ? context.sampleRows : []),
		[context?.sampleRows],
	);

	const newFieldNames = useMemo(
		() => revised.filter((c) => c?.isNew).map((c) => c.name),
		[revised],
	);

	const updateColumn = (next) => {
		setRevised((cols) => cols.map((c) => (c.name === next.name ? { ...c, ...next } : c)));
	};

	const handleSubmit = async () => {
		if (!Array.isArray(revised) || revised.length === 0) {
			setSnackbar({ visible: true, text: "There are no columns to apply.", tone: "error" });
			return;
		}
		setSaving(true);
		try {
			const payload = revised.map((c) => ({
				name: c.name,
				type: c.type,
				category: c.category,
				...(c.dateFormat ? { dateFormat: c.dateFormat } : {}),
				...(c.userDateFormat ? { userDateFormat: c.userDateFormat } : {}),
				...(c.currencySymbol ? { currencySymbol: c.currencySymbol } : {}),
				...(c.group ? { group: c.group } : {}),
			}));
			await resolveError(dataSourceId, payload);
			setSnackbar({ visible: true, text: "Schema applied. The data source is reprocessing.", tone: "info" });
			// give the snackbar a beat to show before navigating back.
			setTimeout(() => router.back(), 900);
		} catch (err) {
			console.error("[ReviseSchema] resolveError:", err);
			setSnackbar({ visible: true, text: err?.message || "Failed to apply schema.", tone: "error" });
		} finally {
			setSaving(false);
		}
	};

	const handleRefreshFromDefault = async () => {
		setSaving(true);
		try {
			await refreshFromDefaultSchema(dataSourceId);
			setSnackbar({
				visible: true,
				text: "Schema refreshed from defaults. The data source is reprocessing.",
				tone: "info",
			});
			setTimeout(() => router.back(), 900);
		} catch (err) {
			console.error("[ReviseSchema] refreshFromDefaultSchema:", err);
			setSnackbar({
				visible: true,
				text: err?.message || "Failed to refresh from default schema.",
				tone: "error",
			});
		} finally {
			setSaving(false);
		}
	};

	const renderSchemaList = (columns, editable) => {
		if (!columns || columns.length === 0) {
			return (
				<Text variant="bodyMedium" style={styles.empty}>
					No columns to show.
				</Text>
			);
		}
		return columns.map((column) => (
			<SchemaFieldRow
				key={column.name}
				column={column}
				editable={editable}
				onChange={updateColumn}
			/>
		));
	};

	return (
		<ResponsiveScreen
			header={<Header title="Revise schema" showBack />}
			tapToDismissKeyboard={false}
		>
			{loading ? (
				<View style={styles.center}>
					<ActivityIndicator size="large" />
				</View>
			) : loadError ? (
				<Card style={styles.card}>
					<Card.Title title="Unable to load" />
					<View style={styles.cardBody}>
						<Text variant="bodyMedium">{loadError}</Text>
						<Button mode="contained" onPress={loadContext} style={styles.retry}>
							Try again
						</Button>
					</View>
				</Card>
			) : (
				<>
					<DataSourceErrorBanner
						errorType={context?.errorType}
						errorMessage={context?.errorMessage}
					/>

					{newFieldNames.length > 0 ? (
						<Card style={[styles.card, { backgroundColor: theme.colors.tertiaryContainer }]}>
							<View style={styles.cardBody}>
								<Text
									variant="titleSmall"
									style={{ color: theme.colors.onTertiaryContainer, marginBottom: 4 }}
								>
									{newFieldNames.length} new field{newFieldNames.length === 1 ? "" : "s"} detected
								</Text>
								<Text variant="bodyMedium" style={{ color: theme.colors.onTertiaryContainer }}>
									{newFieldNames.join(", ")}
								</Text>
								<Text
									variant="bodySmall"
									style={{ color: theme.colors.onTertiaryContainer, marginTop: 8 }}
								>
									If these fields are already part of this data source&apos;s default schema,
									you can refresh from defaults to backfill them without changing the data.
								</Text>
								<Button
									mode="outlined"
									icon="refresh"
									onPress={handleRefreshFromDefault}
									disabled={saving}
									loading={saving}
									style={styles.refreshButton}
								>
									Refresh from default schema
								</Button>
							</View>
						</Card>
					) : null}

					<Card style={styles.card}>
						<View style={styles.cardBody}>
							<SegmentedButtons
								value={tab}
								onValueChange={setTab}
								buttons={[
									{ value: TAB_CURRENT, label: "Current schema", icon: "database" },
									{ value: TAB_REVISED, label: "Revised schema", icon: "pencil" },
								]}
							/>
							<View style={styles.tabBody}>
								{tab === TAB_CURRENT
									? renderSchemaList(oldSchema, false)
									: renderSchemaList(revised, true)}
							</View>
						</View>
					</Card>

					{sampleRows.length > 0 ? (
						<Card style={styles.card}>
							<Card.Title
								title="Sample of pending data"
								subtitle={`${context?.tempRowCount || sampleRows.length} row(s) waiting`}
							/>
							<View style={styles.cardBody}>
								<DataPreviewTable preview={{ data: sampleRows }} />
							</View>
						</Card>
					) : null}

					<View style={styles.footer}>
						<Button mode="outlined" onPress={() => router.back()} disabled={saving} style={styles.footerButton}>
							Cancel
						</Button>
						<Button
							mode="contained"
							onPress={handleSubmit}
							loading={saving}
							disabled={saving}
							style={styles.footerButton}
							icon="check"
						>
							Apply schema
						</Button>
					</View>
				</>
			)}

			<Snackbar
				visible={snackbar.visible}
				onDismiss={() => setSnackbar((s) => ({ ...s, visible: false }))}
				duration={3500}
				style={
					snackbar.tone === "error"
						? { backgroundColor: theme.colors.errorContainer }
						: undefined
				}
			>
				<Text
					style={
						snackbar.tone === "error"
							? { color: theme.colors.onErrorContainer }
							: undefined
					}
				>
					{snackbar.text}
				</Text>
			</Snackbar>
		</ResponsiveScreen>
	);
};

export default ReviseSchemaScreen;

const styles = StyleSheet.create({
	card: {
		marginBottom: 12,
	},
	cardBody: {
		padding: 16,
	},
	tabBody: {
		marginTop: 12,
	},
	center: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		minHeight: 200,
	},
	empty: {
		textAlign: "center",
		marginVertical: 16,
	},
	retry: {
		alignSelf: "flex-start",
		marginTop: 12,
	},
	refreshButton: {
		alignSelf: "flex-start",
		marginTop: 12,
	},
	footer: {
		flexDirection: "row",
		justifyContent: "flex-end",
		gap: 8,
		marginTop: 8,
		marginBottom: 24,
	},
	footerButton: {
		minWidth: 120,
	},
});
