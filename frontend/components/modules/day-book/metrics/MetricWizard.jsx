import React, { useState, useCallback } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import Header from "../../../layout/Header";
import ResponsiveScreen from "../../../layout/ResponsiveScreen";
import BasicButton from "../../../common/buttons/BasicButton";
import { simpleStyles } from "../../../../assets/styles/stylesheets/day-book/modules/metrics/simpleMetric";

export default function MetricWizard({ title = "New Metric", pages, onSubmit, loading = false, finishDisabled = false }) {
    const router = useRouter();
    const [step, setStep] = useState(0);
    const [submitting, setSubmitting] = useState(false);

    const isFirst = step === 0;
    const isLast = step === pages.length - 1;
    const current = pages[step];

    const handleBack = useCallback(() => {
        if (isFirst) {
            router.back();
        } else {
            setStep((s) => s - 1);
        }
    }, [isFirst, router]);

    const handleNext = useCallback(() => {
        if (current.validate && !current.validate()) return;
        setStep((s) => s + 1);
    }, [current]);

    const handleFinish = useCallback(async () => {
        if (current.validate && !current.validate()) return;
        setSubmitting(true);
        try {
            await onSubmit();
            router.navigate("modules/day-book/metrics");
        } catch (err) {
            console.error("[MetricWizard] Submit error:", err);
        } finally {
            setSubmitting(false);
        }
    }, [current, onSubmit, router]);

    const continueDisabled = current.validate ? !current.validate() : false;

    return (
        <ResponsiveScreen
            header={<Header title={title} showBack onBackPress={handleBack} />}
            center={false}
            padded
            scroll
            loadingOverlayActive={loading || submitting}
        >
            <View style={simpleStyles.content}>
                {current.component}

                <View style={{ alignItems: "flex-end" }}>
                    <BasicButton
                        label={isLast ? "Finish" : "Continue"}
                        onPress={isLast ? handleFinish : handleNext}
                        disabled={isLast ? (continueDisabled || finishDisabled) : continueDisabled}
                        style={simpleStyles.button}
                    />
                </View>
            </View>
        </ResponsiveScreen>
    );
}
