import { View, StyleSheet } from 'react-native';
import { Button, Text } from 'react-native-paper';

// Full-screen error message with an optional Retry button.
const ErrorRetry = ({ message = "Something went wrong.", onRetry }) => {
    return (
        <View style={styles.container}>
            <Text variant="bodyLarge">{message}</Text>
            {onRetry && (
                <Button
                    mode="outlined"
                    onPress={onRetry}
                    style={styles.button}
                >
                    Retry
                </Button>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: "flex-start",
        alignItems: "center",
        paddingTop: 100,
    },
    button: {
        marginTop: 8,
    },
});

export default ErrorRetry;