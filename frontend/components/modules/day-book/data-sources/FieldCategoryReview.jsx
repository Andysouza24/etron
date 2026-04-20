// Author(s): Holly Wyatt
// Component for reviewing and adjusting field categories (date/value/dimension)
// during data source connection. Each field can be changed between categories.
// Date fields get a format picker; Value fields get a data type selector.

import { useState, useMemo, useCallback } from "react";
import { View, StyleSheet, Pressable, ScrollView } from "react-native";
import { Text, Chip, Divider, useTheme, Menu, TextInput } from "react-native-paper";
import COMMON_DATE_FORMATS from "../../../../utils/constants/modules/day-book/data-sources/dateFormats";
import VALUE_TYPES from "../../../../utils/constants/modules/day-book/data-sources/valueTypes";

const CATEGORIES = [
    { key: "date",      label: "Date/Time", icon: "calendar" },
    { key: "value",     label: "Value",     icon: "numeric" },
    { key: "dimension", label: "Dimension", icon: "tag-outline" },
];

/**
FieldCategoryReview - Lets the user review auto-detected field categories
and change any field between Date/Time, Value, and Dimension.
- Date fields: format picker (auto-detect, preset, or custom).
- Value fields: data-type selector (Integer, Decimal, Currency).
 */
const FieldCategoryReview = ({ schema, onChange, sampleData = [] }) => {
    const theme = useTheme();

    // Per-field working state — { category, type, parseMode?, userDateFormat?, suggestedValueType? }
    const [fields, setFields] = useState(() => {
        const map = {};
        for (const f of schema) {
            if (f.name === "timestamp" || f.name === "rowId") continue;
            map[f.name] = {
                category: f.category || inferCategory(f.type),
                type: f.type,
                userDateFormat: f.userDateFormat || null,
                parseMode: f.parseMode || "auto",
                suggestedValueType: f.suggestedValueType || null,
            };
        }
        return map;
    });

    // Menu visibility state
    const [formatMenuVisible, setFormatMenuVisible] = useState({});
    const [showCustomFormat, setShowCustomFormat] = useState({});
    const [customFormatText, setCustomFormatText] = useState({});
    const [typeMenuVisible, setTypeMenuVisible] = useState({});

    const nonSystemFields = useMemo(
        () => schema.filter(f => f.name !== "timestamp" && f.name !== "rowId"),
        [schema]
    );

    const getSampleValue = (fieldName) => {
        if (!sampleData || sampleData.length === 0) return "";
        const row = sampleData.find(r => r[fieldName] != null && String(r[fieldName]).trim() !== "");
        return row ? String(row[fieldName]) : "";
    };

    // Build the confirmed schema and notify parent
    const emitChange = useCallback((updatedFields) => {
        const updatedSchema = schema.map(f => {
            if (f.name === "timestamp" || f.name === "rowId") return f;
            const state = updatedFields[f.name];
            if (!state) return f;

            const col = { ...f, category: state.category };

            if (state.category === "date") {
                if (state.parseMode === "manual" && state.userDateFormat) {
                    col.userDateFormat = state.userDateFormat;
                    col.parseMode = "manual";
                } else {
                    col.parseMode = "auto";
                    delete col.userDateFormat;
                }
            } else if (state.category === "value") {
                col.type = state.type || state.suggestedValueType || "double";
                delete col.userDateFormat;
                delete col.parseMode;
            } else {
                // dimension
                col.type = "string";
                delete col.userDateFormat;
                delete col.parseMode;
            }

            return col;
        });
        onChange(updatedSchema);
    }, [schema, onChange]);

    // ---- Category change ----
    const changeCategory = (fieldName, newCategory) => {
        setFields(prev => {
            const current = prev[fieldName];
            let updated;

            if (newCategory === "value") {
                const suggestedType = current.suggestedValueType ||
                    (current.type && current.type !== "string" && current.type !== "timestamp"
                        ? current.type : "double");
                updated = { ...prev, [fieldName]: { ...current, category: "value", type: suggestedType } };
            } else if (newCategory === "date") {
                updated = { ...prev, [fieldName]: { ...current, category: "date", parseMode: "auto", userDateFormat: null } };
            } else {
                updated = { ...prev, [fieldName]: { ...current, category: "dimension", type: "string" } };
            }

            emitChange(updated);
            return updated;
        });
    };

    // ---- Value type change ----
    const changeValueType = (fieldName, newType) => {
        setFields(prev => {
            const updated = { ...prev, [fieldName]: { ...prev[fieldName], type: newType } };
            setTypeMenuVisible(v => ({ ...v, [fieldName]: false }));
            emitChange(updated);
            return updated;
        });
    };

    // ---- Date format selection ----
    const selectDateFormat = (fieldName, formatValue) => {
        if (formatValue === "__custom__") {
            setShowCustomFormat(prev => ({ ...prev, [fieldName]: true }));
            setFormatMenuVisible(prev => ({ ...prev, [fieldName]: false }));
            return;
        }

        const isAuto = formatValue === "__auto__";
        setFields(prev => {
            const updated = {
                ...prev,
                [fieldName]: {
                    ...prev[fieldName],
                    parseMode: isAuto ? "auto" : "manual",
                    userDateFormat: isAuto ? null : formatValue,
                },
            };
            setShowCustomFormat(p => ({ ...p, [fieldName]: false }));
            setFormatMenuVisible(p => ({ ...p, [fieldName]: false }));
            emitChange(updated);
            return updated;
        });
    };

    const applyCustomFormat = (fieldName) => {
        const fmt = (customFormatText[fieldName] || "").trim();
        if (!fmt) return;
        setFields(prev => {
            const updated = {
                ...prev,
                [fieldName]: { ...prev[fieldName], parseMode: "manual", userDateFormat: fmt },
            };
            setShowCustomFormat(p => ({ ...p, [fieldName]: false }));
            emitChange(updated);
            return updated;
        });
    };

    // ---- Label helpers ----
    const getFormatLabel = (fieldName) => {
        const f = fields[fieldName];
        if (!f || f.parseMode === "auto") return "Auto-detect";
        return f.userDateFormat || "Auto-detect";
    };

    const getTypeLabel = (fieldName) => {
        const f = fields[fieldName];
        if (!f) return "Decimal";
        const found = VALUE_TYPES.find(t => t.value === f.type);
        return found ? found.label : "Decimal";
    };

    return (
        <View style={styles.container}>
            <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                Review Field Categories
            </Text>
            <Text variant="bodySmall" style={[styles.description, { color: theme.colors.onSurfaceVariant }]}>
                Review how each field is categorised. Change any field between Date/Time, Value,
                and Dimension. For date fields, choose the format. For value fields, choose the data type.
            </Text>

            {nonSystemFields.map((field, index) => {
                const fieldState = fields[field.name];
                if (!fieldState) return null;
                const sample = getSampleValue(field.name);

                return (
                    <View key={field.name}>
                        {index > 0 && <Divider style={styles.fieldDivider} />}

                        {/* Field name & sample */}
                        <View style={styles.fieldHeader}>
                            <Text variant="bodyMedium" style={[styles.fieldName, { color: theme.colors.onSurface }]}>
                                {field.name}
                            </Text>
                            {sample ? (
                                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }} numberOfLines={1}>
                                    e.g. {sample}
                                </Text>
                            ) : null}
                        </View>

                        {/* Category chips */}
                        <View style={styles.categoryRow}>
                            {CATEGORIES.map(cat => (
                                <Chip
                                    key={cat.key}
                                    selected={fieldState.category === cat.key}
                                    showSelectedOverlay
                                    onPress={() => changeCategory(field.name, cat.key)}
                                    icon={cat.icon}
                                    compact
                                    mode={fieldState.category === cat.key ? "flat" : "outlined"}
                                    style={[
                                        styles.categoryChip,
                                        fieldState.category === cat.key && { backgroundColor: theme.colors.primaryContainer },
                                    ]}
                                    accessibilityLabel={`Set ${field.name} category to ${cat.label}`}
                                >
                                    {cat.label}
                                </Chip>
                            ))}
                        </View>

                        {/* Date format picker */}
                        {fieldState.category === "date" && (
                            <View style={styles.optionsContainer}>
                                <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 4 }}>
                                    Date format:
                                </Text>
                                <Menu
                                    visible={!!formatMenuVisible[field.name]}
                                    onDismiss={() => setFormatMenuVisible(p => ({ ...p, [field.name]: false }))}
                                    contentStyle={{ maxHeight: 350 }}
                                    anchor={
                                        <Pressable
                                            onPress={() => setFormatMenuVisible(p => ({ ...p, [field.name]: true }))}
                                            style={[styles.pickerButton, { borderColor: theme.colors.outline }]}
                                        >
                                            <Text variant="bodySmall" style={{ color: theme.colors.onSurface, flex: 1 }}>
                                                {getFormatLabel(field.name)}
                                            </Text>
                                            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>▼</Text>
                                        </Pressable>
                                    }
                                >
                                    <ScrollView style={{ maxHeight: 340 }} keyboardShouldPersistTaps="always" nestedScrollEnabled>
                                        <Menu.Item title="Auto-detect" leadingIcon="auto-fix" onPress={() => selectDateFormat(field.name, "__auto__")} />
                                        <Divider />
                                        {COMMON_DATE_FORMATS.map(fmt => (
                                            <Menu.Item key={fmt.value} title={fmt.label} onPress={() => selectDateFormat(field.name, fmt.value)} />
                                        ))}
                                        <Divider />
                                        <Menu.Item title="Custom..." leadingIcon="pencil-outline" onPress={() => selectDateFormat(field.name, "__custom__")} />
                                    </ScrollView>
                                </Menu>

                                {showCustomFormat[field.name] && (
                                    <View style={styles.customRow}>
                                        <TextInput
                                            mode="outlined"
                                            dense
                                            placeholder="e.g. DD/MM/YYYY HH:mm"
                                            value={customFormatText[field.name] || ""}
                                            onChangeText={text => setCustomFormatText(p => ({ ...p, [field.name]: text }))}
                                            onSubmitEditing={() => applyCustomFormat(field.name)}
                                            style={styles.customInput}
                                        />
                                        <Pressable
                                            onPress={() => applyCustomFormat(field.name)}
                                            style={[styles.applyButton, { backgroundColor: theme.colors.primary }]}
                                        >
                                            <Text variant="labelSmall" style={{ color: theme.colors.onPrimary }}>Apply</Text>
                                        </Pressable>
                                    </View>
                                )}

                                {sample ? (
                                    <Text variant="bodySmall" style={[styles.previewText, { color: theme.colors.onSurfaceVariant }]}>
                                        Sample: &quot;{sample}&quot;
                                    </Text>
                                ) : null}
                            </View>
                        )}

                        {/* Value type picker */}
                        {fieldState.category === "value" && (
                            <View style={styles.optionsContainer}>
                                <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 4 }}>
                                    Data type:
                                </Text>
                                <Menu
                                    visible={!!typeMenuVisible[field.name]}
                                    onDismiss={() => setTypeMenuVisible(p => ({ ...p, [field.name]: false }))}
                                    anchor={
                                        <Pressable
                                            onPress={() => setTypeMenuVisible(p => ({ ...p, [field.name]: true }))}
                                            style={[styles.pickerButton, { borderColor: theme.colors.outline }]}
                                        >
                                            <Text variant="bodySmall" style={{ color: theme.colors.onSurface, flex: 1 }}>
                                                {getTypeLabel(field.name)}
                                            </Text>
                                            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>▼</Text>
                                        </Pressable>
                                    }
                                >
                                    {VALUE_TYPES.map(t => (
                                        <Menu.Item key={t.value} title={t.label} onPress={() => changeValueType(field.name, t.value)} />
                                    ))}
                                </Menu>
                            </View>
                        )}
                    </View>
                );
            })}
        </View>
    );
};

function inferCategory(type) {
    const DATE_TYPES = ["timestamp", "date", "datetime", "time"];
    const STRING_TYPES = ["string", "varchar", "char", "text"];
    const t = (type ?? "").toLowerCase();
    if (DATE_TYPES.some(dt => t.includes(dt))) return "date";
    if (STRING_TYPES.some(st => t.includes(st))) return "dimension";
    return "value";
}

const styles = StyleSheet.create({
    container: {
        marginTop: 16,
        marginBottom: 8,
    },
    sectionTitle: {
        marginBottom: 4,
        fontWeight: "600",
    },
    description: {
        marginBottom: 16,
        lineHeight: 18,
    },
    fieldHeader: {
        paddingHorizontal: 4,
        marginBottom: 6,
    },
    fieldName: {
        fontWeight: "500",
        marginBottom: 2,
    },
    fieldDivider: {
        marginVertical: 12,
    },
    categoryRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 6,
        paddingHorizontal: 4,
        marginBottom: 6,
    },
    categoryChip: {
        marginRight: 0,
    },
    optionsContainer: {
        marginLeft: 4,
        marginTop: 4,
        marginBottom: 4,
        marginRight: 8,
    },
    pickerButton: {
        flexDirection: "row",
        alignItems: "center",
        borderWidth: 1,
        borderRadius: 6,
        paddingHorizontal: 10,
        paddingVertical: 8,
    },
    customRow: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 6,
        gap: 8,
    },
    customInput: {
        flex: 1,
        fontSize: 13,
        height: 36,
    },
    applyButton: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 6,
    },
    previewText: {
        marginTop: 4,
        fontStyle: "italic",
        fontSize: 11,
    },
});

export default FieldCategoryReview;
