import { StyleSheet } from "react-native";

export const modalStyles = StyleSheet.create({
    modal: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
    },
    card: {
        width: "100%",
        maxHeight: 400,
    },
    list: {
        maxHeight: 260,
    },
    metricRow: {
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
});