// Author(s): Noah Bradley
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { View } from "react-native";
import { ActivityIndicator } from "react-native-paper";
import { useLocalSearchParams, useRouter } from "expo-router";
import { getCurrentUser } from "aws-amplify/auth";


import Header from "../../../../../../../components/layout/Header";
import ResponsiveScreen from "../../../../../../../components/layout/ResponsiveScreen";
import BasicButton from "../../../../../../../components/common/buttons/BasicButton";
import MetricDetails from "../../../../../../../components/modules/day-book/metrics/pages/MetricDetails";

import useMetricForm from "../../../../../../../hooks/modules/day_book/metrics/useMetricForm";
import useMetricDataSource from "../../../../../../../hooks/modules/day_book/metrics/useMetricDataSource";
import useMetricSubmission from "../../../../../../../hooks/modules/day_book/metrics/useMetricSubmission";
import useCurrencySymbolSeed from "../../../../../../../hooks/modules/day_book/metrics/useCurrencySymbolSeed";

import metricService from "../../../../../../../services/MetricService";
import { getWorkspaceId } from "../../../../../../../storage/workspaceStorage";
import { apiGet } from "../../../../../../../utils/api/apiClient";
import endpoints from "../../../../../../../utils/api/endpoints";

import { DEFAULT_NUMBER_FORMAT } from "../../../../../../../utils/constants/modules/day-book/metrics/numberFormat";
import { simpleStyles } from "../../../../../../../assets/styles/stylesheets/day-book/modules/metrics/simpleMetric";

const EditMetric = () => {
    const router = useRouter();
    const { metricId } = useLocalSearchParams();

    const ds = useMetricDataSource();
    const form = useMetricForm();
    const { viewShotRef } = useMetricSubmission();

    const [loadingMetric, setLoadingMetric] = useState(true);
    const [saving, setSaving] = useState(false);

    // Snapshot of the loaded metric so we can preserve fields the edit
    // surface doesn't expose (data source, variable selections, etc.).
    const [originalMetric, setOriginalMetric] = useState(null);

    // Chart selections seeded from the saved metric. Data source, variables
    // and row selection are intentionally read-only on this screen so we
    // mirror the last step of the create-metric wizard.
    const [selectedMetric, setSelectedMetric] = useState("line");
    const [independentVariable, setIndependentVariable] = useState(null);
    const [dependentVariables, setDependentVariables] = useState([]);
    const [dimensionField, setDimensionField] = useState(null);
    const [aggregation, setAggregation] = useState(null);
    const [selectedRows, setSelectedRows] = useState([]);

    // Customise options (match the create-simple wizard state shape).
    const [maxValue, setMaxValue] = useState(null);
    const [capPercentAt100, setCapPercentAt100] = useState(false);
    const [boxGrouping, setBoxGrouping] = useState("all");
    const [boxTimePeriod, setBoxTimePeriod] = useState("date");
    const [pieLabelPlacement, setPieLabelPlacement] = useState("outside");
    const [rounding, setRounding] = useState({ mode: "none", decimalPlaces: 2 });
    const [percentRounding, setPercentRounding] = useState({ mode: "none", decimalPlaces: 1 });
    const [axisNumberFormat, setAxisNumberFormat] = useState(null);
    const [boxUseRawData, setBoxUseRawData] = useState(false);
    const [numberFormat, setNumberFormat] = useState({ ...DEFAULT_NUMBER_FORMAT });
    const [xAxisDateFormat, setXAxisDateFormat] = useState("auto");
    const [xAxisChronological, setXAxisChronological] = useState(true);
    const [alerts, setAlerts] = useState([]);
    const [thresholds, setThresholds] = useState([]);

    // Workspace + user context needed by the alerts UI inside CustomiseOptions.
    const [workspaceId, setWorkspaceId] = useState(null);
    const [currentUserId, setCurrentUserId] = useState(null);
    const [workspaceUsers, setWorkspaceUsers] = useState([]);
    // Editable field aliases for chips (mirrors create-metric flows)
    const [fieldAliases, setFieldAliases] = useState({});

    useEffect(() => {
        (async () => {
            try {
                const wsId = await getWorkspaceId();
                setWorkspaceId(wsId);
                const { userId } = await getCurrentUser();
                setCurrentUserId(userId);
                if (wsId) {
                    const res = await apiGet(endpoints.workspace.users.getUsers(wsId));
                    setWorkspaceUsers(res?.data ?? res ?? []);
                }
            } catch (err) {
                console.error("[EditMetric] Error loading workspace data:", err);
            }
        })();
    }, []);

    // Seed fieldAliases from loaded metric config
    useEffect(() => {
        if (originalMetric?.config?.fieldAliases) {
            setFieldAliases(originalMetric.config.fieldAliases);
        }
    }, [originalMetric]);

    // Load the metric, seed all editable state, then trigger the data source
    // download so the preview chart can render.
    useEffect(() => {
        (async () => {
            if (!metricId) return;
            setLoadingMetric(true);
            try {
                const result = await metricService.getMetric(metricId);
                const metric = result?.data ?? result;
                if (!metric) return;
                setOriginalMetric(metric);

                form.setMetricName(metric.name || "");

                const config = metric.config || {};
                setSelectedMetric(config.type || "line");
                setIndependentVariable(config.independentVariable || null);
                setDependentVariables(Array.isArray(config.dependentVariables) ? config.dependentVariables : []);
                setDimensionField(config.dimensionField ?? null);
                setAggregation(config.aggregation ?? null);
                setSelectedRows(Array.isArray(config.selectedRows) ? config.selectedRows : []);

                if (Array.isArray(config.colours) && config.colours.length > 0) {
                    form.setColoursState(config.colours);
                }

                if (config.maxValue != null) setMaxValue(config.maxValue);
                if (config.capPercentAt100 != null) setCapPercentAt100(config.capPercentAt100);
                if (config.boxGrouping) setBoxGrouping(config.boxGrouping);
                if (config.boxTimePeriod) setBoxTimePeriod(config.boxTimePeriod);
                if (config.pieLabelPlacement) setPieLabelPlacement(config.pieLabelPlacement);
                if (config.rounding) setRounding(config.rounding);
                if (config.percentRounding) setPercentRounding(config.percentRounding);
                if (config.axisNumberFormat != null) setAxisNumberFormat(config.axisNumberFormat);
                if (config.boxUseRawData != null) setBoxUseRawData(config.boxUseRawData);
                if (config.numberFormat) setNumberFormat(config.numberFormat);
                if (config.xAxisDateFormat) setXAxisDateFormat(config.xAxisDateFormat);
                if (config.xAxisChronological != null) setXAxisChronological(config.xAxisChronological);
                if (Array.isArray(config.alerts)) setAlerts(config.alerts);
                if (Array.isArray(config.thresholds)) setThresholds(config.thresholds);

                if (metric.dataSourceId) {
                    await ds.selectDataSource(metric.dataSourceId);
                }
            } catch (err) {
                console.error("[EditMetric] Error loading metric:", err);
            } finally {
                setLoadingMetric(false);
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [metricId]);

    useCurrencySymbolSeed(
        dependentVariables[0] ?? null,
        ds.classifiedFields?.valueFields,
        setNumberFormat
    );

    const handleSave = useCallback(async () => {
        if (!form.metricName.trim() || !originalMetric) return;
        setSaving(true);
        try {
            await metricService.updateMetric(metricId, {
                name: form.metricName,
                type: originalMetric.type,
                dataSourceId: originalMetric.dataSourceId,
                config: {
                    ...(originalMetric.config || {}),
                    type: selectedMetric,
                    independentVariable,
                    dependentVariables,
                    dimensionField,
                    aggregation,
                    colours: form.coloursState,
                    selectedRows,
                    maxValue,
                    capPercentAt100,
                    boxGrouping,
                    boxTimePeriod,
                    pieLabelPlacement,
                    rounding,
                    numberFormat,
                    percentRounding,
                    axisNumberFormat,
                    boxUseRawData,
                    xAxisDateFormat,
                    xAxisChronological,
                    alerts,
                    thresholds,
                    fieldAliases,
                },
            });
            router.back();
        } catch (err) {
            console.error("[EditMetric] Error saving metric:", err);
        } finally {
            setSaving(false);
        }
    }, [
        form.metricName, form.coloursState, originalMetric, metricId, router,
        selectedMetric, independentVariable, dependentVariables, dimensionField,
        aggregation, selectedRows, maxValue, capPercentAt100, boxGrouping,
        boxTimePeriod, pieLabelPlacement, rounding, numberFormat, percentRounding,
        axisNumberFormat, boxUseRawData, xAxisDateFormat, xAxisChronological, alerts, thresholds, fieldAliases,
    ]);

    const saveDisabled = useMemo(
        () => !form.metricName.trim() || saving || ds.downloadStatus !== "downloaded",
        [form.metricName, saving, ds.downloadStatus]
    );

    if (loadingMetric || ds.downloadStatus !== "downloaded") {
        return (
            <ResponsiveScreen
                header={<Header title="Edit Metric" showBack />}
                center
                padded={false}
                scroll={false}
            >
                <ActivityIndicator size="large" />
            </ResponsiveScreen>
        );
    }

    return (
        <ResponsiveScreen
            header={<Header title="Edit Metric" showBack />}
            center={false}
            padded
            scroll
            loadingOverlayActive={saving}
        >
            <View style={simpleStyles.content}>
                <MetricDetails
                    metricName={form.metricName}
                    setMetricName={form.setMetricName}
                    coloursState={form.coloursState}
                    setColoursState={form.setColoursState}
                    wheelIndex={form.wheelIndex}
                    setWheelIndex={form.setWheelIndex}
                    dependentVariables={dependentVariables}
                    viewShotRef={viewShotRef}
                    graphType={selectedMetric}
                    graphData={[]}
                    xKey={independentVariable}
                    yKeys={dependentVariables}
                    dataSourceId={ds.dataSourceId}
                    aggregation={aggregation}
                    dimensionField={dimensionField}
                    selectedRows={selectedRows}
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
                    rawGraphData={null}
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
                    userId={currentUserId}
                    workspaceId={workspaceId}
                    workspaceUsers={workspaceUsers}
                    fieldAliases={fieldAliases}
                    setFieldAliases={setFieldAliases}
                />

                <View style={{ alignItems: "flex-end" }}>
                    <BasicButton
                        label="Save"
                        onPress={handleSave}
                        disabled={saveDisabled}
                        style={simpleStyles.button}
                    />
                </View>
            </View>
        </ResponsiveScreen>
    );
};

export default EditMetric;
