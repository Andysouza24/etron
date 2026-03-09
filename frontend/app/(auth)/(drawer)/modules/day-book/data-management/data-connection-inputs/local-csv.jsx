// Author(s): Noah Bradley

import { ActivityIndicator, Text } from 'react-native-paper';
import { useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { View } from 'react-native';
import { getWorkspaceId } from "../../../../../../../storage/workspaceStorage";
import TextField from '../../../../../../../components/common/input/TextField';
import { RadioButton } from 'react-native-paper';
import { apiPost } from "../../../../../../../utils/api/apiClient";
import endpoints from "../../../../../../../utils/api/endpoints"
import { router } from 'expo-router';
import ResponsiveScreen from '../../../../../../../components/layout/ResponsiveScreen';
import Header from '../../../../../../../components/layout/Header';
import FieldCategoryReview from '../../../../../../../components/modules/day-book/data-sources/FieldCategoryReview';
import BasicButton from '../../../../../../../components/common/buttons/BasicButton';

const LocalCSV = () => {
    const [deviceFilePath, setDeviceFilePath] = useState(null);
    const [rawCsvText, setRawCsvText] = useState(null);
    const [dataDetailsStatus, setDataDetailsStatus] = useState("unstarted");
    const [loading, setLoading] = useState(false);

    // Schema review state
    const [schemaPreview, setSchemaPreview] = useState(null);
    const [confirmedSchema, setConfirmedSchema] = useState(null);
    const [schemaStep, setSchemaStep] = useState(false);

    const userSelectFile = async () => {
        try {
            setDataDetailsStatus("loading");
            const result = await DocumentPicker.getDocumentAsync({
                type: ['text/csv', 'application/vnd.ms-excel', 'application/csv', 'text/comma-separated-values'],
                copyToCacheDirectory: true  // This might be bad for large files
            });

            if (result.canceled) {
                console.log('File selection cancelled');
                setDataDetailsStatus("unstarted");
                return;
            }
            
            const file = result.assets[0];  // [0] means it only keeps the first file, as result will be an array of files
            setDeviceFilePath(file.uri);

            // Read the CSV content for schema preview
            try {
                const textResponse = await fetch(file.uri);
                const text = await textResponse.text();
                setRawCsvText(text);
            } catch (err) {
                console.warn("Could not read CSV text for preview:", err);
                setRawCsvText(null);
            }

            setDataDetailsStatus("loaded");
        } catch (error) {
            setDataDetailsStatus("unstarted");
            console.error('Error picking file:', error);
        }
    };

    const [isUploadingData, setIsUploadingData] = useState(false);

    const handlePreviewSchema = async () => {
        setLoading(true);
        try {
            const workspaceId = await getWorkspaceId();

            const result = await apiPost(
                endpoints.modules.day_book.data_sources.previewSchema,
                { workspaceId, rawData: rawCsvText }
            );

            const preview = result.data;
            setSchemaPreview(preview);
            setConfirmedSchema(preview.schema);
            setSchemaStep(true);
        } catch (error) {
            console.error("Error previewing schema:", error);
            alert("Failed to preview field types: " + (error.message || error));
        } finally {
            setLoading(false);
        }
    };

    const handleSchemaChange = (updatedSchema) => {
        setConfirmedSchema(updatedSchema);
    };

    const handleBackToDetails = () => {
        setSchemaStep(false);
        setSchemaPreview(null);
        setConfirmedSchema(null);
    };

    const handleFinalise = async () => {
        setLoading(true);
        try {
            const workspaceId = await getWorkspaceId();

            // Step 1: Create the data source record
            let dataSourceDetails = {
                workspaceId: workspaceId,
                name: dataSourceName,            
                sourceType: "local-csv",
                method: method
            };

            const createResult = await apiPost(
                endpoints.modules.day_book.data_sources.addLocal,
                dataSourceDetails
            );

            const createResponse = createResult.data;
            if (!createResponse) {
                throw new Error("No response from API.");
            }

            const dataSourceId = createResponse.dataSourceId;

            // Confirm schema and process the data via the new endpoint
            await apiPost(
                endpoints.modules.day_book.data_sources.confirmSchema(dataSourceId),
                {
                    workspaceId,
                    confirmedSchema: confirmedSchema,
                    rawData: rawCsvText
                }
            );

            router.navigate("modules/day-book/data-management");
        } catch (error) {
            console.error("Error finalising CSV upload:", error);
            alert("Failed to create data source: " + (error.message || error));
        } finally {
            setLoading(false);
        }
    };
    
    const [method, setMethod] = useState('overwrite');
    const [dataSourceName, setDataSourceName] = useState("");

    return (
        <>
            <ResponsiveScreen
                header = {<Header title="Upload CSV" showBack />}
                scroll = {true}
                center = {false}
                loadingOverlayActive={loading || isUploadingData}
            >
                {!schemaStep ? (
                    <>
                        <BasicButton fullWidth onPress={userSelectFile} label="Pick a CSV File" disabled={isUploadingData} />
                    
                        {dataDetailsStatus == "none" && (
                            <Text>No data selected</Text>
                        )}
                        {dataDetailsStatus == "loading" && (
                            <ActivityIndicator />
                        )}
                        {dataDetailsStatus == "loaded" && (
                            <View>
                                <TextField 
                                    label = "Source Name"
                                    placeholder = "Source Name"
                                    onChangeText = {setDataSourceName}
                                />
                                <RadioButton.Group onValueChange={newValue => setMethod(newValue)} value={method}>
                                    <RadioButton.Item label="Overwrite" value="overwrite" />
                                    <RadioButton.Item label="Extend" value="extend" />
                                </RadioButton.Group>
                                <BasicButton
                                    fullWidth
                                    onPress={handlePreviewSchema}
                                    label="Review Fields"
                                    disabled={isUploadingData || dataSourceName == "" || !rawCsvText}
                                />
                            </View>
                        )}
                    </>
                ) : (
                    <View>
                        <FieldCategoryReview
                            schema={schemaPreview.schema}
                            onChange={handleSchemaChange}
                            sampleData={schemaPreview.sampleData}
                        />
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, gap: 8 }}>
                            <BasicButton onPress={handleBackToDetails} label="Back" />
                            <BasicButton onPress={handleFinalise} label="Create Source" disabled={loading} />
                        </View>
                    </View>
                )}
            </ResponsiveScreen>
            
        </>
    );
}

export default LocalCSV;