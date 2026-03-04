import { useRouter, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { useTheme } from "react-native-paper";


export default function useMetricForm({ totalSteps = 2, validate } = {}) {
    const router = useRouter();
    const theme = useTheme();
    const { metricType } = useLocalSearchParams();

    const [step, setStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

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

    const isFirstStep = step === 0;
    const isLastStep = step === totalSteps - 1;

    const handleBack = useCallback(() => {
        if (isFirstStep) {
            router.back();
        } else {
            setStep((prev) => prev - 1);
        }
    }, [isFirstStep, router]);

    const handleNext = useCallback(() => {
        if (validate && !validate(step)) return;
        setStep((prev) => prev + 1);
    }, [step, validate]);

    const handleFinish = useCallback(async (onSubmit) => {
        if (validate && !validate(step)) return;
        if (!metricName.trim()) return;
        setLoading(true);
        setError(null);
        try {
            await onSubmit();
            router.navigate("modules/day-book/metrics");
        } catch (err) {
            console.error("[useMetricForm] Error submitting metric form: ", err);
            setError(err);
        } finally {
            setLoading(false);
        }
    }, [step, validate, metricName, router]);

    return {
        // route param
        metricType,

        // step navigation
        step,
        setStep,
        isFirstStep,
        isLastStep,
        totalSteps,
        handleBack,
        handleNext,
        handleFinish,

        // shared custom fields
        metricName,
        setMetricName,
        coloursState,
        setColoursState,
        wheelIndex,
        setWheelIndex,

        // loading, error
        loading,
        setLoading,
        error,
        setError,
    }



}