// Author(s): Holly Wyatt, Noah Bradley

import { SectionList, View, Pressable, StyleSheet } from "react-native";
import { Text, IconButton, useTheme } from "react-native-paper";

import ProgressSummary from "../../../common/ProgressSummary";
import ThemedRefreshControl from "../../../common/ThemedRefreshControl";
import DataConnectionCard from "./DataConnectionCard";
import DataSourcesSummary from "./DataSourcesSummary";
import DataSourcesEmptyState from "./DataSourcesEmptyState";

import formatRelativeTime from "../../../../utils/format/formatRelativeTime";
import { getAdapterInfo, getCategoryDisplayName } from "../../../../adapters/day-book/data-sources/DataAdapterFactory";

const MICROMAX_PARENT_TYPE = "micromax-dashboard";
const MICROMAX_FILE_TYPE = "micromax-dashboard-file";

const DataSourcesList = ({
	dataSources,
	activeCount,
	errorCount,
	lastRefreshAt,
	refreshingSourceId,
	loading,
	isRefreshing,
	onRefresh,
	viewDataAllowed,
	manageDataSourcesAllowed,
	onNavigateToView,
	onNavigateToEdit,
	onDisconnect,
	onTest,
	onPreview,
	onRescan,
	onOpenMicromaxSettings,
}) => {
	const theme = useTheme();

	const micromaxParent = dataSources.find(
		(source) => (source.sourceType || source.type) === MICROMAX_PARENT_TYPE
	);

	const visibleSources = dataSources.filter(
		(source) => (source.sourceType || source.type) !== MICROMAX_PARENT_TYPE
	);

	const groupedSources = visibleSources.reduce((acc, source) => {
		const adapterInfo = getAdapterInfo(source.sourceType || source.type);
		const category = adapterInfo?.category || "other";
		if (!acc[category]) acc[category] = [];
		acc[category].push(source);
		return acc;
	}, {});

	if (micromaxParent && !groupedSources[MICROMAX_PARENT_TYPE]) {
		groupedSources[MICROMAX_PARENT_TYPE] = [];
	}

	const sections = Object.entries(groupedSources).map(([category, sources]) => {
		const isMicromax = category === MICROMAX_PARENT_TYPE;
		const showSettings = isMicromax && !!micromaxParent && manageDataSourcesAllowed;
		const emptyMessage = isMicromax
			? "No files have been received yet. Files uploaded to the export bucket will appear here automatically."
			: null;
		const processingCount = sources.filter(
			(s) => (s.status || "").toLowerCase() === "processing"
		).length;
		const data = sources.length === 0 && emptyMessage
			? [{ __empty: true, emptyMessage, dataSourceId: `${category}-empty` }]
			: sources;
		return {
			key: category,
			category,
			totalCount: sources.length,
			processingCount,
			showSettings,
			data,
		};
	});

	const renderDataSourceCard = (source) => {
		const adapterInfo = getAdapterInfo(source.sourceType || source.type);
		if (!adapterInfo) return null;

		const sourceType = source.sourceType || source.type;
		const isMicromaxFile = sourceType === MICROMAX_FILE_TYPE;
		const isRefreshingThis = refreshingSourceId === source.dataSourceId;

		const typeLabel = adapterInfo.displayName || adapterInfo.name || sourceType;
		const lastSyncText = source.lastUpdate ? `Last sync: ${formatRelativeTime(source.lastUpdate)}` : undefined;
		const subtitle = isRefreshingThis
			? `${typeLabel} - Refreshing...`
			: lastSyncText
				? `${typeLabel} - ${lastSyncText}`
				: typeLabel;

		return (
			<View style={styles.cardSpacing}>
				<DataConnectionCard
					label={source.name}
					subtitle={subtitle}
					status={source.status}
					progressStage={source.progressStage}
					progressPercent={source.progressPercent}
					onNavigate={() => onNavigateToView(source)}
					onDelete={isMicromaxFile ? undefined : () => onDisconnect(source)}
					onTest={isMicromaxFile ? undefined : () => onTest(source)}
					onSettings={() => onNavigateToEdit(source)}
					onViewData={() => onPreview(source)}
					onSync={
						isMicromaxFile && manageDataSourcesAllowed && !isRefreshingThis
							? () => onRescan(source)
							: undefined
					}
					viewDataAllowed={viewDataAllowed}
					manageDataSourceAllowed={manageDataSourcesAllowed}
				/>
			</View>
		);
	};

	const renderItem = ({ item }) => {
		if (item?.__empty) {
			return (
				<Pressable>
					<Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
						{item.emptyMessage}
					</Text>
				</Pressable>
			);
		}
		return renderDataSourceCard(item);
	};

	const renderSectionHeader = ({ section }) => {
		const showProgress = section.totalCount > 0 && section.processingCount > 0;
		const processedCount = section.totalCount - section.processingCount;
		return (
			<Pressable style={styles.sectionHeaderContainer}>
				<View style={styles.sectionHeaderRow}>
					<Text variant="titleMedium" style={styles.sectionTitle}>
						{getCategoryDisplayName(section.category)} ({section.totalCount})
					</Text>
					{section.showSettings && (
						<IconButton
							icon="cog-outline"
							size={20}
							onPress={onOpenMicromaxSettings}
							accessibilityLabel={`${getCategoryDisplayName(section.category)} settings`}
						/>
					)}
				</View>
				{showProgress && (
					<ProgressSummary
						label="Processing"
						processed={processedCount}
						total={section.totalCount}
					/>
				)}
			</Pressable>
		);
	};

	return (
		<SectionList
			style={styles.container}
			contentContainerStyle={styles.scrollContent}
			sections={sections}
			keyExtractor={(item, index) => item.dataSourceId || `${index}`}
			renderItem={renderItem}
			renderSectionHeader={renderSectionHeader}
			stickySectionHeadersEnabled={false}
			showsVerticalScrollIndicator={false}
			alwaysBounceVertical
			bounces
			overScrollMode="always"
			nestedScrollEnabled
			keyboardShouldPersistTaps="handled"
			refreshControl={
				<ThemedRefreshControl
					refreshing={isRefreshing}
					onRefresh={onRefresh}
					title="Pull to refresh"
				/>
			}
			ListHeaderComponent={
				dataSources.length > 0 ? (
					<Pressable>
						<DataSourcesSummary
							total={dataSources.length}
							activeCount={activeCount}
							errorCount={errorCount}
							lastRefreshAt={lastRefreshAt}
						/>
					</Pressable>
				) : null
			}
			ListEmptyComponent={!loading ? (
				<Pressable style={styles.emptyContainer}>
					<DataSourcesEmptyState />
				</Pressable>
			) : null}
		/>
	);
};

export default DataSourcesList;

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	scrollContent: {
		flexGrow: 1,
		paddingHorizontal: 20,
		paddingBottom: 12,
	},
	cardSpacing: {
		marginBottom: 12,
	},
	sectionHeaderContainer: {
		backgroundColor: "transparent",
	},
	sectionHeaderRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	sectionTitle: {
		marginBottom: 12,
	},
	emptyText: {
		fontSize: 13,
		marginBottom: 12,
		fontStyle: "italic",
	},
	emptyContainer: {
		flex: 1,
	},
});
