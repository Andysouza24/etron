// Author(s): Noah Bradley
import { View, StyleSheet, FlatList, ScrollView } from 'react-native';
import React, { useState, useEffect, useMemo, useCallback, use } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import Header from "../../../../../../../components/layout/Header";
import {
	Text,
	Card,
	ActivityIndicator,
	DataTable,
	Modal,
	Portal,
	Chip,
	useTheme,
	IconButton,
	Snackbar,
    Button,
} from "react-native-paper";
import BasicButton from "../../../../../../../components/common/buttons/BasicButton";
import DropDown from '../../../../../../../components/common/input/DropDown';
import TextField from '../../../../../../../components/common/input/TextField';
import MetricCheckbox from '../../../../../../../components/common/buttons/MetricCheckbox';
import MetricRadioButton from '../../../../../../../components/common/buttons/MetricRadioButton';
import GraphTypes from '../graph-types';

import { getWorkspaceId } from "../../../../../../../storage/workspaceStorage";
import endpoints from '../../../../../../../utils/api/endpoints';
import { apiGet, apiPatch } from '../../../../../../../utils/api/apiClient';

import ColorPicker from 'react-native-wheel-color-picker';
import throttle from 'lodash.throttle';
import ResponsiveScreen from '../../../../../../../components/layout/ResponsiveScreen';

const EditMetric = () => {
	const router = useRouter();
	const theme = useTheme();
	const { metricId } = useLocalSearchParams();

	const [saving, setSaving] = useState(false);
	const [snack, setSnack] = useState({ visible: false, text: "" });

	const [dataSourceMappings, setDataSourceMappings] = useState([]);
	const [loadingSources, setLoadingSources] = useState(true);

	const [loadingMetric, setLoadingMetric] = useState(true);

	const [metricName, setMetricName] = useState("");
	const [selectedMetric, setSelectedMetric] = useState(null);
	const [dataSourceId, setDataSourceId] = useState(null);

	const [dataSourceData, setDataSourceData] = useState([]);
	const [dataSourceVariableNames, setDataSourceVariableNames] = useState([]);
	const [dataDownloadStatus, setDataDownloadStatus] = useState("unstarted");

	const [chosenIndependentVariable, setChosenIndependentVariable] = useState("");
	const [chosenDependentVariables, setChosenDependentVariables] = useState([]);
	const [selectedRows, setSelectedRows] = useState([]);
	const [coloursState, setColoursState] = useState(['#ed1c24','#d11cd5','#5f80c7ff','#57ff0a','#ffde17','#f26522']);
	const [wheelIndex, setWheelIndex] = useState(0);

	const rowLoadAmount = 5;
	const [rowLimit, setRowLimit] = useState(rowLoadAmount);
	const displayedRows = useMemo(() => dataSourceData.slice(0, rowLimit), [dataSourceData, rowLimit]);
	const [loadingMoreRows, setLoadingMoreRows] = useState(false);

	const onPreviewBottomReached = useCallback(() => {
		if (loadingMoreRows) return;
		if (rowLimit >= dataSourceData.length) return;
		setLoadingMoreRows(true);
		requestAnimationFrame(() => {
			setRowLimit(prev => Math.min(prev + rowLoadAmount, dataSourceData.length));
			setLoadingMoreRows(false);
		});
	}, [dataSourceData.length, rowLimit, loadingMoreRows]);

	const [dataVisible, setDataVisible] = useState(false);
	const showDataModal = () => setDataVisible(true);
	const hideDataModal = () => setDataVisible(false);

	const [showChecklist, setShowChecklist] = useState(false);

	useEffect(() => {
		(async () => {
			setLoadingSources(true);
			try {
				const workspaceId = await getWorkspaceId();
				const srcResult = await apiGet(endpoints.modules.day_book.data_sources.getDataSources, { workspaceId });
				const srcs = srcResult.data || [];
				setDataSourceMappings(srcs.map(ds => ({ id: ds.dataSourceId, name: ds.name })));
			} catch (error) {
				console.error("Error loading sources:", error);
			} finally {
				setLoadingSources(false);
			}
		})();
	}, []);

	useEffect(() => {
		(async () => {
			setLoadingMetric(true);
			try {
				const workspaceId = await getWorkspaceId();
				const metricRes = await apiGet(endpoints.modules.day_book.metrics.getMetric(metricId), { workspaceId });
				const metric = metricRes.data;

				// Seed UI with existing metric config
				setMetricName(metric.name || "");
				setSelectedMetric(metric.config?.type || null);
				setDataSourceId(metric.dataSourceId || null);
				setChosenIndependentVariable(metric.config?.independentVariable || "");
				setChosenDependentVariables(metric.config?.dependentVariables || []);
				setColoursState(metric.config?.colours?.length ? metric.config.colours : coloursState);
				setSelectedRows(Array.isArray(metric.config?.selectedRows) ? metric.config.selectedRows : []);
			} catch (e) {
				console.error("Error loading metric:", e);
			} finally {
				setLoadingMetric(false);
			}
		})();
	}, [metricId]);

	// When dataSourceId changes (or initial metric loads), fetch data + schema for that source
	useEffect(() => {
		if (!dataSourceId) return;
		(async () => {
			setDataDownloadStatus("downloading");
			try {
				const workspaceId = await getWorkspaceId();
				const res = await apiGet(endpoints.modules.day_book.data_sources.viewData(dataSourceId), { workspaceId });
				const { data, schema } = res.data || {};
				setDataSourceData(Array.isArray(data) ? data : []);
				setDataSourceVariableNames(Array.isArray(schema) ? schema.map(v => v.name) : []);
				setDataDownloadStatus("downloaded");
				// If variables were empty (e.g., user switched sources), reset
				if (!chosenIndependentVariable || !dataSourceVariableNames.includes(chosenIndependentVariable)) {
					setChosenIndependentVariable(schema?.[0]?.name || "");
				}
				// Filter dependent vars to ones that exist in this source
				setChosenDependentVariables(prev =>
					Array.isArray(prev) ? prev.filter(k => (schema || []).some(s => s.name === k)) : []
				);
				// If selected rows exist, keep only rows whose ID still exists
				if (selectedRows?.length && schema?.[0]?.name) {
					const idKey = schema[0].name;
					const validIds = new Set((data || []).map(r => r[idKey]));
					setSelectedRows(sr => sr.filter(id => validIds.has(id)));
				}
			} catch (e) {
				console.error("Error loading data for source:", e);
				setDataDownloadStatus("unstarted");
			}
		})();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [dataSourceId]);

	const convertToGraphData = (rows) => {
		// Mimic ViewMetric: include X and only chosen Ys, coerce numerics
		return rows.map(row => {
			const obj = {};
			// X
			const xv = row[chosenIndependentVariable];
			obj[chosenIndependentVariable] = Number(xv) || xv;
			// Ys
			for (const y of chosenDependentVariables) {
				const val = row[y];
				const asNum = Number(val);
				obj[y] = !isNaN(asNum) ? asNum : val;
			}
			return obj;
		});
	};

	const dependentArray = Array.isArray(chosenDependentVariables)
		? chosenDependentVariables
		: chosenDependentVariables
			? [chosenDependentVariables]
			: [];

	const handleDataSourceSelect = async (sourceId) => {
		setDataSourceId(sourceId);
		// Reset paginated preview
		setRowLimit(rowLoadAmount);
	};

	const handleSave = async () => {
		try {
			setSaving(true);
			const workspaceId = await getWorkspaceId();

			await apiPatch(endpoints.modules.day_book.metrics.update(metricId), {
                workspaceId,
                name: metricName,
                dataSourceId,
                config: {
					type: selectedMetric,
					independentVariable: chosenIndependentVariable,
					dependentVariables: dependentArray,
					colours: coloursState,
					selectedRows,
				},
            });
			setSnack({ visible: true, text: "Metric updated" });
		} catch (error) {
			console.error("Error saving metric:", error);
			setSnack({ visible: true, text: "Failed to save metric" });
		} finally {
			setSaving(false);
		}
	};

	const graphDef = selectedMetric ? GraphTypes[selectedMetric] : null;

	const graphData = useMemo(() => {
		const base =
			selectedRows.length > 0 && dataSourceVariableNames.length > 0
				? dataSourceData.filter(r => selectedRows.includes(r[dataSourceVariableNames[0]]))
				: dataSourceData;
		return convertToGraphData(base);
	}, [dataSourceData, selectedRows, dataSourceVariableNames, chosenIndependentVariable, chosenDependentVariables]);


    useEffect(() => {
        setColoursState(prev => {
            const next = [...prev];
            while (next.length < dependentArray.length) next.push("#5f80c7ff"); // default
            return next.slice(0, dependentArray.length);
        });
    }, [dependentArray.length]);

    const onColourChange = useMemo (() => throttle((newColor) => {
        setColoursState(prev => {
            const next = [...prev];
            next[wheelIndex] = newColor;
            return next;
        });
    }, 50), [wheelIndex])

    const canSave =
        !!metricName.trim() &&
        !!selectedMetric &&
        !!dataSourceId &&
        !!chosenIndependentVariable &&
        Array.isArray(dependentArray) && dependentArray.length > 0 &&
        !saving;

	if (loadingSources || loadingMetric || dataDownloadStatus != "downloaded") {
		return (
			<ResponsiveScreen header={<Header title="Edit Metric" showBack />} center={false} padded={false} scroll={false}>
				<View style={styles.loaderWrap}>
					<ActivityIndicator size="large" />
				</View>
			</ResponsiveScreen>
		);
	}

	return (
		<ResponsiveScreen
            header={<Header
                title={"Edit Metric"}
                showBack
                showCheck={!saving && canSave}
                onRightIconPress={handleSave}
		    />}
            center={false} padded 
            tapToDismissKeyboard={false}
            loadingOverlayActive={saving}
        >
            <DropDown
                title="Data Source"
                items={
                    loadingSources
                        ? ["Loading..."]
                        : dataSourceMappings.map(dataSource => ({ value: dataSource.id, label: dataSource.name }))
                }
                onSelect={handleDataSourceSelect}
                value={dataSourceId}
            />

            <Button icon="file" mode="text" onPress={showDataModal}>
                View Data
            </Button>

            <DropDown
                title="Metric Type"
                items={Object.values(GraphTypes).map((g) => ({
                    value: g.value,
                    label: g.label
                }))}
                showRouterButton={false}
                onSelect={setSelectedMetric}
                value={selectedMetric}
            />

            <Text style={{ marginTop: 8 }}>Independent Variable (X-Axis)</Text>
            <MetricRadioButton
                items={dataSourceVariableNames}
                selected={chosenIndependentVariable}
                onChange={(x) => setChosenIndependentVariable(x)}
            />

            <Text style={{ marginTop: 12 }}>Dependent Variables (Y-Axis)</Text>
            {["bar", "pie"].includes(selectedMetric) ? (
                <MetricRadioButton
                    items={dataSourceVariableNames}
                    selected={
                        Array.isArray(chosenDependentVariables)
                            ? chosenDependentVariables[0]
                            : chosenDependentVariables
                    }
                    onChange={(sel) => setChosenDependentVariables(sel ? [sel] : [])}
                />
            ) : (
                <MetricCheckbox
                    items={dataSourceVariableNames}
                    selected={Array.isArray(chosenDependentVariables) ? chosenDependentVariables : []}
                    onChange={(sel) => setChosenDependentVariables(Array.isArray(sel) ? sel : sel ? [sel] : [])}
                />
            )}

            
            <View style={{paddingBottom: 20}}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text>Select Data Points (Optional)</Text>

                    <Chip
                        onPress={() => {
                            if (!dataSourceVariableNames.length) return;
                            const idKey = dataSourceVariableNames[0];
                            const allIds = dataSourceData.map(r => r[idKey]);
                            if (selectedRows.length === allIds.length) setSelectedRows([]);
                            else setSelectedRows(allIds);
                        }}
                        style={{ backgroundColor: theme.colors.background }}
                        textStyle={{ color: theme.colors.primary }}
                    >
                        {selectedRows.length === dataSourceData.length ? "Deselect All" : "Select All"}
                    </Chip>

                    <IconButton
                        icon={showChecklist ? "chevron-up" : "chevron-down"}
                        size={20}
                        onPress={() => setShowChecklist(!showChecklist)}
                    />
                </View>

                {showChecklist && dataSourceVariableNames.length > 0 && (
                    <MetricCheckbox
                        items={dataSourceData.map(row => row[dataSourceVariableNames[0]])}
                        selected={selectedRows}
                        onChange={setSelectedRows}
                    />
                )}
            </View>

            <TextField
                label="Metric Name"
                placeholder="Metric Name"
                value={metricName}
                onChangeText={setMetricName}
            />

            {graphDef && (
                <>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", marginVertical: 6 }}>
                        {dependentArray.map((variable, index) => (
                            <Chip
                                key={`${variable}-${index}`}
                                selected={wheelIndex === index}
                                onPress={() => setWheelIndex(index)}
                                style={{
                                    marginTop: 4,
                                    backgroundColor: wheelIndex === index ? theme.colors.primary : theme.colors.placeholder,
                                }}
                                showSelectedCheck={false}
                            >
                                {variable ?? `Y${index + 1}`}
                            </Chip>
                        ))}
                    </View>

                    {dependentArray.length > 0 && (
                        <View style={{ marginTop: 0, justifyContent: "center", flexDirection: "row" }}>
                            <View pointerEvents="box-none">
                            <ColorPicker
                                color={coloursState[wheelIndex] || '#ed1c24'}
                                onColorChange = {onColourChange}
                                thumbSize={30}
                                sliderSize={30}
                                noSnap
                                gapSize={10}
                                palette={[theme.colors.metricsPink, theme.colors.metricsOrange, theme.colors.metricsYellow, theme.colors.metricsLime, theme.colors.metricsGreen, theme.colors.metricsBlue, theme.colors.metricsPurple]}
                            />
                            </View>
                        </View>
                    )}

                    <Card style={[styles.card]}>
                        <Card.Content>
                            <View
                                style={styles.graphCardContainer}
                                pointerEvents="box-none"
                            >
                                {graphDef.render({
                                    data: graphData,
                                    xKey: chosenIndependentVariable,
                                    yKeys: dependentArray,
                                    colours: coloursState,
                                })}
                            </View>
                        </Card.Content>
                    </Card>
                </>
            )}

            <Portal>
                <Modal visible={dataVisible} onDismiss={hideDataModal} style={styles.modalContainer}>
                    <Card style={styles.modalCard}>
                        <Card.Content>
                            <ScrollView horizontal showsHorizontalScrollIndicator>
                                <View style={{ minWidth: (dataSourceVariableNames.length) * 100 }}>
                                    <DataTable>
                                        <DataTable.Header>
                                            {dataSourceVariableNames.map((variableName, index) => (
                                                <DataTable.Title key={index} numberOfLines={1}>
                                                    <Text>{String(variableName)}</Text>
                                                </DataTable.Title>
                                            ))}
                                        </DataTable.Header>
                                        <FlatList
                                            data={displayedRows}
                                            renderItem={({ item }) => (
                                                <DataTable.Row>
                                                    {dataSourceVariableNames.map((variableName, index) => (
                                                        <DataTable.Cell key={index} style={{ width: 100 }} numberOfLines={1}>
                                                            <Text>{String(item[variableName])}</Text>
                                                        </DataTable.Cell>
                                                    ))}
                                                </DataTable.Row>
                                            )}
                                            nestedScrollEnabled
                                            style={{ maxHeight: 180 }}
                                            initialNumToRender={5}
                                            windowSize={10}
                                            removeClippedSubviews
                                            onEndReached={onPreviewBottomReached}
                                            onEndReachedThreshold={0.1}
                                            ListFooterComponent={loadingMoreRows ? <ActivityIndicator size="small" /> : null}
                                        />
                                    </DataTable>
                                </View>
                            </ScrollView>
                        </Card.Content>
                    </Card>
                </Modal>
            </Portal>

			<Snackbar
				visible={snack.visible}
				onDismiss={() => setSnack(s => ({ ...s, visible: false }))}
				duration={2000}
				style={{ marginBottom: 8 }}
			>
				{snack.text}
			</Snackbar>
		</ResponsiveScreen>
	);
};

export default EditMetric;

const styles = StyleSheet.create({
	modalContainer: {
		flex: 1, justifyContent: "center", alignItems: "center", padding: 20,
	},
	modalCard: {
		width: "100%",
	},
	card: {
		height: 250, width: "100%", marginTop: 20,
	},
	graphCardContainer: {
		width: "100%", height: "100%",
	},
	loaderWrap: {
		flex: 1, justifyContent: "center", alignItems: "center",
	},
	button: {
		marginTop: 20,
	},
});