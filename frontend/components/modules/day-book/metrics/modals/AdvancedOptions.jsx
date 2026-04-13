import { useState } from "react";
import { View } from "react-native";
import BasicButton from "../../../../common/buttons/BasicButton";
import OptionsHeader from "../OptionsHeader";
import SetAlerts from "./SetAlerts";

export default function AdvancedOptions({ onBack, onNavigate, alerts, setAlerts }) {
    const [alertsVisible, setAlertsVisible] = useState(false);

    return (
        <View style={{ width: "100%" }}>
            <OptionsHeader onBack={onBack} />

            <BasicButton
                fullWidth
                label="Set Alerts"
                onPress={() => setAlertsVisible(true)}
            />

            <SetAlerts visible={alertsVisible} onDismiss={() => setAlertsVisible(false)} alerts={alerts} setAlerts={setAlerts} />
        </View>
    );
}