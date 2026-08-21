// Author(s): Holly Wyatt, Noah Bradley

import { View, StyleSheet } from "react-native";
import { Text, useTheme } from "react-native-paper";

const DataSourcesEmptyState = () => {
	const theme = useTheme();

	return (
		<View style={styles.container}>
			<Text variant="headlineSmall" style={styles.title}>
				No Data Sources Connected
			</Text>
			<Text variant="bodyMedium" style={[styles.message, { color: theme.colors.onSurfaceVariant }]}>
				Connect your first data source to start tracking your data.
			</Text>
		</View>
	);
};

export default DataSourcesEmptyState;

const styles = StyleSheet.create({
	container: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		paddingHorizontal: 32,
		paddingVertical: 48,
	},
	title: {
		marginBottom: 8,
		textAlign: "center",
	},
	message: {
		marginBottom: 24,
		textAlign: "center",
	},
});
