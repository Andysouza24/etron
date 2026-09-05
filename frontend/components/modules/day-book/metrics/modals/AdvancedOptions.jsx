import { useState } from "react";
import { View } from "react-native";
import BasicButton from "../../../../common/buttons/BasicButton";
import OptionsHeader from "../OptionsHeader";
import SetAlerts from "./SetAlerts";
import SetThresholds from "./SetThresholds";

export default function AdvancedOptions({
    onBack,
    onNavigate,
    alerts,
    setAlerts,
    thresholds,
    setThresholds,
    dependentVariables,
    userId,
    workspaceId,
    workspaceUsers,
    graphData,
    yKeys,
    rawGraphData,
}) {
    const [alertsVisible, setAlertsVisible] = useState(false);
    const [thresholdsVisible, setThresholdsVisible] = useState(false);

    return (
        <View style={{ width: "100%" }}>
            <OptionsHeader onBack={onBack} />

            <BasicButton
                fullWidth
                label="Set Alerts"
                onPress={() => setAlertsVisible(true)}
            />

            <BasicButton
                fullWidth
                label="Set Thresholds"
                onPress={() => setThresholdsVisible(true)}
                style={{ marginTop: 16 }}
            />

            <SetAlerts
                visible={alertsVisible}
                onDismiss={() => setAlertsVisible(false)}
                alerts={alerts}
                setAlerts={setAlerts}
                dependentVariables={dependentVariables}
                userId={userId}
                workspaceId={workspaceId}
                workspaceUsers={workspaceUsers}
            />

            <SetThresholds
                visible={thresholdsVisible}
                onDismiss={() => setThresholdsVisible(false)}
                thresholds={thresholds}
                setThresholds={setThresholds}
                dependentVariables={dependentVariables}
                graphData={graphData}
                yKeys={yKeys}
                rawGraphData={rawGraphData}
            />
        </View>
    );
}