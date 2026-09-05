// Author(s): Holly Wyatt, Noah Bradley

import { View, StyleSheet } from "react-native";
import { Text, IconButton, useTheme } from "react-native-paper";

import ProgressSummary from "../../../common/ProgressSummary";
import { getCategoryDisplayName } from "../../../../adapters/day-book/data-sources/DataAdapterFactory";

const DataSourceCategorySection = ({
	category,
	sources,
	showSettings,
	onOpenSettings,
	renderSource,
	emptyMessage,
}) => {
	const theme = useTheme();

	const processingCount = sources.filter(
		(s) => (s.status || "").toLowerCase() === "processing"
	).length;
	const totalCount = sources.length;
	const processedCount = totalCount - processingCount;
	const showProgress = totalCount > 0 && processingCount > 0;
	const showEmpty = totalCount === 0 && !!emptyMessage;

	return (
		<View>
			<View style={styles.header}>
				<Text variant="titleMedium" style={styles.title}>
					{getCategoryDisplayName(category)} ({totalCount})
				</Text>
				{showSettings && (
					<IconButton
						icon="cog-outline"
						size={20}
						onPress={onOpenSettings}
						accessibilityLabel={`${getCategoryDisplayName(category)} settings`}
					/>
				)}
			</View>
			{showProgress && (
				<ProgressSummary
					label="Processing"
					processed={processedCount}
					total={totalCount}
				/>
			)}
			{showEmpty ? (
				<Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
					{emptyMessage}
				</Text>
			) : (
				sources.map(renderSource)
			)}
		</View>
	);
};

export default DataSourceCategorySection;

const styles = StyleSheet.create({
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	title: {
		marginBottom: 12,
	},
	emptyText: {
		fontSize: 13,
		marginBottom: 12,
		fontStyle: "italic",
	},
});
