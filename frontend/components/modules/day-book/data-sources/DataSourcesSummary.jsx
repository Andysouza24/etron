// Author(s): Holly Wyatt, Noah Bradley

import { View, StyleSheet } from "react-native";
import { Text, useTheme } from "react-native-paper";

const DataSourcesSummary = ({ total, activeCount, errorCount, lastRefreshAt }) => {
	const theme = useTheme();

	return (
		<View style={styles.container}>
			<Text variant="titleMedium" style={styles.title}>
				Summary
			</Text>
			<View style={styles.row}>
				<Text>Total Sources: {total}</Text>
				<Text>Active: {activeCount}</Text>
				<Text>Errors: {errorCount}</Text>
			</View>
			{lastRefreshAt > 0 && (
				<Text style={[styles.lastUpdate, { color: theme.colors.onSurfaceVariant }]}>
					Last refreshed: {new Date(lastRefreshAt).toLocaleTimeString()}
				</Text>
			)}
		</View>
	);
};

export default DataSourcesSummary;

const styles = StyleSheet.create({
	container: {
		marginBottom: 24,
		padding: 16,
		borderRadius: 8,
	},
	title: {
		marginBottom: 8,
	},
	row: {
		flexDirection: "row",
		justifyContent: "space-between",
		marginBottom: 8,
	},
	lastUpdate: {
		fontSize: 12,
		fontStyle: "italic",
	},
});
