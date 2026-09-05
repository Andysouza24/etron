import { Dialog, Portal, useTheme } from "react-native-paper";
import { StyleSheet, Keyboard, Pressable } from "react-native";
import { useEffect } from "react";

// Shared shell for centered message dialogs (DecisionDialog, VerificationDialog).
// Owns the Portal/Dialog/Pressable wrapper, the centered title, and the
// dismiss-keyboard-on-open behaviour. Callers provide content/actions as children.
const CenteredDialog = ({
    visible,
    onDismiss,
    title = "",
    children,
}) => {
    const theme = useTheme();

    useEffect(() => {
        if (visible) Keyboard.dismiss();
    }, [visible]);

    return (
        <Portal>
            <Dialog
                visible={visible}
                onDismiss={onDismiss}
                style={[styles.dialog, { backgroundColor: theme.colors.surface }]}
            >
                <Pressable onPressIn={Keyboard.dismiss} android_disableSound>
                    <Dialog.Title style={styles.title}>{title}</Dialog.Title>
                    {children}
                </Pressable>
            </Dialog>
        </Portal>
    );
};

const styles = StyleSheet.create({
    dialog: {
        borderRadius: 10
    },
    title: {
        textAlign: "center"
    }
})

export default CenteredDialog;
