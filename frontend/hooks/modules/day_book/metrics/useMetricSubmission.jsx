import { fetchUserAttributes, getCurrentUser } from "aws-amplify/auth";
import { useEffect, useRef, useState } from "react";
import { getWorkspaceId } from "../../../../storage/workspaceStorage";
import metricService from "../../../../services/MetricService";
import { EncodingType, readAsStringAsync } from "expo-file-system";


export default function useMetricSubmission() {
    const [userId, setUserId] = useState(null);
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const viewShotRef = useRef();

    useEffect(() => {
        (async () => {
            try {
                const { userId } = await getCurrentUser();
                const attributes = await fetchUserAttributes();
                setUserId(userId);
                setFirstName(attributes.given_name || "");
                setLastName(attributes.family_name || "");
            } catch (err) {
                console.error("[useMetricSubmission] Error fetching user: ", err);
            }
        }) ();
    }, []);


    const submitMetric = async ({ metricName, metricType, dataSourceId, config }) => {
        if (!metricName) throw new Error("Metric is missing a name");

        const workspaceId = await getWorkspaceId();

        const payload = {
            workspaceId,
            name: metricName,
            type: metricType,
            dataSourceId,
            config,
            user: { userId, firstName, lastName },
        };

        const result = await metricService.createMetric(payload);

        // TODO: get upload/download URLs from metric service
        /*// upload graph snapshot if viewShotRef attached
        if (viewShotRef.current && result?.data?.fileUploadUrl) {
            await uploadGraphToS3(result.data.fileUploadUrl);
        }*/

        return result;
    };

    const uploadGraphToS3 = async (fileUploadUrl) => {
        try {
            const tempUri = await viewShotRef.current.capture({
                format: "png",
                quality: 1.0,
                result: "tmpfile",
            });
            const fileBinary = await readAsStringAsync(tempUri, {
                encoding: EncodingType.Base64,
            });
            const arrayBuffer = Buffer.from(fileBinary, "base64");
            const response = await metricService.uploadGraphToS3(arrayBuffer);

            if (!response.ok) {
                throw new Error(`[useMetricSubmission] Failed to upload graph snapshot: ${response.status} ${response.statusText}`);
            }
            console.log("[useMetricSubmission] Graph snapshot uploaded successfully");
        } catch (err) {
            console.error("[useMetricSubmission] Error uploading graph snapshot: ", err);
        }
    };
    
    return { submitMetric, viewShotRef };
}