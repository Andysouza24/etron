import { View, StyleSheet } from "react-native";
import { Button, useTheme, Text, Icon} from "react-native-paper";
import { router } from "expo-router";

// Empty state shown when a requested item can't be found.
// Offers Back and a link to the item's list route.
export default function ItemNotFound ({
    icon = "alert-circle-outline",
    item = "item",
    itemId,
    listRoute
}) {
    const theme = useTheme();

    const capitalizedItem = String(item).charAt(0).toUpperCase() + String(item).slice(1);

    return (
        <View style={styles.emptyWrap}>
            <View>
                <Icon source={icon} size={48} color={theme.colors.onSurface} />
            </View>
            <Text style={[styles.emptyTitle]}>{item} not found</Text>
            <Text style={[styles.emptyBody]}>
                This {item} {itemId ? `(ID: ${itemId}) ` : ""}may have been removed. Try again or contact an admin.
            </Text>

            <View style={styles.emptyActions}>
                <Button mode="contained" onPress={() => router.back()}>
                    Back
                </Button>
                <Button mode="outlined" onPress={() => router.dismissTo(listRoute)}>
                    {capitalizedItem}s
                </Button>
            </View>
        </View>
    )
}

const styles = StyleSheet.create({
    emptyWrap: {
        alignItems: "center"
    },
    emptyTitle: {
        fontSize: 20,
        marginBottom: 6,
    },
    emptyBody: {
        textAlign: "center",
        marginBottom: 18,
    },
    emptyActions: {
        flexDirection: "row",
        gap: 16,
    },
});