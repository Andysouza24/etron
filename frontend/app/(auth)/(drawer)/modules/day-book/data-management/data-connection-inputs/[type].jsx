// Dynamic connection-input route
// each adapter declares a wizard config or legacy ConnectionScreen, wizard taking priority

import React from "react";
import { useLocalSearchParams } from "expo-router";
import { Text } from "react-native-paper";

import ResponsiveScreen from "../../../../../../../components/layout/ResponsiveScreen";
import Header from "../../../../../../../components/layout/Header";
import {
    getConnectionScreen,
    getWizardConfig,
} from "../../../../../../../adapters/day-book/data-sources/DataAdapterFactory";
import WizardProvider from "../../../../../../../components/modules/day-book/data-sources/wizard/WizardContext";
import WizardScreen from "../../../../../../../components/modules/day-book/data-sources/wizard/WizardScreen";

const ConnectionInputRoute = () => {
    const { type } = useLocalSearchParams();
    const typeKey = Array.isArray(type) ? type[0] : type;

    const wizard = getWizardConfig(typeKey);
    if (wizard) {
        return (
            <WizardProvider
                type={typeKey}
                steps={wizard.steps}
                initialDraft={wizard.initialDraft}
                onFinalise={wizard.finalise}
            >
                <WizardScreen title={wizard.title || "New connection"} />
            </WizardProvider>
        );
    }

    const Screen = getConnectionScreen(typeKey);
    if (Screen) return <Screen />;

    return (
        <ResponsiveScreen
            header={<Header title="Connection" showBack />}
            center
        >
            <Text>Unknown connection type: {String(typeKey)}</Text>
        </ResponsiveScreen>
    );
};

export default ConnectionInputRoute;
