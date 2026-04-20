import { View, StyleSheet } from "react-native";
import { Text, useTheme } from "react-native-paper";
import SelectableChip from "./SelectableChip";

const BACKGROUND_OPTIONS = ["white", "black", "transparent"];
const AXIS_OPTIONS = [
    { value: "dark", label: "White axes" },
    { value: "light", label: "Black axes" },
];

const ExportChipGroup = ({
    backgroundMode,
    onBackgroundChange,
    axisColorMode,
    onAxisColorChange,
}) => {
    const theme = useTheme();

    return (
        <View>
            <View style={styles.section}>
                <Text variant="titleSmall" style={styles.sectionHeader}>
                    Choose Background
                </Text>
                <View style={styles.chipRow}>
                    {BACKGROUND_OPTIONS.map((color) => (
                        <SelectableChip
                            key={color}
                            selected={backgroundMode === color}
                            onPress={() => onBackgroundChange(color)}
                            accessibilityLabel={`Background: ${color}`}
                        >
                            {color.charAt(0).toUpperCase() + color.slice(1)}
                        </SelectableChip>
                    ))}
                </View>
            </View>

            <View style={styles.section}>
                <Text variant="titleSmall" style={styles.sectionHeader}>
                    Axis Colours
                </Text>
                <View style={styles.chipRow}>
                    {AXIS_OPTIONS.map((opt) => (
                        <SelectableChip
                            key={opt.value}
                            selected={axisColorMode === opt.value}
                            onPress={() => onAxisColorChange(opt.value)}
                            accessibilityLabel={`Axis colour: ${opt.label}`}
                        >
                            {opt.label}
                        </SelectableChip>
                    ))}
                </View>
            </View>
        </View>
    );
};

export default ExportChipGroup;

const styles = StyleSheet.create({
    section: {
        width: "100%",
        marginBottom: 16,
    },
    sectionHeader: {
        marginBottom: 8,
    },
    chipRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
    },
});
