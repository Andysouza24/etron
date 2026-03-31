import { useState } from "react";
import { View } from "react-native";
import BasicButton from "../../../common/buttons/BasicButton";
import Appearance from "./Appearance";
import AdvancedOptions from "./modals/AdvancedOptions";

export default function CustomiseOptions({
    selectedMetric,
    setSelectedMetric,
    maxValue,
    setMaxValue,
    boxGrouping,
    setBoxGrouping,
    boxTimePeriod,
    setBoxTimePeriod,
}) {
    const [view, setView] = useState("menu");

    if (view !== "menu") {
        if (view === "appearance") {
            return (
                <Appearance
                    onBack={() => setView("menu")}
                    onNavigate={setView}
                    selectedMetric={selectedMetric}
                    setSelectedMetric={setSelectedMetric}
                    maxValue={maxValue}
                    setMaxValue={setMaxValue}
                    boxGrouping={boxGrouping}
                    setBoxGrouping={setBoxGrouping}
                    boxTimePeriod={boxTimePeriod}
                    setBoxTimePeriod={setBoxTimePeriod}
                />
            );
        }

        return <AdvancedOptions onBack={() => setView("menu")} onNavigate={setView} />;
    }

    return (
        <View style={{ width: "100%" }}>
            <BasicButton
                fullWidth
                label="Appearance"
                onPress={() => setView("appearance")}
            />
            <BasicButton
                fullWidth
                label="Advanced Options"
                onPress={() => setView("advancedOptions")}
            />
        </View>
    );
}