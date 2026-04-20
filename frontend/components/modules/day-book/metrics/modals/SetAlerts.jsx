import { View, ScrollView, StyleSheet } from "react-native";
import { Modal, Portal, Card, Text, useTheme, RadioButton, Chip, Switch, IconButton, Dialog, List, Divider, Tooltip } from "react-native-paper";
import { sharedModalStyles } from "../../../../../assets/styles/stylesheets/day-book/modules/metrics/sharedModalStyles";
import BasicButton from "../../../../common/buttons/BasicButton";
import TextField from "../../../../common/input/TextField";
import DropDown from "../../../../common/input/DropDown";
import { useState, useEffect, useMemo, useCallback } from "react";
import * as Haptics from 'expo-haptics';

const CONDITIONS = [
    { label: "is less than", value: "less_than" },
    { label: "is greater than", value: "greater_than" },
    { label: "decreased by more than", value: "decreased_by" },
    { label: "increased by more than", value: "increased_by" },
    { label: "increased or decreased by more than", value: "changed_by" },
    { label: "% has decreased by more than", value: "percent_decreased_by" },
    { label: "% has increased by more than", value: "percent_increased_by" },
    { label: "% has increased or decreased by more than", value: "percent_changed_by" },
];

const PERCENT_CONDITIONS = new Set([
    "percent_decreased_by", "percent_increased_by", "percent_changed_by",
]);

const ABSOLUTE_CHANGE_CONDITIONS = new Set([
    "decreased_by", "increased_by", "changed_by",
]);

const TIME_PERIODS = [
    { label: "Entire data source", value: "all" },
    { label: "1 day", value: "1d" },
    { label: "1 week", value: "1w" },
    { label: "2 weeks", value: "2w" },
    { label: "1 month", value: "1m" },
    { label: "3 months", value: "3m" },
    { label: "6 months", value: "6m" },
    { label: "1 year", value: "1y" },
];

const BOUNDED_TIME_PERIODS = TIME_PERIODS.filter((t) => t.value !== "all");

const COMPARISON_PERIODS = [
    { label: "Previous period (same length)", value: "previous" },
];

const AGGREGATIONS = [
    { label: "Sum", value: "sum" },
    { label: "Average", value: "average" },
    { label: "Min", value: "min" },
    { label: "Max", value: "max" },
    { label: "Latest", value: "latest" },
];

const COMPARE_AGAINST_OPTIONS = [
    { label: "Previous data point", value: "previous_point", description: "The entry immediately before the evaluated one. If evaluating any row, each row is compared to the most recent entry." },
    { label: "Highest value in time period", value: "highest_in_period", description: "The highest recorded value within the selected time period." },
    { label: "Lowest value in time period", value: "lowest_in_period", description: "The lowest recorded value within the selected time period." },
    { label: "Average value in time period", value: "average_in_period", description: "The average of all values within the selected time period." },
    { label: "Highest value ever recorded", value: "highest_overall", description: "The highest value across the entire data source." },
    { label: "Lowest value ever recorded", value: "lowest_overall", description: "The lowest value across the entire data source." },
    { label: "Average of all data", value: "average_overall", description: "The average of all values across the entire data source." },
];

const EVALUATE_ON_OPTIONS = [
    {
        label: "Newest entry by tracked date",
        value: "latest_tracked",
        description: "Checks the most recent row based on the date field your metric tracks. Only rows with a tracked date inside the selected time period are considered.",
    },
    {
        label: "Newest added or updated row",
        value: "latest_update",
        description: "Checks the most recently added or modified row, regardless of the date your metric tracks. Only rows added or updated within the selected time period are considered.",
    },
    {
        label: "Any row in the data source",
        value: "any_value",
        description: "Checks every row in your data source. You will be alerted if any single row meets the condition, regardless of dates.",
    },
];

const METHODS = [
    { label: "push notification", value: "push" },
];

const VISIBILITY_OPTIONS = [
    { label: "Only me", value: "owner" },
    { label: "Entire workspace", value: "workspace" },
    { label: "Specific people", value: "custom" },
];

const EDITOR_OPTIONS = [
    { label: "Only me", value: "owner" },
    { label: "Specific people", value: "custom" },
];

function getLabel(items, value) {
    return items.find((i) => i.value === value)?.label ?? value;
}

function isPercentCondition(condition) {
    return PERCENT_CONDITIONS.has(condition);
}

function isAbsoluteChangeCondition(condition) {
    return ABSOLUTE_CHANGE_CONDITIONS.has(condition);
}

const styles = StyleSheet.create({
    card: {
        padding: 4,
    },
    sectionHeader: {
        marginTop: 16,
        marginBottom: 8,
    },
    sectionHeaderText: {
        textTransform: "uppercase",
        letterSpacing: 0.8,
    },
    sectionDivider: {
        marginTop: 8,
    },
    radioItem: {
        paddingVertical: 4,
    },
    radioDescription: {
        marginLeft: 48,
        marginBottom: 4,
    },
    alertList: {
        maxHeight: 250,
    },
    alertRow: {
        paddingVertical: 4,
    },
    alertActions: {
        flexDirection: "row",
        alignItems: "center",
    },
    addButton: {
        marginTop: 12,
    },
    closeButton: {
        marginTop: 8,
        alignSelf: "center",
    },
    formHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        width: "100%",
        paddingHorizontal: 4,
        paddingTop: 8,
        paddingBottom: 4,
    },
    formContent: {
        paddingTop: 4,
    },
    formScroll: {
    },
    formScrollContent: {
        paddingTop: 4,
        paddingBottom: 16,
    },
    fieldSpacing: {
        marginBottom: 8,
    },
    fieldSpacingTop: {
        marginTop: 8,
    },
    helperItalic: {
        marginBottom: 4,
        fontStyle: "italic",
    },
    helperNote: {
        marginTop: 4,
    },
    helperSpacing: {
        marginBottom: 8,
    },
    helperSpacingSmall: {
        marginBottom: 4,
    },
    switchRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 8,
    },
    switchLabel: {
        marginLeft: 8,
        flex: 1,
    },
    chipRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        columnGap: 8,
        rowGap: 4,
        marginTop: 4,
    },
    deliveryChip: {
        alignSelf: "flex-start",
        marginBottom: 4,
    },
});

export default function SetAlerts({
    visible,
    onDismiss,
    alerts,
    setAlerts,
    dependentVariables = [],
    userId,
    workspaceId,
    workspaceUsers = [],
    workspaceRoles = [],
    graphTimePeriod,
}) {
    const theme = useTheme();
    const [view, setView] = useState("list");
    const [editingIndex, setEditingIndex] = useState(null);

    // form fields
    const [notificationName, setNotificationName] = useState("");
    const [condition, setCondition] = useState("");
    const [conditionValue, setConditionValue] = useState("");
    const [variable, setVariable] = useState("");
    const [evaluateOn, setEvaluateOn] = useState("latest_tracked");
    const [compareAgainst, setCompareAgainst] = useState("previous_point");
    const [useAggregatedValue, setUseAggregatedValue] = useState(false);
    const [aggregation, setAggregation] = useState("");
    const [useCustomTimePeriod, setUseCustomTimePeriod] = useState(false);
    const [timePeriod, setTimePeriod] = useState("");
    const [comparisonPeriod, setComparisonPeriod] = useState("");
    const [method, setMethod] = useState("");

    // access control
    const [visibility, setVisibility] = useState("owner");
    const [readUsers, setReadUsers] = useState([]);
    const [readRoles, setReadRoles] = useState([]);
    const [editorVisibility, setEditorVisibility] = useState("owner");
    const [writeUsers, setWriteUsers] = useState([]);
    const [writeRoles, setWriteRoles] = useState([]);

    const [deleteConfirmIndex, setDeleteConfirmIndex] = useState(null);

    const hasMultipleVariables = dependentVariables.length > 1;

    const variableItems = useMemo(
        () => dependentVariables.map((v) => ({ label: v, value: v })),
        [dependentVariables]
    );

    const roleItems = useMemo(
        () => workspaceRoles.map((r) => ({ label: r.name ?? r.roleId, value: r.roleId })),
        [workspaceRoles]
    );

    // condition category flags
    const isPercent = isPercentCondition(condition);
    const isAbsoluteChange = isAbsoluteChangeCondition(condition);

    // what sections to show
    const showCompareAgainst = isAbsoluteChange;
    const showAggregateToggle = !isPercent && !!condition;
    const showAggregation = isPercent || useAggregatedValue;
    const showComparisonPeriod = isPercent;

    // % conditions cannot use "any row" (requires date context for period comparison)
    const availableEvaluateOnOptions = isPercent
        ? EVALUATE_ON_OPTIONS.filter((o) => o.value !== "any_value")
        : EVALUATE_ON_OPTIONS;

    // % conditions require a bounded time period (not "all")
    const effectiveTimePeriod = useCustomTimePeriod ? timePeriod : graphTimePeriod;
    const requiresBoundedTimePeriod = isPercent;
    const timePeriodIsBounded = effectiveTimePeriod && effectiveTimePeriod !== "all";

    const isFormValid = useMemo(() => {
        if (!notificationName.trim()) return false;
        if (!condition) return false;
        const numVal = Number(conditionValue);
        if (!conditionValue || isNaN(numVal) || numVal <= 0) return false;
        if (!variable) return false;
        if (!evaluateOn) return false;
        if (!method) return false;
        // % conditions: require bounded time period, comparison period, aggregation
        if (isPercent) {
            if (!timePeriodIsBounded) return false;
            if (!comparisonPeriod) return false;
            if (!aggregation) return false;
        }
        // non-% with aggregated toggle: require aggregation
        if (!isPercent && useAggregatedValue && !aggregation) return false;
        // absolute change: require compare against
        if (isAbsoluteChange && !compareAgainst) return false;
        return true;
    }, [notificationName, condition, conditionValue, variable, evaluateOn, method, isPercent, isAbsoluteChange, timePeriodIsBounded, comparisonPeriod, aggregation, useAggregatedValue, compareAgainst]);

    useEffect(() => {
        if (visible) setView("list");
    }, [visible]);

    // force evaluateOn to date-based when switching to % condition
    useEffect(() => {
        if (isPercent && evaluateOn === "any_value") {
            setEvaluateOn("latest_tracked");
        }
    }, [isPercent, evaluateOn]);

    // reset fields that don't apply to current condition type
    useEffect(() => {
        if (!showCompareAgainst) setCompareAgainst("previous_point");
        if (isPercent) {
            setUseAggregatedValue(false);
            // force custom time period if graph period is "all"
            if (graphTimePeriod === "all" && !useCustomTimePeriod) {
                setUseCustomTimePeriod(true);
            }
        }
        if (!showComparisonPeriod) setComparisonPeriod("");
        if (!showAggregation) setAggregation("");
    }, [condition, showCompareAgainst, showComparisonPeriod, showAggregation, isPercent, graphTimePeriod, useCustomTimePeriod]);

    // auto-select variable if only one dependent variable
    useEffect(() => {
        if (dependentVariables.length === 1) {
            setVariable(dependentVariables[0]);
        }
    }, [dependentVariables]);

    const clearForm = useCallback(() => {
        setNotificationName("");
        setCondition("");
        setConditionValue("");
        setVariable(dependentVariables.length === 1 ? dependentVariables[0] : "");
        setEvaluateOn("latest_tracked");
        setCompareAgainst("previous_point");
        setUseAggregatedValue(false);
        setAggregation("");
        setUseCustomTimePeriod(false);
        setTimePeriod("");
        setComparisonPeriod("");
        setMethod("");
        setVisibility("owner");
        setReadUsers([]);
        setReadRoles([]);
        setEditorVisibility("owner");
        setWriteUsers([]);
        setWriteRoles([]);
    }, [dependentVariables]);

    const handleAdd = () => {
        clearForm();
        setEditingIndex(null);
        setView("form");
    };

    const handleEdit = (index) => {
        const alert = alerts[index];
        setNotificationName(alert.name);
        setCondition(alert.condition);
        setConditionValue(alert.conditionValue ?? "");
        setVariable(alert.variable ?? (dependentVariables.length === 1 ? dependentVariables[0] : ""));
        setEvaluateOn(alert.evaluateOn ?? "latest_tracked");
        setCompareAgainst(alert.compareAgainst ?? "previous_point");
        setUseAggregatedValue(alert.useAggregatedValue ?? false);
        setAggregation(alert.aggregation ?? "");
        const isCustom = alert.timePeriod && alert.timePeriod !== graphTimePeriod;
        setUseCustomTimePeriod(isCustom);
        setTimePeriod(isCustom ? alert.timePeriod : "");
        setComparisonPeriod(alert.comparisonPeriod ?? "");
        setMethod(alert.method);
        setVisibility(alert.access?.visibility ?? "owner");
        setReadUsers(alert.access?.readUsers ?? []);
        setReadRoles(alert.access?.readRoles ?? []);
        setEditorVisibility(alert.access?.writeUsers?.length > 0 || alert.access?.writeRoles?.length > 0 ? "custom" : "owner");
        setWriteUsers(alert.access?.writeUsers ?? []);
        setWriteRoles(alert.access?.writeRoles ?? []);
        setEditingIndex(index);
        setView("form");
    };

    const handleDelete = (index) => {
        setDeleteConfirmIndex(index);
    };

    const confirmDelete = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setAlerts((prev) => prev.filter((_, i) => i !== deleteConfirmIndex));
        setDeleteConfirmIndex(null);
    };

    const cancelDelete = () => {
        setDeleteConfirmIndex(null);
    };

    const handleSave = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const alert = {
            name: notificationName,
            condition,
            conditionValue: Number(conditionValue),
            variable,
            evaluateOn,
            timePeriod: effectiveTimePeriod,
            method,
            ownerId: userId,
            access: {
                visibility,
                readUsers: visibility === "custom" ? readUsers : [],
                readRoles: visibility === "custom" ? readRoles : [],
                writeUsers: editorVisibility === "custom" ? writeUsers : [],
                writeRoles: editorVisibility === "custom" ? writeRoles : [],
            },
        };
        if (showCompareAgainst) alert.compareAgainst = compareAgainst;
        if (showAggregation) {
            alert.aggregation = aggregation;
            alert.useAggregatedValue = isPercent ? true : useAggregatedValue;
        }
        if (showComparisonPeriod) alert.comparisonPeriod = comparisonPeriod;

        if (editingIndex != null) {
            setAlerts((prev) => prev.map((a, i) => (i === editingIndex ? alert : a)));
        } else {
            setAlerts((prev) => [...prev, alert]);
        }
        clearForm();
        setView("list");
    };

    const handleCancel = () => {
        clearForm();
        setView("list");
    };

    const toggleListItem = (list, setList, item) => {
        setList((prev) => prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]);
    };

    const renderList = () => (
        <View>
            <Card.Title title="Set Alerts" />
            <Card.Content>
                {alerts.length === 0 ? (
                    <Text style={[theme.fonts.bodyMedium, { color: theme.colors.themeGrey, marginBottom: 8 }]}>
                        No alerts yet. Tap "Add Alert" to create one.
                    </Text>
                ) : (
                    <ScrollView style={styles.alertList}>
                        {alerts.map((alert, index) => (
                            <List.Item
                                key={index}
                                title={alert.name}
                                titleStyle={theme.fonts.titleSmall}
                                description={`${alert.variable} ${getLabel(CONDITIONS, alert.condition)} ${alert.conditionValue}${alert.timePeriod ? ` · ${getLabel(TIME_PERIODS, alert.timePeriod)}` : ""}`}
                                descriptionStyle={theme.fonts.bodySmall}
                                style={styles.alertRow}
                                right={() => (
                                    <View style={styles.alertActions}>
                                        <IconButton
                                            icon="pencil-outline"
                                            onPress={() => handleEdit(index)}
                                            size={20}
                                            accessibilityLabel="Edit alert"
                                        />
                                        <IconButton
                                            icon="close"
                                            onPress={() => handleDelete(index)}
                                            size={20}
                                            iconColor={theme.colors.error}
                                            accessibilityLabel="Delete alert"
                                        />
                                    </View>
                                )}
                            />
                        ))}
                    </ScrollView>
                )}
                <BasicButton fullWidth label="Add Alert" onPress={handleAdd} style={styles.addButton} />
                <BasicButton label="Close" onPress={onDismiss} style={styles.closeButton} mode="outlined" />
            </Card.Content>

            {/* Delete confirmation dialog */}
            <Portal>
                <Dialog visible={deleteConfirmIndex !== null} onDismiss={cancelDelete}>
                    <Dialog.Title>Delete alert</Dialog.Title>
                    <Dialog.Content>
                        <Text style={theme.fonts.bodyMedium}>
                            Are you sure you want to delete this alert? This cannot be undone.
                        </Text>
                    </Dialog.Content>
                    <Dialog.Actions>
                        <BasicButton label="Cancel" onPress={cancelDelete} mode="text" />
                        <BasicButton label="Delete" onPress={confirmDelete} danger />
                    </Dialog.Actions>
                </Dialog>
            </Portal>
        </View>
    );

    const sectionHeader = (label) => (
        <View style={styles.sectionHeader}>
            <Text style={[theme.fonts.labelLarge, styles.sectionHeaderText, { color: theme.colors.themeGrey }]}>
                {label}
            </Text>
            <Divider style={styles.sectionDivider} />
        </View>
    );

    const renderRadioGroup = (options, value, onChange, showDescription) => (
        <RadioButton.Group onValueChange={onChange} value={value}>
            {options.map((opt) => (
                <View key={opt.value}>
                    <RadioButton.Item
                        label={opt.label}
                        value={opt.value}
                        style={styles.radioItem}
                        labelStyle={theme.fonts.bodyMedium}
                    />
                    {showDescription && opt.description && (
                        <Text style={[theme.fonts.bodySmall, styles.radioDescription, { color: theme.colors.themeGrey }]}>
                            {opt.description}
                        </Text>
                    )}
                </View>
            ))}
        </RadioButton.Group>
    );

    const renderChipSelect = (items, selected, onToggle) => (
        <View style={styles.chipRow}>
            {items.map((item) => {
                const id = item.value ?? item.userId;
                const isSelected = selected.includes(id);
                return (
                    <Chip
                        key={id}
                        selected={isSelected}
                        showSelectedOverlay
                        onPress={() => onToggle(id)}
                        accessibilityRole="checkbox"
                        style={isSelected ? { backgroundColor: theme.colors.secondaryContainer } : undefined}
                        textStyle={{ color: isSelected ? theme.colors.onSecondaryContainer : theme.colors.onSurfaceVariant }}
                    >
                        {item.label ?? `${item.given_name} ${item.family_name}`}
                    </Chip>
                );
            })}
        </View>
    );

    const renderForm = () => {
        const timePeriodItems = requiresBoundedTimePeriod ? BOUNDED_TIME_PERIODS : TIME_PERIODS;
        const graphPeriodLabel = getLabel(TIME_PERIODS, graphTimePeriod);
        const canToggleGraphPeriod = !(requiresBoundedTimePeriod && graphTimePeriod === "all");

        return (
            <View>
                <View style={styles.formHeader}>
                    <IconButton
                        icon="close"
                        onPress={handleCancel}
                        size={24}
                        accessibilityLabel="Cancel and go back"
                    />
                    <Text style={[theme.fonts.titleMedium, { color: theme.colors.text }]}>
                        {editingIndex != null ? "Edit Alert" : "New Alert"}
                    </Text>
                    <Tooltip title="Fill in all required fields to save">
                        <View>
                            <IconButton
                                icon="check"
                                onPress={handleSave}
                                size={24}
                                disabled={!isFormValid}
                                accessibilityLabel="Save alert"
                            />
                        </View>
                    </Tooltip>
                </View>
                <Divider />
                <Card.Content style={styles.formContent}>
                    <ScrollView
                        style={styles.formScroll}
                        contentContainerStyle={styles.formScrollContent}
                        nestedScrollEnabled
                        keyboardShouldPersistTaps="handled"
                    >
                        {/* ── GENERAL ── */}
                        {sectionHeader("General")}
                        <TextField
                            label="Alert Name"
                            placeholder="e.g. Revenue drop"
                            onChangeText={setNotificationName}
                            value={notificationName}
                        />

                        {/* ── WHAT TO MONITOR ── */}
                        {sectionHeader("What to monitor")}
                        {hasMultipleVariables && (
                            <View style={styles.fieldSpacing}>
                                <DropDown
                                    title="Variable"
                                    items={variableItems}
                                    showRouterButton={false}
                                    onSelect={setVariable}
                                    value={variable}
                                    maxVisibleItems={3}
                                />
                            </View>
                        )}
                        <DropDown
                            title="Condition"
                            items={CONDITIONS}
                            showRouterButton={false}
                            onSelect={setCondition}
                            value={condition}
                            maxVisibleItems={3}
                        />
                        <View style={styles.fieldSpacingTop}>
                            <TextField
                                label={isPercent ? "Percentage (%)" : "Value"}
                                placeholder={isPercent ? "e.g. 10" : "e.g. 100"}
                                onChangeText={setConditionValue}
                                value={String(conditionValue)}
                            />
                        </View>

                        {/* ── WHEN TO EVALUATE ── */}
                        {sectionHeader("When to evaluate")}
                        {isPercent && (
                            <Text style={[theme.fonts.bodySmall, styles.helperItalic, { color: theme.colors.onSurfaceVariant }]}>
                                Percentage conditions only work with date-based entries, so "Any row" is not available.
                            </Text>
                        )}
                        {renderRadioGroup(availableEvaluateOnOptions, evaluateOn, setEvaluateOn, true)}
                        {evaluateOn !== "any_value" && (
                            <Text style={[theme.fonts.bodySmall, styles.helperNote, { color: theme.colors.themeGrey }]}>
                                Only data within the selected time period will be considered.
                            </Text>
                        )}
                        {evaluateOn === "any_value" && (
                            <Text style={[theme.fonts.bodySmall, styles.helperNote, { color: theme.colors.themeGrey }]}>
                                All rows are checked regardless of the time period.
                            </Text>
                        )}

                        {/* ── COMPARE AGAINST (non-% change conditions) ── */}
                        {showCompareAgainst && (
                            <>
                                {sectionHeader("Compare against")}
                                <Text style={[theme.fonts.bodySmall, styles.helperSpacing, { color: theme.colors.themeGrey }]}>
                                    {evaluateOn === "any_value"
                                        ? "Each row's value is compared to your chosen reference. \"Previous data point\" uses the most recent entry as the reference for every row."
                                        : "The evaluated data point is compared to your chosen reference. \"Previous data point\" is the entry immediately before the most recent one."}
                                </Text>
                                <DropDown
                                    title="Compare each entry against\u2026"
                                    items={COMPARE_AGAINST_OPTIONS}
                                    showRouterButton={false}
                                    onSelect={setCompareAgainst}
                                    value={compareAgainst}
                                    maxVisibleItems={4}
                                />
                            </>
                        )}

                        {/* ── AGGREGATION OPTIONS ── */}
                        {showAggregateToggle && (
                            <>
                                {sectionHeader("Aggregation")}
                                <Text style={[theme.fonts.bodySmall, styles.helperSpacingSmall, { color: theme.colors.themeGrey }]}>
                                    Compare using a total or average instead of individual entries.
                                </Text>
                                <View style={styles.switchRow}>
                                    <Switch
                                        value={useAggregatedValue}
                                        onValueChange={setUseAggregatedValue}
                                        accessibilityLabel="Compare using a total or average instead of individual entries"
                                    />
                                    <Text style={[theme.fonts.bodyMedium, styles.switchLabel, { color: theme.colors.text }]}>
                                        Use totals or averages
                                    </Text>
                                </View>
                                {useAggregatedValue && (
                                    <DropDown
                                        title="How to combine the values"
                                        items={AGGREGATIONS}
                                        showRouterButton={false}
                                        onSelect={setAggregation}
                                        value={aggregation}
                                        maxVisibleItems={3}
                                    />
                                )}
                            </>
                        )}
                        {isPercent && (
                            <>
                                {sectionHeader("Aggregation")}
                                <Text style={[theme.fonts.bodySmall, styles.helperSpacing, { color: theme.colors.themeGrey }]}>
                                    The values in each time period are aggregated before comparing. Select how values should be combined.
                                </Text>
                                <DropDown
                                    title="How to combine the values"
                                    items={AGGREGATIONS}
                                    showRouterButton={false}
                                    onSelect={setAggregation}
                                    value={aggregation}
                                    maxVisibleItems={3}
                                />
                            </>
                        )}

                        {/* ── TIME PERIOD ── */}
                        {sectionHeader("Time period")}
                        <Text style={[theme.fonts.bodySmall, styles.helperSpacingSmall, { color: theme.colors.themeGrey }]}>
                            {`This alert uses ${graphPeriodLabel} by default. You can override it below.`}
                        </Text>
                        {canToggleGraphPeriod ? (
                            <View style={styles.switchRow}>
                                <Switch
                                    value={useCustomTimePeriod}
                                    onValueChange={setUseCustomTimePeriod}
                                    accessibilityLabel="Override the default time period for this alert"
                                />
                                <Text style={[theme.fonts.bodyMedium, styles.switchLabel, { color: theme.colors.text }]}>
                                    Override the default time period for this alert
                                </Text>
                            </View>
                        ) : (
                            <Text style={[theme.fonts.bodySmall, styles.helperSpacing, { color: theme.colors.error, fontStyle: "italic" }]}>
                                Percentage conditions cannot use the entire data source. Please choose a time period below.
                            </Text>
                        )}
                        {(useCustomTimePeriod || !canToggleGraphPeriod) && (
                            <DropDown
                                title="Time Period"
                                items={timePeriodItems}
                                showRouterButton={false}
                                onSelect={setTimePeriod}
                                value={timePeriod}
                                maxVisibleItems={4}
                            />
                        )}

                        {/* ── COMPARISON PERIOD (% conditions only) ── */}
                        {showComparisonPeriod && (
                            <>
                                {sectionHeader("Comparison period")}
                                <Text style={[theme.fonts.bodySmall, styles.helperSpacing, { color: theme.colors.themeGrey }]}>
                                    The aggregated value of the current time period is compared against the aggregated value of this reference period.
                                </Text>
                                <DropDown
                                    title="Compare the current period against\u2026"
                                    items={COMPARISON_PERIODS}
                                    showRouterButton={false}
                                    onSelect={setComparisonPeriod}
                                    value={comparisonPeriod}
                                    maxVisibleItems={3}
                                />
                            </>
                        )}

                        {/* ── DELIVERY ── */}
                        {sectionHeader("Delivery")}
                        <Chip
                            selected={method === "push"}
                            onPress={() => setMethod(method === "push" ? "" : "push")}
                            showSelectedCheck
                            style={styles.deliveryChip}
                            accessibilityLabel="Push notification"
                            accessibilityRole="checkbox"
                        >
                            Push notification
                        </Chip>

                        {/* ── RECIPIENTS ── */}
                        {sectionHeader("Recipients")}
                        <Text style={[theme.fonts.bodySmall, styles.helperSpacingSmall, { color: theme.colors.themeGrey }]}>
                            Choose who can receive this alert.
                        </Text>
                        {renderRadioGroup(VISIBILITY_OPTIONS, visibility, setVisibility, false)}
                        {visibility === "custom" && (
                            <View style={styles.fieldSpacingTop}>
                                {workspaceUsers.length > 0 && (
                                    <>
                                        <Text style={[theme.fonts.bodySmall, styles.helperSpacingSmall, { color: theme.colors.themeGrey }]}>Users</Text>
                                        {renderChipSelect(
                                            workspaceUsers.filter((u) => u.userId !== userId),
                                            readUsers,
                                            (id) => toggleListItem(readUsers, setReadUsers, id)
                                        )}
                                    </>
                                )}
                                {roleItems.length > 0 && (
                                    <View style={styles.fieldSpacingTop}>
                                        <Text style={[theme.fonts.bodySmall, styles.helperSpacingSmall, { color: theme.colors.themeGrey }]}>Roles</Text>
                                        {renderChipSelect(roleItems, readRoles, (id) => toggleListItem(readRoles, setReadRoles, id))}
                                    </View>
                                )}
                            </View>
                        )}

                        {/* ── EDITORS ── */}
                        {sectionHeader("Editors")}
                        <Text style={[theme.fonts.bodySmall, styles.helperSpacingSmall, { color: theme.colors.themeGrey }]}>
                            Choose who can edit or delete this alert.
                        </Text>
                        {renderRadioGroup(EDITOR_OPTIONS, editorVisibility, setEditorVisibility, false)}
                        {editorVisibility === "custom" && (
                            <View style={styles.fieldSpacingTop}>
                                {workspaceUsers.length > 0 && (
                                    <>
                                        <Text style={[theme.fonts.bodySmall, styles.helperSpacingSmall, { color: theme.colors.themeGrey }]}>Users</Text>
                                        {renderChipSelect(
                                            workspaceUsers.filter((u) => u.userId !== userId),
                                            writeUsers,
                                            (id) => toggleListItem(writeUsers, setWriteUsers, id)
                                        )}
                                    </>
                                )}
                                {roleItems.length > 0 && (
                                    <View style={styles.fieldSpacingTop}>
                                        <Text style={[theme.fonts.bodySmall, styles.helperSpacingSmall, { color: theme.colors.themeGrey }]}>Roles</Text>
                                        {renderChipSelect(roleItems, writeRoles, (id) => toggleListItem(writeRoles, setWriteRoles, id))}
                                    </View>
                                )}
                            </View>
                        )}
                    </ScrollView>
                </Card.Content>
            </View>
        );
    };

    return (
        <Portal>
            <Modal
                visible={visible}
                onDismiss={onDismiss}
                contentContainerStyle={sharedModalStyles.modalContainer}
            >
                <Card style={[sharedModalStyles.card, styles.card]}>
                    {view === "form" ? renderForm() : renderList()}
                </Card>
            </Modal>
        </Portal>
    );
}
