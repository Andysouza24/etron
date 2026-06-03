// Author(s): Holly Wyatt
// Component for reviewing and adjusting field categories (date/value/dimension)
// during data source connection. Each field can be changed between categories.
// Date fields get a format picker; Value fields get a data type selector.

import { useState, useMemo, useCallback } from "react";
import { View, StyleSheet, Pressable, ScrollView } from "react-native";
import { Text, Chip, Divider, useTheme, Menu, TextInput, Switch } from "react-native-paper";
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

    // Decide the default value-column type.
    const resolveValueType = (currencySymbol, existingType, suggestedValueType) => {
        if (currencySymbol) return "decimal(18,2)";
        if (suggestedValueType) return suggestedValueType;
        if (existingType && existingType !== "string" && existingType !== "timestamp") {
            return existingType;
        }
        return "double";
    };

    // Per-field working state — { category, type, parseMode?, userDateFormat?, suggestedValueType?, currencySymbol?, displayCurrencySymbol? }
    const [fields, setFields] = useState(() => {
        const map = {};
        for (const f of schema) {
            if (f.name === "timestamp" || f.name === "rowId") continue;
            const initialCategory = f.category || inferCategory(f.type);
            const initialType = initialCategory === "value"
                ? resolveValueType(f.currencySymbol, f.type, f.suggestedValueType)
                : f.type;
            map[f.name] = {
                category: initialCategory,
                type: initialType,
                userDateFormat: f.userDateFormat || null,
                parseMode: f.parseMode || "auto",
                suggestedValueType: f.suggestedValueType || null,
                currencySymbol: f.currencySymbol || null,
                displayCurrencySymbol: f.displayCurrencySymbol !== false,
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

    // group contiguous fields sharing the same `group` hint (set by the dashboard sanitiser for flattened nested objects)
    // ungrouped fields render as their own single-field section so the existing flat layout is unchanged when no hints are present
    const fieldGroups = useMemo(() => {
        const seen = new Map();
        const ordered = [];
        for (const f of nonSystemFields) {
            const key = f.group || null;
            if (!key) {
                ordered.push({ key: null, label: null, fields: [f] });
                continue;
            }
            const existing = seen.get(key);
            if (existing) {
                existing.fields.push(f);
            } else {
                const entry = { key, label: humaniseGroupLabel(key), fields: [f] };
                seen.set(key, entry);
                ordered.push(entry);
            }
        }
        return ordered;
    }, [nonSystemFields]);

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
                if (state.currencySymbol) {
                    col.currencySymbol = state.currencySymbol;
                    col.displayCurrencySymbol = state.displayCurrencySymbol !== false;
                } else {
                    delete col.currencySymbol;
                    delete col.displayCurrencySymbol;
                }
                delete col.userDateFormat;
                delete col.parseMode;
            } else {
                // dimension
                col.type = "string";
                delete col.currencySymbol;
                delete col.displayCurrencySymbol;
                delete col.userDateFormat;
                delete col.parseMode;
            }

            return col;
        });
        onChange(updatedSchema);
    }, [schema, onChange]);

    // ---- Category change ----
    const changeCategory = (fieldName, newCategory) => {
        const current = fields[fieldName];
        let updated;

        if (newCategory === "value") {
            const suggestedType = resolveValueType(
                current.currencySymbol,
                current.type,
                current.suggestedValueType
            );
            updated = { ...fields, [fieldName]: { ...current, category: "value", type: suggestedType } };
        } else if (newCategory === "date") {
            updated = { ...fields, [fieldName]: { ...current, category: "date", parseMode: "auto", userDateFormat: null } };
        } else {
            updated = { ...fields, [fieldName]: { ...current, category: "dimension", type: "string" } };
        }

        setFields(updated);
        emitChange(updated);
    };

    // ---- Value type change ----
    const changeValueType = (fieldName, newType) => {
        const updated = { ...fields, [fieldName]: { ...fields[fieldName], type: newType } };
        setFields(updated);
        setTypeMenuVisible(v => ({ ...v, [fieldName]: false }));
        emitChange(updated);
    };

    // ---- Currency-symbol display toggle ----
    const toggleDisplayCurrencySymbol = (fieldName) => {
        const current = fields[fieldName];
        if (!current) return;
        const updated = {
            ...fields,
            [fieldName]: { ...current, displayCurrencySymbol: !current.displayCurrencySymbol },
        };
        setFields(updated);
        emitChange(updated);
    };

    // ---- Date format selection ----
    const selectDateFormat = (fieldName, formatValue) => {
        if (formatValue === "__custom__") {
            setShowCustomFormat(prev => ({ ...prev, [fieldName]: true }));
            setFormatMenuVisible(prev => ({ ...prev, [fieldName]: false }));
            return;
        }

        const isAuto = formatValue === "__auto__";
        const updated = {
            ...fields,
            [fieldName]: {
                ...fields[fieldName],
                parseMode: isAuto ? "auto" : "manual",
                userDateFormat: isAuto ? null : formatValue,
            },
        };
        setFields(updated);
        setShowCustomFormat(p => ({ ...p, [fieldName]: false }));
        setFormatMenuVisible(p => ({ ...p, [fieldName]: false }));
        emitChange(updated);
    };

    const applyCustomFormat = (fieldName) => {
        const fmt = (customFormatText[fieldName] || "").trim();
        if (!fmt) return;
        const updated = {
            ...fields,
            [fieldName]: { ...fields[fieldName], parseMode: "manual", userDateFormat: fmt },
        };
        setFields(updated);
        setShowCustomFormat(p => ({ ...p, [fieldName]: false }));
        emitChange(updated);
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

    const renderField = (field, showDivider) => {
        const fieldState = fields[field.name];
        if (!fieldState) return null;
        const rawSample = getSampleValue(field.name);
        const showSymbol =
            fieldState.category === "value" &&
            fieldState.currencySymbol &&
            fieldState.displayCurrencySymbol;
        const sample = rawSample && showSymbol && !rawSample.includes(fieldState.currencySymbol)
            ? `${fieldState.currencySymbol}${rawSample}`
            : rawSample;
        // strip the `group_` prefix from the display name when the field belongs to a group; the header already conveys the group
        const displayName = field.group && field.name.startsWith(`${field.group}_`)
            ? field.name.slice(field.group.length + 1)
            : field.name;

        return (
            <View key={field.name}>
                {showDivider && <Divider style={styles.fieldDivider} />}

                {/* Field name & sample */}
                <View style={styles.fieldHeader}>
                    <Text variant="bodyMedium" style={[styles.fieldName, { color: theme.colors.onSurface }]}>
                        {displayName}
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

                        {fieldState.currencySymbol ? (
                            <View style={styles.currencyToggleRow}>
                                <Text
                                    variant="bodySmall"
                                    style={{ color: theme.colors.onSurface, flex: 1 }}
                                    numberOfLines={2}
                                >
                                    Show {fieldState.currencySymbol} in preview
                                </Text>
                                <Switch
                                    value={!!fieldState.displayCurrencySymbol}
                                    onValueChange={() => toggleDisplayCurrencySymbol(field.name)}
                                    accessibilityLabel={`Toggle currency symbol display for ${field.name}`}
                                />
                            </View>
                        ) : null}
                    </View>
                )}
            </View>
        );
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

            {fieldGroups.map((group, groupIndex) => (
                <View key={group.key || `__ungrouped_${groupIndex}`}>
                    {group.key ? (
                        <Text
                            variant="titleSmall"
                            style={[styles.groupHeader, { color: theme.colors.onSurfaceVariant }]}
                        >
                            {group.label}
                        </Text>
                    ) : null}
                    {group.fields.map((field, fieldIndex) => {
                        // first field overall has no divider; first field inside a labelled group has no divider (header acts as separator)
                        const isFirstOverall = groupIndex === 0 && fieldIndex === 0;
                        const isFirstInGroup = !!group.key && fieldIndex === 0;
                        return renderField(field, !isFirstOverall && !isFirstInGroup);
                    })}
                </View>
            ))}
        </View>
    );
};

// humanise an envelope/object key into a section header label e.g. "overdue" -> "Overdue", "accountManager" -> "Account Manager"
function humaniseGroupLabel(key) {
    if (!key) return "";
    const withSpaces = key
        .replace(/[_-]+/g, " ")
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2");
    return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
}


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
    groupHeader: {
        fontWeight: "600",
        textTransform: "uppercase",
        letterSpacing: 0.4,
        marginTop: 16,
        marginBottom: 8,
        paddingHorizontal: 4,
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
    currencyToggleRow: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 10,
        gap: 8,
    },
});

export default FieldCategoryReview;
