import React from "react";
import { View, StyleSheet } from "react-native";
import { Text, useTheme } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import ResponsiveScreen from "../../../../components/layout/ResponsiveScreen";
import Header from "../../../../components/layout/Header";

export default function CreateNotificationScreen() {
    const theme = useTheme();
    return (
        <ResponsiveScreen header={<Header title="Create Notification" showBack />} center>
            <View style={styles.container}>
                <MaterialCommunityIcons name="bell-outline" size={48} color={theme.colors.onSurfaceVariant} />
                <Text style={{ color: theme.colors.onSurfaceVariant, marginTop: 12 }}>TODO:</Text>
            </View>
        </ResponsiveScreen>
    );
}

const styles = StyleSheet.create({
    container: { alignItems: "center", justifyContent: "center" },
});
