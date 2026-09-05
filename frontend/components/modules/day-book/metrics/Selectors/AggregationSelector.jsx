import { View } from "react-native";
import { Checkbox, Text } from "react-native-paper";
import AggregationDropDown from "./AggregationDropDown";

export default function AggregationSelector({
    onAggregationSelect,
    selectedAggregation,
    checked,
    onCheckedChange,
}) {
    return (
        <View>
            <Text variant="labelSmall">Handle multiple identical date values</Text>
            <Checkbox
                status={checked ? "checked" : "unchecked"}
                onPress={() => onCheckedChange(!checked)}
            />

            {checked && (
                <AggregationDropDown
                    onAggregationSelect={onAggregationSelect}
                    selectedAggregation={selectedAggregation}
                />
            )}
        </View>
    );
}