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
    capPercentAt100,
    setCapPercentAt100,
    boxGrouping,
    setBoxGrouping,
    boxTimePeriod,
    setBoxTimePeriod,
    pieLabelPlacement,
    setPieLabelPlacement,
    rounding,
    setRounding,
    numberFormat,
    setNumberFormat,
    percentRounding,
    setPercentRounding,
    axisNumberFormat,
    setAxisNumberFormat,
    rawGraphData,
    boxUseRawData,
    setBoxUseRawData,
    alerts,
    setAlerts,
    dependentVariables,
    userId,
    workspaceId,
    workspaceUsers,
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
                    capPercentAt100={capPercentAt100}
                    setCapPercentAt100={setCapPercentAt100}
                    boxGrouping={boxGrouping}
                    setBoxGrouping={setBoxGrouping}
                    boxTimePeriod={boxTimePeriod}
                    setBoxTimePeriod={setBoxTimePeriod}
                    pieLabelPlacement={pieLabelPlacement}
                    setPieLabelPlacement={setPieLabelPlacement}
                    rounding={rounding}
                    setRounding={setRounding}
                    numberFormat={numberFormat}
                    setNumberFormat={setNumberFormat}
                    percentRounding={percentRounding}
                    setPercentRounding={setPercentRounding}
                    axisNumberFormat={axisNumberFormat}
                    setAxisNumberFormat={setAxisNumberFormat}
                    rawGraphData={rawGraphData}
                    boxUseRawData={boxUseRawData}
                    setBoxUseRawData={setBoxUseRawData}
                />
            );
        }

        return <AdvancedOptions
            onBack={() => setView("menu")}
            onNavigate={setView}
            alerts={alerts}
            setAlerts={setAlerts}
            dependentVariables={dependentVariables}
            userId={userId}
            workspaceId={workspaceId}
            workspaceUsers={workspaceUsers}
        />;
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