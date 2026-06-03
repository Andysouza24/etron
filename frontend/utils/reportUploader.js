// Authors: Rhys Cleary

import { Alert } from "react-native";
import RNFS from "react-native-fs";
import { apiPatch, apiPost } from "./api/apiClient";
import endpoints from "./api/endpoints";
import axios from "axios";

async function uploadReportToS3(filePath, fileUploadUrl) {
    try {
        const fileBlob = await RNFS.readFile(filePath, "utf8");
        const response = await axios.put(fileUploadUrl, fileBlob, {
            headers: {
                "Content-Type": "text/html"
            },
        });

        if (response.status >= 200 && response.status < 300) {
            console.log("File uploaded successfully to S3");
            return true;
        } else {
            console.error(`Upload to S3 failed with response status: ${response.status}`);
            return false;
        }
    } catch (error) {
        console.error("Failed to upload file:", error);
        return false;
    }
}

// Update an existing report
export async function uploadUpdatedReport({
    workspaceId,
    reportId,
    reportName,
    editorContent
}) {
    if (!workspaceId || !reportId) {
        Alert.alert("Error", "Missing workspace or report Id.");
        console.log("Workspace Id or report Id missing");
        return;
    }

    const trimmedFileName = reportName.trim() || "Report";
    const filePath = `${RNFS.CachesDirectoryPath}/${trimmedFileName}.html`;

    // write editor content to local file store
    try {
        await RNFS.writeFile(filePath, editorContent || "<p>No content</p>", "utf8");
        console.log("Local HTML file written at:", filePath);
    } catch (error) {
        console.error("Failed to write local file:", error);
        Alert.alert("Error", "Could not save local file");
        return;
    }

    // Update data and get upload URL
    let fileUploadUrl;
    try {
        const updateResult = await apiPatch(
            endpoints.modules.day_book.reports.drafts.updateDraft(reportId), 
            {
                workspaceId,
                name: trimmedFileName,
                isFileUpdated: true
            }
        );

        console.log(updateResult.data);

        fileUploadUrl = updateResult.data.fileUploadUrl;

        if (!fileUploadUrl) {
            console.error("No fileUploadUrl returned from the API");
            return;
        }

    } catch (error) {
        console.error("Failed to get upload URL:", error);
        Alert.alert("Error", "Could not get upload URL from server");
        return;
    }

    return uploadReportToS3(filePath, fileUploadUrl);
}


// Create a new report
export async function createNewReport({
    workspaceId,
    reportName
}) {
    if (!workspaceId) {
        Alert.alert("Error", "Missing workspace Id.");
        console.log("Workspace Id missing");
        return;
    }

    const trimmedFileName = reportName.trim() || "Report";
    const filePath = `${RNFS.CachesDirectoryPath}/${trimmedFileName}.html`;

    // write editor content to local file store
    try {
        await RNFS.writeFile(filePath, "<p></p>", "utf8");
        console.log("Local HTML file written at:", filePath);
    } catch (error) {
        console.error("Failed to write local file:", error);
        Alert.alert("Error", "Could not save local file");
        return;
    }

    // Update data and get upload URL
    let fileUploadUrl, newReportId;
    try {
        const createResult = await apiPost(
            endpoints.modules.day_book.reports.drafts.createDraft, 
            {
                workspaceId,
                name: trimmedFileName
            }
        );
        console.log(createResult);

        fileUploadUrl = createResult.data.fileUploadUrl;
        newReportId = createResult.data.draftId || createResult.data.templateId;

        if (!fileUploadUrl || !newReportId) {
            console.error("Invalid create response");
            return;
        }

    } catch (error) {
        console.error("Failed to get upload URL:", error);
        Alert.alert("Error", "Could not get upload URL from server");
        return;
    }

    const uploaded = await uploadReportToS3(filePath, fileUploadUrl);

    return uploaded ? newReportId : null;
}