import { StyleSheet, View } from "react-native";
import { Card, useTheme } from "react-native-paper";

// Flat full-width card that frames a search/filter row passed in as `child`.
const SearchFilterCard = ({ child }) => {
    const theme = useTheme();

    return (
        <Card 
            mode="flat" 
            style={[styles.card, { backgroundColor: theme.colors.background }]}
        >
            <Card.Content style={styles.cardContent}>
                <View style={styles.childContainer}>
                    {child}
                </View>
            </Card.Content>
        </Card>
    );
};

const styles = StyleSheet.create({
    card: {
        alignSelf: "stretch",
        width: "100%",
    },
    cardContent: {
        paddingHorizontal: 0,
        paddingVertical: 0,
    },
    childContainer: {
        flex: 1,
        width: '100%',
        alignSelf: 'stretch',
    }
});

export default SearchFilterCard;
