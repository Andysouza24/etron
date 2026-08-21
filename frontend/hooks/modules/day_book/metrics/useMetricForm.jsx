import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTheme } from "react-native-paper";


export default function useMetricForm() {
    const theme = useTheme();
    const { metricType } = useLocalSearchParams();

    const [metricName, setMetricName] = useState("");
    const [coloursState, setColoursState] = useState([
        theme.colors.metricsPink,
        theme.colors.metricsOrange,
        theme.colors.metricsYellow,
        theme.colors.metricsLime,
        theme.colors.metricsGreen,
        theme.colors.metricsBlue,
        theme.colors.metricsLightBlue,
        theme.colors.metricsPurple,
    ]);

    const [wheelIndex, setWheelIndex] = useState(0);

    return {
        metricType,
        metricName,
        setMetricName,
        coloursState,
        setColoursState,
        wheelIndex,
        setWheelIndex,
    };
}