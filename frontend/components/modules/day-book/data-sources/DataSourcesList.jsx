// Author(s): Holly Wyatt, Noah Bradley

import { SectionList, View, Pressable, StyleSheet } from "react-native";
import { Text } from "react-native-paper";

import ProgressSummary from "../../../common/ProgressSummary";
import ThemedRefreshControl from "../../../common/ThemedRefreshControl";
import DataConnectionCard from "./DataConnectionCard";
import DashboardConnectionCard from "./DashboardConnectionCard";
import DataSourcesSummary from "./DataSourcesSummary";
import DataSourcesEmptyState from "./DataSourcesEmptyState";

import formatRelativeTime from "../../../../utils/format/formatRelativeTime";
import { getAdapterInfo, getCategoryDisplayName } from "../../../../adapters/day-book/data-sources/DataAdapterFactory";
import featureFlags from "../../../../adapters/day-book/data-sources/featureFlags";

// Dashboard adapter pairs: each entry pairs a parent source type with its
// child file source type. Adding a new parent/file pipeline only requires
// extending this list (and creating the matching adapter on the backend).
// Pairs can be gated behind a feature flag so they can be hidden from the UI
// without removing the underlying adapter code.
const DASHBOARD_PAIRS = [
	{ parent: "micromax-dashboard", file: "micromax-dashboard-file" },
	...(featureFlags.testConnection
		? [{ parent: "test-connection", file: "test-connection-file" }]
		: []),
];
const DASHBOARD_PARENT_TYPES = DASHBOARD_PAIRS.map((p) => p.parent);
const DASHBOARD_FILE_TYPES = DASHBOARD_PAIRS.map((p) => p.file);
const isDashboardParentType = (type) => DASHBOARD_PARENT_TYPES.includes(type);
const isDashboardFileType = (type) => DASHBOARD_FILE_TYPES.includes(type);

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
	onDisconnect,
	onPreview,
	onToggleEnabled,
	onOpenDashboardSettings,
}) => {

	// dashboard parents are rendered as single cards that summarise all of their
	// file children - the children themselves are hidden from this screen and
	// shown inside the dashboard settings page instead.
	const dashboardParents = dataSources.filter((source) =>
		isDashboardParentType(source.sourceType || source.type)
	);

	const childrenByParentId = dataSources.reduce((acc, source) => {
		const parentId = source.config?.parentDataSourceId;
		if (parentId) {
			if (!acc[parentId]) acc[parentId] = [];
			acc[parentId].push(source);
		}
		return acc;
	}, {});

	// every non-dashboard / non-file-child source feeds the regular sectioned list
	const visibleSources = dataSources.filter((source) => {
		const type = source.sourceType || source.type;
		if (isDashboardParentType(type)) return false;
		if (isDashboardFileType(type)) return false;
		return true;
	});

	const groupedSources = visibleSources.reduce((acc, source) => {
		const adapterInfo = getAdapterInfo(source.sourceType || source.type);
		const category = adapterInfo?.category || "other";
		if (!acc[category]) acc[category] = [];
		acc[category].push(source);
		return acc;
	}, {});

	const sections = Object.entries(groupedSources).map(([category, sources]) => {
		const processingCount = sources.filter(
			(s) => (s.status || "").toLowerCase() === "processing"
		).length;
		return {
			key: category,
			category,
			totalCount: sources.length,
			processingCount,
			data: sources,
		};
	});

	const renderDataSourceCard = (source) => {
		const adapterInfo = getAdapterInfo(source.sourceType || source.type);
		if (!adapterInfo) return null;

		const isRefreshingThis = refreshingSourceId === source.dataSourceId;
		const isEnabled = source.enabled !== false;

		// per spec: cards show last updated/synced time instead of the type label
		const subtitle = isRefreshingThis
			? "Refreshing..."
			: !isEnabled
				? "Disabled"
				: source.lastUpdate
					? `Last sync: ${formatRelativeTime(source.lastUpdate)}`
					: "Not synced yet";

		return (
			<View style={styles.cardSpacing}>
				<DataConnectionCard
					label={source.name}
					subtitle={subtitle}
					status={source.status}
					progressPercent={source.progressPercent}
					onNavigate={() => onNavigateToView(source)}
					onDelete={() => onDisconnect(source)}
					onViewData={() => onPreview(source)}
					viewDataAllowed={viewDataAllowed}
					manageDataSourceAllowed={manageDataSourcesAllowed}
				/>
			</View>
		);
	};

	const renderDashboardParentCard = (parent) => {
		const children = childrenByParentId[parent.dataSourceId] || [];
		const isEnabled = parent.enabled !== false;
		const fileLabel = `${children.length} file${children.length === 1 ? "" : "s"}`;
		const subtitle = !isEnabled
			? "Disabled"
			: parent.lastUpdate
				? `${fileLabel} · Last sync ${formatRelativeTime(parent.lastUpdate)}`
				: fileLabel;

		return (
			<View key={parent.dataSourceId} style={styles.cardSpacing}>
				<DashboardConnectionCard
					label={parent.name || getCategoryDisplayName(parent.sourceType)}
					subtitle={subtitle}
					status={parent.status}
					progressPercent={parent.progressPercent}
					enabled={isEnabled}
					onNavigate={() => onOpenDashboardSettings?.(parent)}
					onToggleEnabled={(next) => onToggleEnabled?.(parent, next)}
					manageDataSourceAllowed={manageDataSourcesAllowed}
				/>
			</View>
		);
	};

	const renderItem = ({ item }) => renderDataSourceCard(item);

	const renderSectionHeader = ({ section }) => {
		const showProgress = section.totalCount > 0 && section.processingCount > 0;
		const processedCount = section.totalCount - section.processingCount;
		return (
			<Pressable style={styles.sectionHeaderContainer}>
				<View style={styles.sectionHeaderRow}>
					<Text variant="titleMedium" style={styles.sectionTitle}>
						{getCategoryDisplayName(section.category)} ({section.totalCount})
					</Text>
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

	const ListHeader = (
		<>
			{dataSources.length > 0 ? (
				<Pressable>
					<DataSourcesSummary
						total={dataSources.length}
						activeCount={activeCount}
						errorCount={errorCount}
						lastRefreshAt={lastRefreshAt}
					/>
				</Pressable>
			) : null}
			{dashboardParents.map(renderDashboardParentCard)}
		</>
	);

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
			ListHeaderComponent={ListHeader}
			ListEmptyComponent={
				!loading && dashboardParents.length === 0 ? (
					<Pressable style={styles.emptyContainer}>
						<DataSourcesEmptyState />
					</Pressable>
				) : null
			}
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
