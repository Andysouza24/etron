// wizard shell
// renders header, step indicator, error banner, active step component
// step component own primary actions (continue, back, create) - can be shaped by adapters

import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

import ResponsiveScreen from "../../../../layout/ResponsiveScreen";
import Header from "../../../../layout/Header";
import StackLayout from "../../../../layout/StackLayout";
import WizardStepIndicator from "./WizardStepIndicator";
import { commonStyles } from "../../../../../assets/styles/stylesheets/common";
import { useWizard } from "./WizardContext";

const WizardScreen = ({ title }) => {
    const theme = useTheme();
    const { activeStep, steps, activeStepIndex, error, loading } = useWizard();
    const StepComponent = activeStep?.Component;

    return (
        <ResponsiveScreen
            header={<Header title={title} showBack />}
            scroll={false}
            center={false}
            loadingOverlayActive={loading}
        >
            <ScrollView contentContainerStyle={commonStyles.scrollableContentContainer}>
                <StackLayout spacing={16}>
                    <WizardStepIndicator steps={steps} activeIndex={activeStepIndex} />

                    {error ? (
                        <View
                            style={[
                                styles.errorBanner,
                                { backgroundColor: theme.colors.errorContainer },
                            ]}
                        >
                            <Text style={{ color: theme.colors.onErrorContainer }}>
                                {error}
                            </Text>
                        </View>
                    ) : null}

                    {StepComponent ? (
                        <StepComponent {...(activeStep.props || {})} />
                    ) : (
                        <Text>No step to render.</Text>
                    )}
                </StackLayout>
            </ScrollView>
        </ResponsiveScreen>
    );
};

const styles = StyleSheet.create({
    errorBanner: {
        padding: 12,
        borderRadius: 8,
    },
});

export default WizardScreen;
