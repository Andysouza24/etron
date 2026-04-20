import { View } from "react-native";
import SelectableChip from "../../../common/SelectableChip";
import { metricStepStyles } from "../../../../assets/styles/stylesheets/day-book/modules/metrics/metricStep";

const VariableChipSelector = ({ dependentVariables = [], wheelIndex, setWheelIndex }) => {
    if (dependentVariables.length === 0) return null;

    return (
        <View style={metricStepStyles.chipRow}>
            {dependentVariables.map((variable, index) => (
                <SelectableChip
                    key={index}
                    selected={wheelIndex === index}
                    onPress={() => setWheelIndex(index)}
                    style={{ marginTop: 8 }}
                    accessibilityLabel={`Select colour for ${variable ?? `Variable ${index + 1}`}`}
                >
                    {variable ?? `Y${index + 1}`}
                </SelectableChip>
            ))}
        </View>
    );
};

export default VariableChipSelector;
