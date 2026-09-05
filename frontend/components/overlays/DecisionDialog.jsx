// Author(s): Rhys Cleary

import { Dialog, Text } from "react-native-paper";
import BasicButton from "../common/buttons/BasicButton";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { signOut } from "aws-amplify/auth";
import CenteredDialog from "./CenteredDialog";


const DecisionDialog = ({
    visible,
    onDismiss,
    showGoBack = false,
    showSignOut = false,
    title = "",
    message = "",
    leftActionLabel = "Cancel",
    leftDanger = false,
    handleLeftAction = () => {},
    rightActionLabel = "Confirm",
    rightDanger = false,
    handleRightAction = () => {},
    handleGoBack = () => {}
}) => {
    return (
        <CenteredDialog visible={visible} onDismiss={onDismiss} title={title}>
            <View>
                <Dialog.Content>
                    <Text style={styles.message}>
                        {message}
                    </Text>
                </Dialog.Content>
            </View>


            <Dialog.Actions style={styles.actions}>
                <BasicButton
                    label={leftActionLabel}
                    danger={leftDanger}
                    onPress={handleLeftAction}
                />
                <BasicButton
                    label={rightActionLabel}
                    danger={rightDanger}
                    onPress={handleRightAction}
                />
            </Dialog.Actions>

            {showGoBack && (
                <View style={styles.bottomActionContainer}>
                    <TouchableOpacity onPress={handleGoBack}>
                        <Text>Go back</Text>
                    </TouchableOpacity>
                </View>
            )}
            {showSignOut && (
                <View style={styles.bottomActionContainer}>
                    <TouchableOpacity onPress={async () => {
                        try {
                            await signOut();
                        } catch (error) {
                            console.error(`Error signing out:`, error);
                        }
                    }}>
                        <Text>Sign Out</Text>
                    </TouchableOpacity>
                </View>
            )}
        </CenteredDialog>
    );
};

const styles = StyleSheet.create({
    message: {
        fontSize: 16,
        textAlign: "center",
    },
    actions: {
        justifyContent: "space-between"
    },
    bottomActionContainer: {
        alignItems: "center",
        marginBottom: 20
    }
})

export default DecisionDialog;
