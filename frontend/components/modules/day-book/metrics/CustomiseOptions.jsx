import { useState } from "react";
import { View } from "react-native";
import BasicButton from "../../../common/buttons/BasicButton";
import Appearance from "./Appearance";
import AdvancedOptions from "./modals/AdvancedOptions";



export default function CustomiseOptions() {
    const [view, setView] = useState("menu");

    if (view !== "menu") {
        const Component = view === "appearance" ? Appearance : AdvancedOptions;
        return <Component onBack={() => setView("menu")} onNavigate={setView} />;
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