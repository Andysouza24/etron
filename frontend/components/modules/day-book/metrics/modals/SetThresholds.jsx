import { View, ScrollView, StyleSheet } from "react-native";
import { Dialog, Portal, Text, useTheme, IconButton, List, Tooltip } from "react-native-paper";
import { v4 as uuidv4 } from "uuid";
import BasicButton from "../../../../common/buttons/BasicButton";
import TextField from "../../../../common/input/TextField";
import DropDown from "../../../../common/input/DropDown";
import { useState, useEffect, useMemo, useCallback } from "react";
import * as Haptics from "expo-haptics";

// Threshold shape (kept intentionally simple but future-proof):
// {
//   id: string,            // stable identity; used later when an alert
//                          // references this threshold as its monitoring value
//   value: number,
//   variable: string|null, // null = applies to all dependent variables
//   // Reserved for future configuration (colour, line style, opacity, etc.).
//   // Consumers should treat missing fields as "use defaults".
//   color: string|null,
//   lineStyle: string,     // e.g. "dotted"; defaults to "dotted"
//   opacity: number,       // 0-1; defaults to 0.5
// }

const DEFAULT_LINE_STYLE = "dotted";
const DEFAULT_OPACITY = 0.5;

function formatRangeValue(n) {
    if (n == null || !Number.isFinite(n)) return "\u2014";
    const abs = Math.abs(n);
    if (Number.isInteger(n) && abs < 1e6) return String(n);
    return Number(n.toFixed(2)).toString();
}

const styles = StyleSheet.create({
    emptyText: {
        marginBottom: 8,
    },
    scrollArea: {
        paddingHorizontal: 0,
    },
    scrollContent: {
        paddingHorizontal: 24,
        paddingVertical: 8,
    },
    thresholdRow: {
        paddingVertical: 4,
    },
    thresholdActions: {
        flexDirection: "row",
        alignItems: "center",
    },
    formHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 8,
        paddingTop: 8,
        paddingBottom: 4,
    },
    fieldSpacingTop: {
        marginTop: 8,
    },
    helperNote: {
        marginTop: 4,
        marginBottom: 8,
        fontStyle: "italic",
    },
    dataRange: {
        marginBottom: 8,
    },
});

export default function SetThresholds({
    visible,
    onDismiss,
    thresholds,
    setThresholds,
    dependentVariables = [],
    graphData = [],
    yKeys = [],
    rawGraphData = [],
}) {
    const theme = useTheme();
    const [view, setView] = useState("list");
    const [editingIndex, setEditingIndex] = useState(null);

    const [value, setValue] = useState("");
    const [variable, setVariable] = useState("");

    const [deleteConfirmIndex, setDeleteConfirmIndex] = useState(null);

    const hasMultipleVariables = dependentVariables.length > 1;

    const variableItems = useMemo(
        () => [
            { label: "All variables", value: "" },
            ...dependentVariables.map((v) => ({ label: v, value: v })),
        ],
        [dependentVariables]
    );

    // Compute data range across the keys this threshold targets. If a
    // variable is selected, restrict to that key; otherwise span all yKeys.
    const dataRange = useMemo(() => {
        if (!Array.isArray(graphData) || graphData.length === 0) return null;
        const keys = (variable ? [variable] : yKeys).filter(Boolean);
        if (keys.length === 0) return null;
        let min = Infinity;
        let max = -Infinity;
        for (const row of graphData) {
            for (const key of keys) {
                const v = row?.[key];
                const n = typeof v === "number" ? v : Number(v);
                if (Number.isFinite(n)) {
                    if (n < min) min = n;
                    if (n > max) max = n;
                }
            }
        }
        if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
        return { min, max };
    }, [graphData, yKeys, variable]);

    // Range of the underlying raw dataset (pre-aggregation). Uses
    // `dependentVariables` because raw rows are keyed by the original value
    // field names, which may differ from the pivoted chart `yKeys`.
    const fullRange = useMemo(() => {
        if (!Array.isArray(rawGraphData) || rawGraphData.length === 0) return null;
        const keys = (variable ? [variable] : dependentVariables).filter(Boolean);
        if (keys.length === 0) return null;
        let min = Infinity;
        let max = -Infinity;
        for (const row of rawGraphData) {
            for (const key of keys) {
                const v = row?.[key];
                const n = typeof v === "number" ? v : Number(v);
                if (Number.isFinite(n)) {
                    if (n < min) min = n;
                    if (n > max) max = n;
                }
            }
        }
        if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
        return { min, max };
    }, [rawGraphData, dependentVariables, variable]);

    const isFormValid = useMemo(() => {
        const numVal = Number(value);
        if (value === "" || isNaN(numVal)) return false;
        return true;
    }, [value]);

    useEffect(() => {
        if (visible) setView("list");
    }, [visible]);

    const clearForm = useCallback(() => {
        setValue("");
        setVariable("");
    }, []);

    const handleAdd = () => {
        clearForm();
        setEditingIndex(null);
        setView("form");
    };

    const handleEdit = (index) => {
        const threshold = thresholds[index];
        setValue(threshold.value != null ? String(threshold.value) : "");
        setVariable(threshold.variable ?? "");
        setEditingIndex(index);
        setView("form");
    };

    const handleDelete = (index) => {
        setDeleteConfirmIndex(index);
    };

    const confirmDelete = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setThresholds((prev) => prev.filter((_, i) => i !== deleteConfirmIndex));
        setDeleteConfirmIndex(null);
    };

    const cancelDelete = () => {
        setDeleteConfirmIndex(null);
    };

    const handleSave = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const existing = editingIndex != null ? thresholds[editingIndex] : null;
        const threshold = {
            id: existing?.id ?? uuidv4(),
            value: Number(value),
            variable: hasMultipleVariables ? (variable || null) : null,
            color: existing?.color ?? null,
            lineStyle: existing?.lineStyle ?? DEFAULT_LINE_STYLE,
            opacity: existing?.opacity ?? DEFAULT_OPACITY,
        };

        if (editingIndex != null) {
            setThresholds((prev) => prev.map((t, i) => (i === editingIndex ? threshold : t)));
        } else {
            setThresholds((prev) => [...prev, threshold]);
        }
        clearForm();
        setView("list");
    };

    const handleCancel = () => {
        clearForm();
        setView("list");
    };

    const renderList = () => [
        <Dialog.Title key="title">Set Thresholds</Dialog.Title>,
        thresholds.length === 0 ? (
            <Dialog.Content key="body">
                <Text style={[theme.fonts.bodyMedium, styles.emptyText, { color: theme.colors.themeGrey }]}>
                    No thresholds yet. Tap &quot;Add Threshold&quot; to create one.
                </Text>
            </Dialog.Content>
        ) : (
            <Dialog.ScrollArea key="body" style={styles.scrollArea}>
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    {thresholds.map((threshold, index) => (
                        <List.Item
                            key={threshold.id ?? index}
                            title={String(threshold.value)}
                            titleStyle={theme.fonts.titleSmall}
                            description={threshold.variable ? threshold.variable : "All variables"}
                            descriptionStyle={theme.fonts.bodySmall}
                            style={styles.thresholdRow}
                            right={() => (
                                <View style={styles.thresholdActions}>
                                    <IconButton
                                        icon="pencil-outline"
                                        onPress={() => handleEdit(index)}
                                        size={20}
                                        accessibilityLabel="Edit threshold"
                                    />
                                    <IconButton
                                        icon="close"
                                        onPress={() => handleDelete(index)}
                                        size={20}
                                        iconColor={theme.colors.error}
                                        accessibilityLabel="Delete threshold"
                                    />
                                </View>
                            )}
                        />
                    ))}
                </ScrollView>
            </Dialog.ScrollArea>
        ),
        <Dialog.Actions key="actions">
            <BasicButton label="Close" onPress={onDismiss} mode="outlined" />
            <BasicButton label="Add Threshold" onPress={handleAdd} />
        </Dialog.Actions>,
    ];

    const renderForm = () => [
        <View key="header" style={styles.formHeader}>
            <IconButton
                icon="close"
                onPress={handleCancel}
                size={24}
                accessibilityLabel="Cancel and go back"
            />
            <Text style={[theme.fonts.titleMedium, { color: theme.colors.text }]}>
                {editingIndex != null ? "Edit Threshold" : "New Threshold"}
            </Text>
            <Tooltip title="Fill in all required fields to save">
                <View>
                    <IconButton
                        icon="check"
                        onPress={handleSave}
                        size={24}
                        disabled={!isFormValid}
                        accessibilityLabel="Save threshold"
                    />
                </View>
            </Tooltip>
        </View>,
        <Dialog.ScrollArea key="body" style={styles.scrollArea}>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
            >
                {fullRange && (
                    <Text style={[theme.fonts.bodySmall, styles.dataRange, { color: theme.colors.themeGrey }]}>
                        {`Full data range: ${formatRangeValue(fullRange.max)} \u2013 ${formatRangeValue(fullRange.min)}`}
                    </Text>
                )}
                {dataRange && (
                    <Text style={[theme.fonts.bodySmall, styles.dataRange, { color: theme.colors.themeGrey }]}>
                        {`Displayed data range: ${formatRangeValue(dataRange.max)} \u2013 ${formatRangeValue(dataRange.min)}`}
                    </Text>
                )}
                <TextField
                    label="Value"
                    placeholder="e.g. 100"
                    onChangeText={setValue}
                    value={String(value)}
                    noStyle={true}
                />
                {hasMultipleVariables && (
                    <View style={styles.fieldSpacingTop}>
                        <DropDown
                            title="Applies to"
                            items={variableItems}
                            showRouterButton={false}
                            onSelect={setVariable}
                            value={variable}
                            maxVisibleItems={3}
                            noStyle
                        />
                    </View>
                )}
                <Text style={[theme.fonts.bodySmall, styles.helperNote, { color: theme.colors.themeGrey }]}>
                    Displays as a dotted line on the graph behind the plotted data.
                </Text>
            </ScrollView>
        </Dialog.ScrollArea>,
    ];

    return (
        <>
            <Portal>
                <Dialog
                    visible={visible}
                    onDismiss={onDismiss}
                    style={{ backgroundColor: theme.colors.surface }}
                >
                    {view === "form" ? renderForm() : renderList()}
                </Dialog>
            </Portal>
            <Portal>
                <Dialog visible={deleteConfirmIndex !== null} onDismiss={cancelDelete}>
                    <Dialog.Title>Delete threshold</Dialog.Title>
                    <Dialog.Content>
                        <Text style={theme.fonts.bodyMedium}>
                            Are you sure you want to delete this threshold? This cannot be undone.
                        </Text>
                    </Dialog.Content>
                    <Dialog.Actions>
                        <BasicButton label="Cancel" onPress={cancelDelete} mode="text" />
                        <BasicButton label="Delete" onPress={confirmDelete} danger />
                    </Dialog.Actions>
                </Dialog>
            </Portal>
        </>
    );
}
