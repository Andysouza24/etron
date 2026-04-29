// Author(s): Holly Wyatt

import { RefreshControl } from "react-native";
import { useTheme } from "react-native-paper";

const ThemedRefreshControl = ({ refreshing, onRefresh, title, ...rest }) => {
	const theme = useTheme();
	return (
		<RefreshControl
			refreshing={refreshing}
			onRefresh={onRefresh}
			tintColor={theme.colors.primary}
			colors={[theme.colors.primary]}
			progressBackgroundColor={theme.colors.elevation?.level2 ?? theme.colors.surface}
			title={title}
			titleColor={theme.colors.onSurfaceVariant}
			{...rest}
		/>
	);
};

export default ThemedRefreshControl;
