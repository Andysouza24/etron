import { View, StyleSheet, FlatList, ScrollView } from 'react-native';
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "expo-router";
import Header from '../../../../../../../components/layout/Header';
import { Text, Card, ActivityIndicator, DataTable, Modal, Portal, Button, Chip, useTheme, IconButton } from "react-native-paper";
import BasicButton from "../../../../../../../components/common/buttons/BasicButton";
import DropDown from '../../../../../../../components/common/input/DropDown';
import TextField from '../../../../../../../components/common/input/TextField';
import MetricCheckbox from '../../../../../../../components/common/buttons/MetricCheckbox';
import MetricRadioButton from '../../../../../../../components/common/buttons/MetricRadioButton';
import GraphTypes from '../graph-types';
import * as FileSystem from 'expo-file-system';
import { Storage } from 'aws-amplify';


import {
    fetchUserAttributes,
    getCurrentUser
} from 'aws-amplify/auth';
import { getWorkspaceId } from "../../../../../../../storage/workspaceStorage"
import endpoints from '../../../../../../../utils/api/endpoints';
import { apiGet, apiPost } from '../../../../../../../utils/api/apiClient';

import ColorPicker from 'react-native-wheel-color-picker';
import ResponsiveScreen from '../../../../../../../components/layout/ResponsiveScreen';
import { hasPermission } from '../../../../../../../utils/permissions';
import PermissionGate from '../../../../../../../components/common/PermissionGate';
import ViewShot, { captureRef } from 'react-native-view-shot';
import axios from 'axios';
import { useHasPermission } from '../../../../../../../hooks/useHasPermission';


const CreateMetric = () => {
    const router = useRouter();
    const theme = useTheme();
    const viewShotRef = useRef();

    const [loading, setLoading] = useState(false);
    const [dataSourceMappings, setDataSourceMappings] = useState([]);  //Array of data source id + name pairs
    const [loadingDataSourceMappings, setLoadingDataSourceMappings] = useState(true);  // Flag so that the program knows that the data is still being downloaded
    const { allowed: viewDataPermission } = useHasPermission("modules.daybook.datasources.view_data");

    useEffect(() => {  // When page loads, load a list of all data sources
        initialiseDataSourceList();
    }, []);

    async function initialiseDataSourceList() {
        const workspaceId = await getWorkspaceId();
        try {
            let dataSourcesFromApiResult = await apiGet(
                endpoints.modules.day_book.data_sources.getDataSources,
                { workspaceId }
            )
            let dataSourcesFromApi = dataSourcesFromApiResult.data;
            console.log(dataSourcesFromApi);
            setDataSourceMappings(dataSourcesFromApi.map(
                dataSource => ({
                    id: dataSource.dataSourceId,
                    name: dataSource.name
                })
            ));
            setLoadingDataSourceMappings(false);
        } catch (error) {
            console.error('Error retrieving ready data:', error);
            return;
        }
    }

    const [dataSourceId, setDataSourceId] = useState();  // Id of data source chosen by user
    const [dataSourceData, setDataSourceData] = useState([]);  // Data from the chosen data source
    const [dataSourceVariableNames, setDataSourceVariableNames] = useState([])
    const [dataSourceDataDownloadStatus, setDataSourceDataDownloadStatus] = useState("unstarted");  // Flag so the program knows the data is being *loaded* (not downloaded), the program has to put the data into variables

    const handleDataSourceSelect = async (source) => {  // When the user selects one of the data sources from the drop down, the program downloads that data
        console.log('Downloading ready data:', source);
        setDataSourceId(source);
        setDataSourceDataDownloadStatus("downloading");
        console.log("downloading");

        const workspaceId = await getWorkspaceId();
        try {
            let response = await apiGet(
                endpoints.modules.day_book.data_sources.viewData(source),
                { workspaceId }
            )
            let result = response.data;
            setDataSourceData(result.data);
            setDataSourceVariableNames(result.schema.map(variable => variable.name));
            setDataSourceDataDownloadStatus("downloaded");
            console.log("downloaded");
        } catch (error) {
            console.error("Error downloading data source's data:", error);
            setDataSourceDataDownloadStatus("unstarted");
        }
    }


    const [selectedMetric, setSelectedMetric] = useState(null);
    const [selectedReadyData, setSelectedReadyData] = useState(null);

    // This stuff is for the data preview that appears on the page
    const rowLoadAmount = 20;  // How many rows are loaded at a time in the data preview
    const [rowLimit, setRowLimit] = useState(rowLoadAmount);  // How many roads are loaded total (will update over time)
    const displayedRows = useMemo(() => dataSourceData.slice(0, rowLimit), [dataSourceData, rowLimit]);  // Loads only the data that will be displayed in the "view data" popup
    const [loadingMoreRows, setLoadingMoreRows] = useState(false);

    const onPreviewBottomReached = useCallback(() => {  // When the user scrolls to the bottom, loads more rows
        if (loadingMoreRows) return;
        if (rowLimit >= dataSourceData.length) return;

        setLoadingMoreRows(true);
        requestAnimationFrame(() => {
            setRowLimit((prev) => Math.min(prev + rowLoadAmount, dataSourceData.length));
            setLoadingMoreRows(false);
        });
    }, [dataSourceData.length, rowLimit]);

    function convertToGraphData(rows) {
        let output = rows.map(row => {
            const newRow = {};
            for (const [key, value] of Object.entries(row)) {
                const valueAsNumber = Number(value);
                newRow[key] = !isNaN(valueAsNumber) ? valueAsNumber : value  // If the value can be turned into a number, do so
            }
            return newRow;
        })
        return output;
    }


    const [step, setStep] = useState(0);
    const totalSteps = 2;

    const handleBack = () => {
        if (step === 0) {
            router.back();
        } else {
            setStep((prev) => prev - 1);
        }
    };

    const handleContinue = () => {
        setStep((prev) => prev + 1);
    };

    async function uploadMetricSettings() {
        console.log("Uploading metric details...");
        if (!metricName) {
            throw new Error("Metric is missing a name.")
        }

        let workspaceId = await getWorkspaceId();

        let metricDetails = {
            workspaceId,
            name: metricName,
            dataSourceId: dataSourceId,
            config: {
                type: selectedMetric,
                //data: dataSourceData,  // TODO: implement separate function using an endpoint to upload the pruned data to S3
                independentVariable: chosenIndependentVariable,
                dependentVariables: chosenDependentVariables,
                colours: coloursState,
                selectedRows: selectedRows,
            },
            user: {
                userId,
                firstName,
                lastName
            }
        }
        let result = await apiPost(
            endpoints.modules.day_book.metrics.add,
            metricDetails
        );

        const graphImageKey = await uploadGraphToS3(result.data.metricId, result.data.fileUploadUrl);
        console.log("Uploaded metric details via API result:", result);
    }

    const [userId, setUserId] = useState(null);
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");

    useEffect(() => {
        async function loadUser() {
            try {
                const { userId } = await getCurrentUser();
                const attributes = await fetchUserAttributes();
                setUserId(userId);
                setFirstName(attributes.given_name || "");
                setLastName(attributes.family_name || "");
                console.log("Loaded user info:", userId, attributes);
            } catch (error) {
                console.error("Error fetching user info:", error);
            }
        }
        loadUser();
    }, []);

    const handleFinish = async () => {
        setLoading(true);
        try { await uploadMetricSettings() } catch (error) {
            console.log("Error uploading metric settings:", error);
            return;
        } finally {
            setLoading(false);
        }

        console.log("Form completed");
        router.navigate("/modules/day-book/metrics"); 
    }

    const [dataVisible, setDataVisible] = React.useState(false);
    const showDataModal = () => {setDataVisible(true)};
    const hideDataModal = () => setDataVisible(false);

    const [showChecklist, setShowChecklist] = useState(false);

    const [chosenIndependentVariable, setChosenIndependentVariable] = useState([]);
    const [chosenDependentVariables, setChosenDependentVariables] = useState([]);
    const [coloursState, setColoursState] = useState([theme.colors.metricsPink, theme.colors.metricsOrange, theme.colors.metricsYellow, theme.colors.metricsLime, theme.colors.metricsGreen, theme.colors.metricsBlue, theme.colors.metricsPurple]);
    const [wheelIndex, setWheelIndex] = useState(0);
    const [metricName, setMetricName] = useState('');
    const [selectedRows, setSelectedRows] = useState([]);

    const dependentArray = Array.isArray(chosenDependentVariables)
        ? chosenDependentVariables
        : chosenDependentVariables
            ? [chosenDependentVariables]
            : [];

    const formContinueDisabled =
        (step == 0 && (chosenIndependentVariable.length == 0 || !selectedMetric)) ||
        (step == 1 && (!metricName))


async function uploadGraphToS3(metricId, fileUploadUrl) {
  try {
    // Capture as a temporary file
    const tmpUri = await viewShotRef.current.capture({
      format: "png",
      quality: 1.0,
      result: "tmpfile",
    });

    // Read file as binary
    const fileBinary = await FileSystem.readAsStringAsync(tmpUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Convert Base64 to ArrayBuffer
    const arrayBuffer = Buffer.from(fileBinary, "base64");

    // Upload to S3
    const response = await fetch(fileUploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "image/png" },
      body: arrayBuffer,
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
    }

    console.log("✅ Graph uploaded successfully");
  } catch (error) {
    console.error("❌ Error uploading graph to S3:", error);
    //throw error;
  }
}


    const renderFormStep = () => {
        switch (step) {
            case 0:
                return (
                    <ScrollView
                        nestedScrollEnabled
                    >
                        <DropDown
                            title = "Select Data Source"
                            items = {loadingDataSourceMappings ? ["Loading..."] : dataSourceMappings.map(dataSource => ({value: dataSource.id, label: dataSource.name}))}
                            onSelect={(item) => {
                                handleDataSourceSelect(item);
                                setSelectedReadyData(item);
                            }}
                            value = {selectedReadyData}
                        />

                        {dataSourceDataDownloadStatus == "unstarted" && (
                            <Text>No data source selected</Text>
                        )}
                        {dataSourceDataDownloadStatus == "downloading" && (
                            <ActivityIndicator size="large"/>
                        )}
                        {dataSourceDataDownloadStatus == "downloaded" && (<>
                            <PermissionGate
                                allowed={viewDataPermission}
                            >
                                <Button icon="file" mode="text" onPress={showDataModal}>
                                    View Data
                                </Button>
                            </PermissionGate>

                            <DropDown
                                title = "Select Metric"
                                items={Object.values(GraphTypes).map((g) => ({
                                    value: g.value,
                                    label: g.label,
                                }))}
                                showRouterButton={false}
                                onSelect={(item) => setSelectedMetric(item)}
                                value={selectedMetric}
                            />

                            <Text>Select Independent Variable (X-Axis)</Text>
                            <MetricRadioButton
                                items={dataSourceVariableNames}
                                selected={chosenIndependentVariable}
                                onChange={(selection) => {
                                    setChosenIndependentVariable(selection);
                                }}
                            />

                            <Text style={{ marginTop: 12 }}>Select Dependent Variables (Y-Axis)</Text>
                            {["bar", "pie"].includes(selectedMetric) ? (
                                <MetricRadioButton
                                    items={dataSourceVariableNames}
                                    selected={Array.isArray(chosenDependentVariables) ? chosenDependentVariables[0] : chosenDependentVariables}
                                    onChange={(selection) => {
                                        const next = selection ? [selection] : [];
                                        setChosenDependentVariables(next);
                                    }}
                                />
                            ) : (
                                <MetricCheckbox
                                    items={dataSourceVariableNames}
                                    selected={Array.isArray(chosenDependentVariables) ? chosenDependentVariables : []}
                                    onChange={(selection) => {
                                        const next = Array.isArray(selection) ? selection : selection ? [selection] : [];
                                        setChosenDependentVariables(next);
                                    }}
                                />
                            )}

                            {/* Row Selection */}
                            <View 
                                style={{ 
                                    flexDirection: "row", 
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    marginBottom: -7
                                }}
                            >
                                <Text>Select Data Points (Optional)</Text>
                                
                                <Chip
                                    onPress={() => {
                                        const rowIds = dataSourceData.map((row) => row[dataSourceVariableNames[0]]);
                                        if (selectedRows.length === rowIds.length) {
                                            setSelectedRows([]);
                                        } else {
                                            setSelectedRows(rowIds);
                                        }
                                    }}
                                    style={{
                                        backgroundColor: theme.colors.background,
                                    }}
                                    textStyle={{
                                        color: theme.colors.primary
                                    }}
                                >
                                    {selectedRows.length === dataSourceData.length ? "Deselect All" : "Select All"}
                                </Chip>

                                <IconButton
                                    icon={showChecklist ? "chevron-up" : "chevron-down"}
                                    size={20}
                                    onPress={() => setShowChecklist(!showChecklist)}
                                />
                            </View>

                            {showChecklist && (
                                <MetricCheckbox
                                    items={dataSourceData.map((row) => row[dataSourceVariableNames[0]])}
                                    selected={selectedRows}
                                    onChange={(selection) => setSelectedRows(selection)}
                                />
                            )}
                                                    
                            <Portal>
                                <Modal 
                                    visible={dataVisible} 
                                    onDismiss={hideDataModal} 
                                    style={styles.modalContainer}
                                >
                                    <Card style={styles.card}>
                                        <Card.Content>
                                            <ScrollView horizontal showsHorizontalScrollIndicator >
                                                <View style={{ minWidth: (dataSourceVariableNames.length) * 100 }}>
                                                    <DataTable>{/* Displays a preview of the data as a table */} 
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
                                                            nestedScrollEnabled={true}
                                                            style={{ maxHeight: 180 /*shouldn't be hardcoded*/}}
                                                            initialNumToRender={5}
                                                            windowSize={10}
                                                            removeClippedSubviews={true}
                                                            onEndReached={onPreviewBottomReached}
                                                            onEndReachedThreshold={0.1} 
                                                            ListFooterComponent={
                                                                loadingMoreRows ? (
                                                                    <ActivityIndicator size="small" color="#0000ff" />
                                                                ) : null
                                                            }
                                                        />
                                                    </DataTable>
                                                </View>
                                            </ScrollView>
                                        </Card.Content>
                                    </Card>
                                </Modal>
                            </Portal>
                        </>)}
                    </ScrollView>
                )
            case 1:
                const graphDef = GraphTypes[selectedMetric]; // Get chosen graph definition
                if (!graphDef) {
                    return <Text>Please select a metric to preview</Text>;
                }

                const handleColorChange = (color) => {
                    setSelectedColor(color);
                    // For now, replace the first colour (or you could extend this to pick which line to recolor)
                    const updated = [...coloursState];
                    updated[0] = color;
                    setColoursState(updated);
                };

                const filteredRows = dataSourceVariableNames.filter(
                    (row) => selectedRows.includes(row[0]) // assumes first column is "Name"
                );

                return (
                    <ScrollView>
                        <TextField
                            label="Metric Name"
                            placeholder="Metric Name"
                            onChangeText={setMetricName}
                            value={metricName}
                        />
                        
                        {/* Variable selector chips */}
                        <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", marginVertical: 5 }}>
                            {dependentArray.map((variable, index) => (
                                <Chip
                                    key={index}
                                    selected={wheelIndex === index}
                                    onPress={() => setWheelIndex(index)}
                                    style={{ 
                                        marginTop: 4,
                                        backgroundColor: wheelIndex === index ? theme.colors.primary : theme.colors.placeholder,
                                    }}
                                    showSelectedCheck = {false}
                                >
                                    {variable ?? `Y${index + 1}`}
                                </Chip>
                            ))}
                        </View>
                        
                        {/* Single colour picker for the active variable */}
                        <View style={{ marginTop: 0, justifyContent: "center", flexDirection: "row" }}>
                            <ColorPicker
                                color={coloursState[wheelIndex]}
                                onColorChange={(newColor) => {
                                    setColoursState((prev) => {
                                        const updated = [...prev];
                                        updated[wheelIndex] = newColor;
                                        return updated;
                                    });
                                }}
                                thumbSize={30}
                                sliderSize={30}
                                noSnap={true}
                                gapSize={10}
                                palette={['#000000','#ed1c24','#d11cd5','#5f80c7ff','#57ff0a','#ffde17','#f26522','#ffffffff']}
                            />
                        </View>
                        
                        {/* Graph preview */}
                        <Card style={[styles.card]}>
                            <Card.Content>
                                <ViewShot
                                    ref={viewShotRef}
                                    options={{format: "png", quality: 1.0, result: "tmpfile"}}
                                >
                                    <View style={styles.graphCardContainer}>
                                        {graphDef.render({
                                            data: convertToGraphData(
                                                selectedRows.length > 0
                                                    ? dataSourceData.filter(
                                                        (row) => selectedRows.includes(row[dataSourceVariableNames[0]])
                                                    )
                                                    : dataSourceData
                                            ),
                                            xKey: chosenIndependentVariable,
                                            yKeys: dependentArray,
                                            colours: coloursState,
                                        })}
                                    </View>
                                </ViewShot>
                             
                            </Card.Content>
                        </Card>

                        
                    </ScrollView>
                )
            default:
                return null;
        }
        
    };

    return (
		<ResponsiveScreen
			header={<Header title="New Metric" showBack onBackPress={handleBack} />}
			center={false}
			padded
            scroll={true}
            loadingOverlayActive={loading}
		>
            <View style={styles.content}>
                {renderFormStep()}

                <View alignItems={'flex-end'}>
                    <BasicButton
                        label={step < totalSteps - 1 ? "Continue" : "Finish"}
                        onPress={step < totalSteps - 1 ? handleContinue : handleFinish}
                        disabled={formContinueDisabled}
                        style={styles.button}
                    />
                </View>
            </View>    
        </ResponsiveScreen>
    )
}

export default CreateMetric;

const styles = StyleSheet.create({
    modalContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
    },
    card: {
        height: 250,
        width: "100%",
        marginTop: 20,
    },
    graphCardContainer: {
        width: "100%",
        height: "100%",
    },
    container: {
        flex: 1,
    },
    content: {
        flex: 1,
        paddingHorizontal: 24,
    },
    text: {
        fontSize: 20,
        textAlign: "center",
        marginBottom: 20,
    },
    button: {
        marginTop: 20,
    },
});