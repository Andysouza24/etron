import { View, StyleSheet } from "react-native";
import { Chip, useTheme } from "react-native-paper";
import { metricStepStyles } from "../../../../assets/styles/stylesheets/day-book/modules/metrics/metricStep";

// Pairs of metricsXxx <-> metricsXxxObverse theme tokens. Used to look up the
// obverse colour for a given metric colour so chips can flip background/text
// between the colour and its obverse based on selection.
const METRIC_COLOUR_TOKENS = [
    ["metricsPink", "metricsPinkObverse"],
    ["metricsOrange", "metricsOrangeObverse"],
    ["metricsYellow", "metricsYellowObverse"],
    ["metricsLime", "metricsLimeObverse"],
    ["metricsGreen", "metricsGreenObverse"],
    ["metricsBlue", "metricsBlueObverse"],
    ["metricsLightBlue", "metricsLightBlueObverse"],
    ["metricsPurple", "metricsPurpleObverse"],
];

function normaliseHex(value) {
    if (typeof value !== "string") return "";
    return value.trim().toLowerCase();
}

function buildObverseLookup(themeColors) {
    const map = new Map();
    for (const [colourKey, obverseKey] of METRIC_COLOUR_TOKENS) {
        const colour = normaliseHex(themeColors[colourKey]);
        const obverse = themeColors[obverseKey];
        if (colour && obverse) map.set(colour, obverse);
    }
    return map;
}

const VariableChipSelector = ({
    dependentVariables = [],
    colours = [],
    wheelIndex,
    setWheelIndex,
    aliases = {},
    onRenameVariable,
}) => {
    const theme = useTheme();
    const obverseLookup = buildObverseLookup(theme.colors);

    if (dependentVariables.length === 0) return null;

    // When no `setWheelIndex` is supplied, the selector is in display-only
    // mode: every chip renders as its variable's colour (no selection /
    // press interaction). Used by view-metric surfaces to label the
    // tracked values above the graph.
    const isDisplayOnly = typeof setWheelIndex !== "function";
    const canRename = typeof onRenameVariable === "function";

    return (
        <View style={metricStepStyles.chipRow}>
            {dependentVariables.map((variable, index) => {
                const isSelected = isDisplayOnly ? true : wheelIndex === index;
                const variableColor = colours[index] || theme.colors.primary;
                const obverseColor =
                    obverseLookup.get(normaliseHex(variableColor)) ?? theme.colors.onSurface;
                const fallbackName = variable ?? `Y${index + 1}`;
                const aliasName = variable != null ? aliases[variable] : null;
                const displayLabel = aliasName || fallbackName;
                const showRenameAffordance = !isDisplayOnly && canRename && isSelected;

                const handlePress = isDisplayOnly
                    ? undefined
                    : () => {
                          if (showRenameAffordance) {
                              onRenameVariable(variable, fallbackName);
                          } else {
                              setWheelIndex(index);
                          }
                      };

                return (
                    <Chip
                        key={index}
                        mode={isSelected ? "flat" : "outlined"}
                        selected={isSelected}
                        showSelectedCheck={false}
                        onPress={handlePress}
                        icon={showRenameAffordance ? "pencil-outline" : undefined}
                        selectedColor={isSelected ? obverseColor : variableColor}
                        style={[
                            styles.chip,
                            {
                                backgroundColor: isSelected ? variableColor : "transparent",
                                borderColor: variableColor,
                            },
                        ]}
                        textStyle={{ color: isSelected ? obverseColor : variableColor }}
                        accessibilityLabel={
                            isDisplayOnly
                                ? `Tracked value ${displayLabel}`
                                : showRenameAffordance
                                    ? `Rename ${fallbackName}`
                                    : `Select colour for ${displayLabel}`
                        }
                    >
                        {displayLabel}
                    </Chip>
                );
            })}
        </View>
    );
};

export default VariableChipSelector;

const styles = StyleSheet.create({
    chip: {
        borderWidth: 0,
        marginHorizontal: 0,
    },
});
