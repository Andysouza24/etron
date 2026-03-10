import { View } from "react-native";
import BasicButton from "../../../common/buttons/BasicButton";
import OptionsHeader from "./OptionsHeader";



export default function Appearance({ onBack, onNavigate }) {

    return (
        <View style={{ width: "100%" }}>
            <OptionsHeader onBack={onBack} />
            <BasicButton
                fullWidth
                label="Back"
                onPress={onBack}
            />
        </View>
    );
}