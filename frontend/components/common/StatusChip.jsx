import { StyleSheet } from "react-native";
import { Chip, useTheme } from "react-native-paper";
import { STATUS_CONFIG, DEFAULT_STATUS_CONFIG } from "../../utils/constants/statusConfig";

const StatusChip = ({ status, style }) => {
	const theme = useTheme();

	if (!status) return null;

	const s = String(status).toLowerCase();
	const config = STATUS_CONFIG[s] || { ...DEFAULT_STATUS_CONFIG, label: status };

	return (
		<Chip
			compact
			mode="flat"
			icon={config.icon}
			style={[
				styles.chip,
				{ backgroundColor: theme.colors[config.colorKey] },
				style,
			]}
			textStyle={{ color: theme.colors[config.textColorKey] }}
			accessibilityLabel={`Status: ${config.label}`}
		>
			{config.label}
		</Chip>
	);
};

export default StatusChip;

const styles = StyleSheet.create({
	chip: {
		alignSelf: "center",
	},
});
