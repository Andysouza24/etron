import React from "react";
import { StyleSheet, View } from "react-native";
import {
    Button,
    Dialog,
    Portal,
    Text,
    useTheme,
} from "react-native-paper";
import DropDown from "../../../../common/input/DropDown";

const AddMetricToBoardDialog = ({
    visible,
    onDismiss,
    onConfirm,
    boards = [],
    loading = false,
    submitting = false,
    metricName,
}) => {
    const theme = useTheme();
    const [selectedBoardId, setSelectedBoardId] = React.useState(null);

    React.useEffect(() => {
        if (!visible) setSelectedBoardId(null);
    }, [visible]);

    const dropdownItems = React.useMemo(
        () => boards.map((board) => ({
            value: board.id,
            label: board.name || board.title || board.config?.title || "Untitled board",
        })),
        [boards],
    );

    const handleConfirm = () => {
        if (!selectedBoardId) return;
        onConfirm?.(selectedBoardId);
    };

    const renderBody = () => {
        if (loading) {
            return (
                <Text
                    variant="bodyMedium"
                    style={{ color: theme.colors.onSurfaceVariant }}
                >
                    Loading boards…
                </Text>
            );
        }
        if (boards.length === 0) {
            return (
                <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                    No boards available. Create a board first.
                </Text>
            );
        }
        return (
            <View style={styles.dropdownWrapper}>
                <DropDown
                    title="Select a board"
                    items={dropdownItems}
                    value={selectedBoardId}
                    onSelect={(value) => setSelectedBoardId(value)}
                    showRouterButton={false}
                />
            </View>
        );
    };

    return (
        <Portal>
            <Dialog visible={visible} onDismiss={onDismiss}>
                <Dialog.Title>Add metric to board</Dialog.Title>
                <Dialog.Content style={styles.content}>
                    {metricName ? (
                        <Text
                            variant="bodyMedium"
                            style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}
                        >
                            Select a board to add &ldquo;{metricName}&rdquo; to.
                        </Text>
                    ) : null}
                    {renderBody()}
                </Dialog.Content>
                <Dialog.Actions>
                    <Button onPress={onDismiss} disabled={submitting}>
                        Cancel
                    </Button>
                    <Button
                        onPress={handleConfirm}
                        disabled={!selectedBoardId || submitting || loading}
                        loading={submitting}
                    >
                        Add
                    </Button>
                </Dialog.Actions>
            </Dialog>
        </Portal>
    );
};

const styles = StyleSheet.create({
    content: {
        paddingBottom: 8,
    },
    subtitle: {
        marginBottom: 12,
    },
    dropdownWrapper: {
        marginBottom: 4,
    },
});

export default AddMetricToBoardDialog;
