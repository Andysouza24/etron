import { View } from "react-native";
import BasicButton from "../../../common/buttons/BasicButton";
import DropDown from "../../../common/input/DropDown";
import TextField from "../../../common/input/TextField";
import OptionsHeader from "./OptionsHeader";
import GraphTypes from "./graph-types";



const BOX_GROUPING_ITEMS = [
    { value: "yKey", label: "Per value field" },
    { value: "xValue", label: "Per X value" },
    { value: "timePeriod", label: "Per time period" },
];

const BOX_TIME_PERIOD_ITEMS = [
    { value: "month", label: "Month" },
    { value: "quarter", label: "Quarter" },
    { value: "year", label: "Year" },
];

export default function Appearance({
    onBack,
    selectedMetric,
    setSelectedMetric,
    maxValue,
    setMaxValue,
    boxGrouping,
    setBoxGrouping,
    boxTimePeriod,
    setBoxTimePeriod,
}) {
    const isProgress = selectedMetric === "progressBar" || selectedMetric === "progressCircle";
    const isBox = selectedMetric === "box";

    return (
        <View style={{ width: "100%" }}>
            <OptionsHeader onBack={onBack} />

            <DropDown
                title="Select Display Type"
                items={Object.values(GraphTypes).map((g) => ({
                    value: g.value,
                    label: g.label,
                }))}
                showRouterButton={false}
                onSelect={setSelectedMetric}
                value={selectedMetric}
            />

            {isProgress && (
                <TextField
                    label="Value Required For 100%"
                    placeholder="100"
                    value={String(maxValue ?? 100)}
                    onChangeText={(text) => {
                        const parsed = Number(text);
                        setMaxValue(Number.isFinite(parsed) && parsed > 0 ? parsed : 100);
                    }}
                />
            )}

            {isBox && (
                <>
                    <DropDown
                        title="Box Plot Grouping"
                        items={BOX_GROUPING_ITEMS}
                        showRouterButton={false}
                        onSelect={setBoxGrouping}
                        value={boxGrouping}
                    />

                    {boxGrouping === "timePeriod" && (
                        <DropDown
                            title="Time Period"
                            items={BOX_TIME_PERIOD_ITEMS}
                            showRouterButton={false}
                            onSelect={setBoxTimePeriod}
                            value={boxTimePeriod}
                        />
                    )}
                </>
            )}

            <BasicButton
                fullWidth
                label="Back"
                onPress={onBack}
            />
        </View>
    );
}