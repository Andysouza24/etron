import { StyleSheet, View } from "react-native";
import { Chip, Icon, Text, useTheme } from "react-native-paper";

// Labels the metric's independent (date) variable below the graph.
//
// Two modes:
//   - Display-only (no `onRename`): a centred icon + labelMedium text in
//     onSurface colour, sitting tight under the x-axis labels.
//   - Renameable (`onRename` supplied): a Paper Chip in the
//     primaryContainer / onPrimaryContainer palette that acts as a
//     rename affordance during metric creation. Text size matches the
//     display-only label (labelMedium).
const IndependentVariableChip = ({ independentVariable, alias, onRename }) => {
    const theme = useTheme();

    if (!independentVariable) return null;

    const displayLabel = alias || independentVariable;
    const canRename = typeof onRename === "function";

    if (canRename) {
        return (
            <View style={styles.chipRow}>
                <Chip
                    mode="flat"
                    compact
                    icon="pencil-outline"
                    onPress={() => onRename(independentVariable)}
                    selectedColor={theme.colors.onPrimaryContainer}
                    style={{ backgroundColor: theme.colors.primaryContainer }}
                    textStyle={[
                        styles.chipText,
                        { color: theme.colors.onPrimaryContainer },
                    ]}
                    accessibilityLabel={`Rename ${independentVariable}`}
                >
                    {displayLabel}
                </Chip>
            </View>
        );
    }

    const color = theme.colors.darkNeutral;
    return (
        <View
            style={styles.labelContainer}
            accessibilityLabel={`Date variable: ${displayLabel}`}
        >
            <View style={styles.labelRow}>
                <Icon source="calendar" size={16} color={color} />
                <Text variant="labelSmall" style={[styles.labelText, { color }]}>
                    {displayLabel}
                </Text>
            </View>
        </View>
    );
};

export default IndependentVariableChip;

const styles = StyleSheet.create({
    chipRow: {
        flexDirection: "row",
        justifyContent: "center",
    },
    chipText: {
        fontSize: 12,
        lineHeight: 16,
    },
    labelContainer: {
        alignItems: "center",
        marginTop: -8,
    },
    labelRow: {
        flexDirection: "row",
        alignItems: "center",
    },
    labelText: {
        marginLeft: 4,
    },
});
