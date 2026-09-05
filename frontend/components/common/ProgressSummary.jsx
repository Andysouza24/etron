// Author(s): Holly Wyatt
// reusable progress summary that shows a linear progress bar with a label

import { useEffect, useState } from "react";
import { View, StyleSheet } from "react-native";
import { IconButton, ProgressBar, Text, useTheme } from "react-native-paper";

const ProgressSummary = ({
    label = "Processing",
    completedLabel = "Done",
    processed,
    total,
    completedHoldMs = 4000,
    dismissible = true,
    style,
}) => {
    const theme = useTheme();
    const isComplete = total > 0 && processed >= total;
    const fraction = total > 0 ? Math.max(0, Math.min(1, processed / total)) : 0;

    const [dismissed, setDismissed] = useState(false);
    const [autoHidden, setAutoHidden] = useState(false);

    // Reset visibility whenever the work re-starts (processed drops back below total).
    useEffect(() => {
        if (!isComplete) {
            setDismissed(false);
            setAutoHidden(false);
        }
    }, [isComplete]);

    // Auto-hide after the work completes.
    useEffect(() => {
        if (!isComplete || autoHidden || dismissed) return undefined;
        const timeout = setTimeout(() => setAutoHidden(true), completedHoldMs);
        return () => clearTimeout(timeout);
    }, [isComplete, autoHidden, dismissed, completedHoldMs]);

    if (total <= 0) return null;
    if (dismissed || autoHidden) return null;

    const headerLabel = isComplete ? completedLabel : label;

    return (
        <View style={[styles.container, style]}>
            <View style={styles.row}>
                <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                    {headerLabel}
                </Text>
                <View style={styles.rightGroup}>
                    <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                        {processed}/{total}
                    </Text>
                    {dismissible && (
                        <IconButton
                            icon="close"
                            size={16}
                            onPress={() => setDismissed(true)}
                            accessibilityLabel="Dismiss progress"
                            style={styles.closeButton}
                        />
                    )}
                </View>
            </View>
            <ProgressBar
                progress={fraction}
                accessibilityLabel={`${processed} of ${total} ${label.toLowerCase()}`}
            />
        </View>
    );
};

export default ProgressSummary;

const styles = StyleSheet.create({
    container: {
        marginBottom: 12,
    },
    row: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 4,
    },
    rightGroup: {
        flexDirection: "row",
        alignItems: "center",
    },
    closeButton: {
        margin: 0,
        marginLeft: 4,
    },
});
