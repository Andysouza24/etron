// Author(s): Rhys Cleary

import { Dialog, Text, useTheme } from "react-native-paper";
import BasicButton from "../common/buttons/BasicButton";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import TextField from "../common/input/TextField";
import CenteredDialog from "./CenteredDialog";


const VerificationDialog = ({
    visible,
    code,
    setCode,
    onConfirm,
    onResend,
    onLater,
    resendCooldown = 0,
    error
}) => {
    const theme = useTheme();

    return (
        <CenteredDialog visible={visible} title="Verify Email">
            <Dialog.Content>
                <Text style={styles.message}>Please enter the verification code that has been emailed to you.</Text>
                <View style={styles.inputContainer}>
                    <TextField
                        placeholder="Code"
                        value={code}
                        onChangeText={setCode}
                        keyboardType="numeric"
                        error={!!error}
                        contentStyle={{ textAlign: "center" }}
                    />
                </View>

                {error ? (
                    <Text style={{color: theme.colors.error, marginTop: 10, textAlign: "center"}}>
                        {error}
                    </Text>
                ) : null}
            </Dialog.Content>


            <Dialog.Actions style={styles.actions}>
                <View style={{gap: 10, flexDirection: "row", justifyContent: "space-between"}}>
                    <BasicButton
                        label="Do this later"
                        onPress={onLater}
                    />
                    <BasicButton
                        label="Confirm"
                        onPress={onConfirm}
                        disabled={code.length === 0}
                    />
                </View>
            </Dialog.Actions>

            <View style={styles.resendContainer}>
                <TouchableOpacity
                    onPress={onResend}
                    disabled={resendCooldown > 0}
                >
                    <Text
                        style={[
                            styles.resendText,
                            resendCooldown > 0 && { color: theme.colors.error}
                        ]}
                    >
                        {resendCooldown > 0
                            ? `Resend code in ${resendCooldown}s`
                            : <BasicButton label="Resend code"/>
                        }
                    </Text>

                </TouchableOpacity>
            </View>
        </CenteredDialog>
    );
};

const styles = StyleSheet.create({
    inputContainer: {
        marginTop: 20,
        width: 200,
        alignSelf: "center"
    },
    message: {
        fontSize: 16,
        textAlign: "center",
    },
    actions: {
        marginTop: 20,
        justifyContent: "space-between"
    },
    resendContainer: {
        alignItems: "center",
        marginBottom: 20
    },
    resendText: {
        fontSize: 14,
    }
})

export default VerificationDialog;
