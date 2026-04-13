import { View, ScrollView, TouchableOpacity } from "react-native";
import { Modal, Portal, Card, Text, useTheme, RadioButton } from "react-native-paper";
import BasicButton from "../../../../common/buttons/BasicButton";
import IconButton from "../../../../common/buttons/IconButton";
import TextField from "../../../../common/input/TextField";
import DropDown from "../../../../common/input/DropDown";
import { useState, useEffect } from "react";

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

const TIME_PERIODS = [
    { label: "1 day", value: "1d" },
    { label: "1 week", value: "1w" },
    { label: "2 weeks", value: "2w" },
    { label: "1 month", value: "1m" },
    { label: "3 months", value: "3m" },
    { label: "6 months", value: "6m" },
    { label: "1 year", value: "1y" },
];

const COMPARISON_PERIODS = [
    { label: "previous period", value: "previous" },
];

const METHODS = [
    { label: "push notification", value: "push" },
];

function getLabel(items, value) {
    return items.find((i) => i.value === value)?.label ?? value;
}

export default function SetAlerts({ visible, onDismiss, alerts, setAlerts }) {
    const theme = useTheme();
    const [view, setView] = useState("list");
    const [editingIndex, setEditingIndex] = useState(null);

    const [notificationName, setNotificationName] = useState("");
    const [condition, setCondition] = useState("");
    const [conditionValue, setConditionValue] = useState("");
    const [timePeriod, setTimePeriod] = useState("");
    const [comparisonPeriod, setComparisonPeriod] = useState("");
    const [method, setMethod] = useState("");

    useEffect(() => {
        if (visible) setView("list");
    }, [visible]);

    const clearForm = () => {
        setNotificationName("");
        setCondition("");
        setConditionValue("");
        setTimePeriod("");
        setComparisonPeriod("");
        setMethod("");
    };

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
        setTimePeriod(alert.timePeriod);
        setComparisonPeriod(alert.comparisonPeriod);
        setMethod(alert.method);
        setEditingIndex(index);
        setView("form");
    };

    const handleDelete = (index) => {
        setAlerts((prev) => prev.filter((_, i) => i !== index));
    };

    const handleSave = () => {
        const alert = {
            name: notificationName,
            condition,
            conditionValue,
            timePeriod,
            comparisonPeriod,
            method,
        };
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

    const renderList = () => (
        <View>
            <Card.Title title="Set Alerts" />
            <Card.Content>
                {alerts.length === 0 ? (
                    <Text style={{ color: theme.colors.themeGrey, marginBottom: 8 }}>No alerts configured yet.</Text>
                ) : (
                    <ScrollView style={{ maxHeight: 250 }}>
                        {alerts.map((alert, index) => (
                            <View
                                key={index}
                                style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    paddingVertical: 8,
                                    borderBottomWidth: 1,
                                    borderBottomColor: theme.colors.divider,
                                }}
                            >
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontWeight: "600", color: theme.colors.text }}>{alert.name}</Text>
                                    <Text style={{ fontSize: 12, color: theme.colors.themeGrey }}>
                                        {getLabel(CONDITIONS, alert.condition)} {alert.conditionValue} · {getLabel(TIME_PERIODS, alert.timePeriod)}
                                    </Text>
                                </View>
                                <IconButton
                                    icon="pencil-outline"
                                    onPress={() => handleEdit(index)}
                                    mode="text"
                                    backgroundColor="transparent"
                                />
                                <IconButton
                                    icon="close"
                                    onPress={() => handleDelete(index)}
                                    mode="text"
                                    backgroundColor="transparent"
                                />
                            </View>
                        ))}
                    </ScrollView>
                )}
                <BasicButton
                    fullWidth
                    label="Add Alert"
                    onPress={handleAdd}
                    style={{ marginTop: 12 }}
                />
                <BasicButton
                    label="Close"
                    onPress={onDismiss}
                    style={{ marginTop: 8, alignSelf: "center" }}
                    danger
                />
            </Card.Content>
        </View>
    );

    const sectionHeader = (label) => (
        <View style={{ marginTop: 16, marginBottom: 8 }}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: theme.colors.themeGrey, textTransform: "uppercase", letterSpacing: 0.8 }}>
                {label}
            </Text>
            <View style={{ height: 1, backgroundColor: theme.colors.divider, marginTop: 6 }} />
        </View>
    );

    const renderForm = () => (
        <View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", width: "100%", paddingHorizontal: 12, paddingTop: 12, paddingBottom: 4 }}>
                <IconButton icon="close" onPress={handleCancel} mode="text" backgroundColor="transparent" />
                <Text style={{ fontSize: 16, fontWeight: "700", color: theme.colors.text }}>
                    {editingIndex != null ? "Edit Alert" : "New Alert"}
                </Text>
                <IconButton icon="check" onPress={handleSave} mode="text" backgroundColor="transparent" />
            </View>
            <View style={{ height: 1, backgroundColor: theme.colors.divider }} />
            <Card.Content style={{ paddingTop: 4 }}>
                <ScrollView
                    style={{ maxHeight: 800 }}
                    contentContainerStyle={{ paddingTop: 4, paddingBottom: 16 }}
                    nestedScrollEnabled
                    keyboardShouldPersistTaps="handled"
                >
                    {sectionHeader("General")}
                    <TextField
                        label="Alert Name"
                        placeholder="e.g. Revenue drop"
                        onChangeText={setNotificationName}
                        value={notificationName}
                    />

                    {sectionHeader("Trigger")}
                    <DropDown
                        title="Condition"
                        items={CONDITIONS}
                        showRouterButton={false}
                        onSelect={setCondition}
                        value={condition}
                        maxVisibleItems={3}
                    />
                    <View style={{ marginTop: 8 }}>
                        <TextField
                            label="Value"
                            placeholder="e.g. 100"
                            onChangeText={setConditionValue}
                            value={conditionValue}
                        />
                    </View>

                    {sectionHeader("Timing")}
                    <DropDown
                        title="Time Period"
                        items={TIME_PERIODS}
                        showRouterButton={false}
                        onSelect={setTimePeriod}
                        value={timePeriod}
                        maxVisibleItems={3}
                    />
                    <View style={{ marginTop: 8 }}>
                        <DropDown
                            title="Comparison Period"
                            items={COMPARISON_PERIODS}
                            showRouterButton={false}
                            onSelect={setComparisonPeriod}
                            value={comparisonPeriod}
                            maxVisibleItems={3}
                        />
                    </View>

                    {sectionHeader("Delivery")}
                    <RadioButton.Group onValueChange={setMethod} value={method}>
                        {METHODS.map((m) => (
                            <TouchableOpacity
                                key={m.value}
                                onPress={() => setMethod(m.value)}
                                style={{ flexDirection: "row", alignItems: "center", paddingVertical: 6 }}
                            >
                                <RadioButton value={m.value} />
                                <Text style={{ color: theme.colors.text, fontSize: 14 }}>{m.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </RadioButton.Group>
                </ScrollView>
            </Card.Content>
        </View>
    );

    return (
        <Portal>
            <Modal
                visible={visible}
                onDismiss={onDismiss}
                contentContainerStyle={{ justifyContent: "center", alignItems: "center", padding: 16 }}
            >
                <Card style={{ width: "90%", maxHeight: "100%", padding: 4 }}>
                    {view === "form" ? renderForm() : renderList()}
                </Card>
            </Modal>
        </Portal>
    );
}
