// Author(s): Holly Wyatt
//
// Read-only metadata card extracted out of the view-data-source screen.
// Renders name, type, status, last-update, created-at, plus the action row
// (view data, test connection, settings).

import React from "react";
import { View, StyleSheet } from "react-native";
import { Card, Text, Button, IconButton, useTheme } from "react-native-paper";
import { Link } from "expo-router";
import formatDateTime from "../../../../utils/format/formatISODate";

const DataSourceInfoCard = ({
	dataSource,
	editHref,
	previewLoading,
	onViewData,
	onTestConnection,
}) => {
	const theme = useTheme();
	const isApiSource = (dataSource?.sourceType || dataSource?.type) === "api";

	return (
		<Card style={styles.card}>
			<Card.Title title={dataSource.name} />
			<View style={styles.body}>
				<Text variant="bodyMedium">Type: {dataSource.sourceType}</Text>
				<Text variant="bodyMedium">Status: {dataSource.status}</Text>
				<Text variant="bodyMedium">Last Update: {formatDateTime(dataSource.lastUpdate)}</Text>
				<Text variant="bodyMedium">
					Created: {formatDateTime(dataSource.createdAt || dataSource.lastSync || null)}
				</Text>
				<View style={styles.actions}>
					<Button
						onPress={onViewData}
						mode="contained"
						disabled={previewLoading}
						style={styles.actionButton}
					>
						{previewLoading ? "Loading..." : "View Data"}
					</Button>
					{isApiSource ? (
						<Button
							onPress={onTestConnection}
							mode="outlined"
							icon="lan-pending"
							style={styles.actionButton}
						>
							Test Connection
						</Button>
					) : null}
					<Link href={editHref} asChild>
						<IconButton
							icon="cog"
							accessibilityLabel="Data source settings"
							mode="outlined"
							style={styles.settingsButton}
						/>
					</Link>
				</View>
			</View>
		</Card>
	);
};

export default DataSourceInfoCard;

const styles = StyleSheet.create({
	card: {
		marginBottom: 12,
	},
	body: {
		padding: 16,
	},
	actions: {
		flexDirection: "row",
		alignItems: "center",
		flexWrap: "wrap",
		marginTop: 12,
	},
	actionButton: {
		marginRight: 8,
		marginBottom: 8,
	},
	settingsButton: {
		marginBottom: 8,
	},
});
