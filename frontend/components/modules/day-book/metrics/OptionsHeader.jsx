import { View } from "react-native";
import IconButton from "../../../common/buttons/IconButton";


export default function OptionsHeader({ onBack, onSave, onCancel }) {

    return (
        <View style={{ flexDirection: "row", justifyContent: "space-between", width: "100%", marginTop: 16 }}>
            <IconButton
                icon="chevron-left"
                onPress={onBack}
                mode="text"
                backgroundColor="transparent"
            />
            {onSave && (
                <IconButton
                    icon="check"
                    onPress={onSave}
                    mode="text"
                    backgroundColor="transparent"
                />
            )}
            {onCancel && (
                <IconButton
                    icon="close"
                    onPress={onCancel}
                    mode="text"
                    backgroundColor="transparent"
                />
            )}
        </View>
    );
};