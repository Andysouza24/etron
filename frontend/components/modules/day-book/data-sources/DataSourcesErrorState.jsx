// Author(s): Holly Wyatt, Noah Bradley

import { View, Pressable, StyleSheet } from "react-native";
import { Text, useTheme } from "react-native-paper";

const DataSourcesErrorState = ({ message, onRetry }) => {
	const theme = useTheme();

	return (
		<View style={styles.container}>
			<Text variant="headlineSmall" style={styles.title}>
				Unable to Load Data Sources
			</Text>
			<Text variant="bodyMedium" style={styles.message}>
				{message}
			</Text>
			<Pressable style={styles.retryButton} onPress={onRetry}>
				<Text style={[styles.retryText, { color: theme.colors.primary }]}>Try Again</Text>
			</Pressable>
		</View>
	);
};

export default DataSourcesErrorState;

const styles = StyleSheet.create({
	container: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		paddingHorizontal: 32,
	},
	title: {
		marginBottom: 8,
		textAlign: "center",
	},
	message: {
		marginBottom: 16,
		textAlign: "center",
	},
	retryButton: {
		paddingHorizontal: 24,
		borderRadius: 8,
		marginTop: 8,
	},
	retryText: {
		fontWeight: "600",
	},
});
