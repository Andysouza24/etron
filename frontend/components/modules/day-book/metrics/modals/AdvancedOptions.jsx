import { View } from "react-native";
import BasicButton from "../../../../common/buttons/BasicButton";



export default function AdvancedOptions({ onBack, onNavigate }) {

    return (
        <View>
            <BasicButton
                fullWidth
                label="Back"
                onPress={onBack}
            />
        </View>
    );
}