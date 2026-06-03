// Author(s): Holly Wyatt
//
// Banner shown on metric detail screens when the underlying data source is
// in an error state. Tells the user the data may be out of date and that
// an administrator can resolve the issue.

import React from "react";
import { View, StyleSheet } from "react-native";
import { Text, useTheme, Icon } from "react-native-paper";

const DataSourceErrorNotice = ({ message, style }) => {
	const theme = useTheme();

	return (
		<View
			accessibilityRole="alert"
			style={[
				styles.container,
				{ backgroundColor: theme.colors.errorContainer },
				style,
			]}
		>
			<Icon source="alert-circle-outline" size={20} color={theme.colors.onErrorContainer} />
			<View style={styles.body}>
				<Text
					variant="titleSmall"
					style={[styles.title, { color: theme.colors.onErrorContainer }]}
				>
					Data source error
				</Text>
				<Text variant="bodySmall" style={{ color: theme.colors.onErrorContainer }}>
					{message
						|| "The information shown may not be up to date. Contact an administrator for support."}
				</Text>
			</View>
		</View>
	);
};

export default DataSourceErrorNotice;

const styles = StyleSheet.create({
	container: {
		flexDirection: "row",
		alignItems: "flex-start",
		gap: 10,
		padding: 12,
		borderRadius: 12,
		marginBottom: 12,
	},
	body: {
		flex: 1,
	},
	title: {
		fontWeight: "600",
		marginBottom: 2,
	},
});
