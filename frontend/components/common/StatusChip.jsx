import { StyleSheet } from "react-native";
import { Chip, useTheme } from "react-native-paper";
import { STATUS_CONFIG, DEFAULT_STATUS_CONFIG } from "../../utils/constants/statusConfig";
import CircularProgress from "./CircularProgress";

const StatusChip = ({ status, progressPercent, style }) => {
	const theme = useTheme();

	if (!status) return null;

	const s = String(status).toLowerCase();
	const config = STATUS_CONFIG[s] || { ...DEFAULT_STATUS_CONFIG, label: status };
	const isProcessing = s === "processing";
	const fraction = typeof progressPercent === "number"
		? Math.max(0, Math.min(1, progressPercent / 100))
		: undefined;
	const textColor = theme.colors[config.textColorKey];

	const renderIcon = isProcessing
		? ({ size }) => (
			<CircularProgress
				progress={fraction}
				size={size}
				strokeWidth={2}
				color={textColor}
				trackColor="transparent"
				accessibilityLabel="Processing"
			/>
		)
		: config.icon;

	return (
		<Chip
			compact
			mode="flat"
			icon={renderIcon}
			style={[
				styles.chip,
				{ backgroundColor: theme.colors[config.colorKey] },
				style,
			]}
			textStyle={{ color: textColor }}
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
