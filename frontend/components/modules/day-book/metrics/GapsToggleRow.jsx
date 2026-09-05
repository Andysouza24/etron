// Press-and-hold button that suppresses line/area interpolation so the
// user can see raw points and the gaps between them. Used by the
// display view in MetricGraph.

import { StyleSheet, View } from "react-native";
import { IconButton } from "react-native-paper";

const GapsToggleRow = ({ active, onPressIn, onPressOut }) => (
    <View style={styles.row}>
        <IconButton
            icon="dots-horizontal"
            size={18}
            mode={active ? "contained" : "contained-tonal"}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            accessibilityLabel="Hold to show data gaps"
            style={styles.button}
        />
    </View>
);

const styles = StyleSheet.create({
    row: {
        flexDirection: "row",
        justifyContent: "center",
        marginTop: 4,
    },
    button: {
        margin: 0,
    },
});

export default GapsToggleRow;
