// Author(s): Holly Wyatt
//
// Surface a data source's current error state at the top of the
// view-data-source page. Surfaces the error type as a chip and the
// user-facing error message, with a CTA into the "revise schema" flow when
// the error is something the user can resolve themselves (typically schema
// drift / processing).

import React from "react";
import { View, StyleSheet } from "react-native";
import { Card, Text, Button, Chip, useTheme, Icon } from "react-native-paper";

const ERROR_TYPE_LABELS = {
	schema_drift: "Schema drift",
	json: "JSON error",
	processing: "Processing error",
	poll: "Polling error",
	resolve: "Reapply failed",
};

const DataSourceErrorBanner = ({ errorType, errorMessage, onRevise, reviseLabel = "Revise schema" }) => {
	const theme = useTheme();

	const typeLabel = ERROR_TYPE_LABELS[errorType] || "Error";
	// users can only resolve drift / processing / json failures via the
	// revise-schema flow. A poll error means the upstream never returned data,
	// so there is nothing to revise.
	const canRevise = typeof onRevise === "function" && errorType !== "poll";

	return (
		<Card
			style={[styles.card, { backgroundColor: theme.colors.errorContainer }]}
			accessibilityLabel="Data source error"
		>
			<View style={styles.row}>
				<Icon source="alert-circle" size={24} color={theme.colors.onErrorContainer} />
				<View style={styles.body}>
					<View style={styles.header}>
						<Text
							variant="titleMedium"
							style={{ color: theme.colors.onErrorContainer, fontWeight: "600" }}
						>
							This data source has an error
						</Text>
						<Chip
							compact
							style={[styles.chip, { backgroundColor: theme.colors.error }]}
							textStyle={{ color: theme.colors.onError }}
						>
							{typeLabel}
						</Chip>
					</View>
					{errorMessage ? (
						<Text
							variant="bodyMedium"
							style={[styles.message, { color: theme.colors.onErrorContainer }]}
						>
							{errorMessage}
						</Text>
					) : null}
					{canRevise ? (
						<Button
							mode="contained"
							onPress={onRevise}
							style={styles.action}
							buttonColor={theme.colors.error}
							textColor={theme.colors.onError}
							icon="wrench-outline"
						>
							{reviseLabel}
						</Button>
					) : null}
				</View>
			</View>
		</Card>
	);
};

export default DataSourceErrorBanner;

const styles = StyleSheet.create({
	card: {
		marginBottom: 12,
		padding: 12,
	},
	row: {
		flexDirection: "row",
		alignItems: "flex-start",
		gap: 12,
	},
	body: {
		flex: 1,
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		flexWrap: "wrap",
		gap: 8,
		marginBottom: 4,
	},
	chip: {
		alignSelf: "flex-start",
	},
	message: {
		marginTop: 4,
	},
	action: {
		alignSelf: "flex-start",
		marginTop: 12,
	},
});
