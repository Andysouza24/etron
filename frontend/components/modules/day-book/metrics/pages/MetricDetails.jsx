import { useCallback, useMemo, useState } from "react";
import { View, Text } from "react-native";
import { Dialog, IconButton, Portal, useTheme } from "react-native-paper";
import TextField from "../../../../common/input/TextField";
import BasicButton from "../../../../common/buttons/BasicButton";
import ViewShot from "react-native-view-shot";
import CustomiseOptions from "../CustomiseOptions";
import MetricViewer from "../MetricViewer";
import useMetricPreview from "../../../../../hooks/modules/day_book/metrics/useMetricPreview";

export default function MetricDetails({
    metricName,
    setMetricName,
    coloursState,
    setColoursState,
    wheelIndex,
    setWheelIndex,
    dependentVariables = [],
    viewShotRef,
    graphType,
    graphData,
    xKey,
    yKeys,
    dataSourceId,
    aggregation,
    dimensionField,
    valueFields,
    selectedRows,
    selectedMetric,
    setSelectedMetric,
    maxValue,
    setMaxValue,
    capPercentAt100,
    setCapPercentAt100,
    boxGrouping,
    setBoxGrouping,
    boxTimePeriod,
    setBoxTimePeriod,
    pieLabelPlacement,
    setPieLabelPlacement,
    rounding,
    setRounding,
    numberFormat,
    setNumberFormat,
    percentRounding,
    setPercentRounding,
    axisNumberFormat,
    setAxisNumberFormat,
    rawGraphData,
    boxUseRawData,
    setBoxUseRawData,
    xAxisDateFormat,
    setXAxisDateFormat,
    xAxisChronological,
    setXAxisChronological,
    alerts,
    setAlerts,
    thresholds,
    setThresholds,
    userId,
    workspaceId,
    workspaceUsers,
    fieldAliases,
    setFieldAliases,
}) {
    const theme = useTheme();
    const [isNameSaved, setIsNameSaved] = useState(false);
    const [aggregationPeriod, setAggregationPeriod] = useState("daily");

    // Local rename dialog state. `field` is the underlying data-source
    // column being aliased; `defaultLabel` is the fallback shown in the
    // input placeholder when no alias is set yet.
    const [renameTarget, setRenameTarget] = useState(null);
    const [renameValue, setRenameValue] = useState("");

    const aliases = fieldAliases ?? {};
    const canEditAliases = typeof setFieldAliases === "function";

    const openRenameDialog = useCallback((field, defaultLabel) => {
        if (!canEditAliases || !field) return;
        setRenameTarget({ field, defaultLabel: defaultLabel ?? field });
        setRenameValue(aliases[field] ?? "");
    }, [aliases, canEditAliases]);

    const closeRenameDialog = useCallback(() => {
        setRenameTarget(null);
        setRenameValue("");
    }, []);

    const handleSaveAlias = useCallback(() => {
        if (!renameTarget || !canEditAliases) {
            closeRenameDialog();
            return;
        }
        const trimmed = renameValue.trim();
        setFieldAliases((prev) => {
            const next = { ...(prev ?? {}) };
            if (trimmed) {
                next[renameTarget.field] = trimmed;
            } else {
                delete next[renameTarget.field];
            }
            return next;
        });
        closeRenameDialog();
    }, [renameTarget, renameValue, canEditAliases, setFieldAliases, closeRenameDialog]);

    // Build a config object in the same shape MetricGraph receives elsewhere
    // so the wizard preview behaves identically to the saved metric.
    const previewConfig = useMemo(() => ({
        type: graphType,
        chartType: graphType,
        independentVariable: xKey,
        // For dimensional metrics the backend needs the underlying value
        // field (passed via `valueFields`); the chart yKeys are the pivoted
        // dimension values (`yKeys`).
        dependentVariables: Array.isArray(valueFields) && valueFields.length > 0 ? valueFields : yKeys,
        aggregation: aggregation ?? null,
        dimensionField: dimensionField ?? null,
        selectedRows: selectedRows ?? [],
        maxValue,
        capPercentAt100,
        boxGrouping,
        boxTimePeriod,
        pieLabelPlacement,
        rounding,
        numberFormat,
        percentRounding,
        axisNumberFormat,
        rawGraphData,
        boxUseRawData,
        xAxisDateFormat,
        xAxisChronological,
        thresholds,
    }), [graphType, xKey, yKeys, valueFields, aggregation, dimensionField, selectedRows, maxValue, capPercentAt100, boxGrouping, boxTimePeriod, pieLabelPlacement, rounding, numberFormat, percentRounding, axisNumberFormat, rawGraphData, boxUseRawData, xAxisDateFormat, xAxisChronological, thresholds]);

    // When a dataSourceId is supplied, fetch the preview data through the
    // same backend pipeline used by view-metric so the chart matches exactly.
    // Falls back to the locally-built `graphData` for legacy callers.
    const preview = useMetricPreview(dataSourceId, dataSourceId ? previewConfig : null, { aggregationPeriod });
    const chartData = dataSourceId ? preview.data : graphData;
    const chartYKeys = dataSourceId && preview.yKeys.length > 0 ? preview.yKeys : yKeys;

    const handleSaveName = () => {
        if (metricName.trim()) {
            setIsNameSaved(true);
        }
    };

    return (
        <View>
            {isNameSaved ? (
                <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 8 }}>
                    <Text style={{ fontSize: 18, fontWeight: "bold", color: theme.colors.text, flex: 1 }}>
                        {metricName}
                    </Text>
                    <IconButton icon="pencil" size={20} onPress={() => setIsNameSaved(false)} />
                </View>
            ) : (
                <TextField
                    label="Metric Name"
                    placeholder="Metric Name"
                    onChangeText={setMetricName}
                    value={metricName}
                    customRightButton={!!metricName.trim()}
                    rightButtonIcon="check"
                    rightButtonPress={handleSaveName}
                    onBlur={handleSaveName}
                />
            )}

            <MetricViewer
                config={previewConfig}
                data={chartData}
                yKeys={chartYKeys}
                colours={coloursState}
                availableYears={dataSourceId ? preview.availableYears : null}
                selectedYear={dataSourceId ? preview.selectedYear : null}
                onYearChange={dataSourceId ? preview.refetchForYear : undefined}
                loading={dataSourceId ? preview.loading : false}
                aliases={aliases}
                wheelIndex={wheelIndex}
                setWheelIndex={setWheelIndex}
                onRenameVariable={canEditAliases ? openRenameDialog : undefined}
                onRenameIndependent={canEditAliases && xKey ? openRenameDialog : undefined}
                aggregationPeriod={aggregationPeriod}
                onAggregationPeriodChange={setAggregationPeriod}
                renderGraphContainer={(graphNode) => (
                    <View style={{ marginBottom: 16 }}>
                        <ViewShot
                            ref={viewShotRef}
                            options={{ format: "png", quality: 1.0, result: "tmpfile" }}
                        >
                            <View
                                collapsable={false}
                                style={{ width: "100%", aspectRatio: 1 }}
                                pointerEvents="box-none"
                            >
                                {graphNode}
                            </View>
                        </ViewShot>
                    </View>
                )}
            />

            <Portal>
                <Dialog
                    visible={!!renameTarget}
                    onDismiss={closeRenameDialog}
                    style={{ backgroundColor: theme.colors.surface }}
                >
                    <Dialog.Title>Rename field</Dialog.Title>
                    <Dialog.Content>
                        <Text style={{ color: theme.colors.onSurfaceVariant, marginBottom: 8 }}>
                            {`Choose a label to show instead of "${renameTarget?.defaultLabel ?? ""}" when viewing this metric.`}
                        </Text>
                        <TextField
                            label="Display name"
                            placeholder={renameTarget?.defaultLabel ?? ""}
                            value={renameValue}
                            onChangeText={setRenameValue}
                            autoFocus
                        />
                    </Dialog.Content>
                    <Dialog.Actions>
                        <BasicButton label="Cancel" onPress={closeRenameDialog} />
                        <BasicButton label="Save" onPress={handleSaveAlias} />
                    </Dialog.Actions>
                </Dialog>
            </Portal>

            <View style={{ marginTop: 16 }}>
                <CustomiseOptions
                    selectedMetric={selectedMetric}
                    setSelectedMetric={setSelectedMetric}
                    maxValue={maxValue}
                    setMaxValue={setMaxValue}
                    capPercentAt100={capPercentAt100}
                    setCapPercentAt100={setCapPercentAt100}
                    boxGrouping={boxGrouping}
                    setBoxGrouping={setBoxGrouping}
                    boxTimePeriod={boxTimePeriod}
                    setBoxTimePeriod={setBoxTimePeriod}
                    pieLabelPlacement={pieLabelPlacement}
                    setPieLabelPlacement={setPieLabelPlacement}
                    rounding={rounding}
                    setRounding={setRounding}
                    numberFormat={numberFormat}
                    setNumberFormat={setNumberFormat}
                    percentRounding={percentRounding}
                    setPercentRounding={setPercentRounding}
                    axisNumberFormat={axisNumberFormat}
                    setAxisNumberFormat={setAxisNumberFormat}
                    boxUseRawData={boxUseRawData}
                    setBoxUseRawData={setBoxUseRawData}
                    xAxisDateFormat={xAxisDateFormat}
                    setXAxisDateFormat={setXAxisDateFormat}
                    xAxisChronological={xAxisChronological}
                    setXAxisChronological={setXAxisChronological}
                    alerts={alerts}
                    setAlerts={setAlerts}
                    thresholds={thresholds}
                    setThresholds={setThresholds}
                    dependentVariables={dependentVariables}
                    userId={userId}
                    workspaceId={workspaceId}
                    workspaceUsers={workspaceUsers}
                    graphData={chartData}
                    yKeys={chartYKeys}
                    rawGraphData={rawGraphData}
                />
            </View>
        </View>
    );
}
