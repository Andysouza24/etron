// Author(s): Rhys Cleary

const dataSourceRepo = require("@etron/day-book-shared/repositories/dataSourceRepository");
const axios = require("axios");

exports.handler = async (event) => {
    const bucket = event.detail.bucket.name;
    const key = decodeURIComponent(event.detail.object.key.replace(/\+/g, " "));

    if (bucket !== process.env.WORKSPACE_BUCKET) return;

    const components = key.split("/");
    const [workspaceSegment, workspaceId, , , dataSourceId] = components;

    if (workspaceSegment !== "workspaces" || !workspaceId || !dataSourceId) {
        console.warn("Unexpected S3 key or missing IDs:", key);
        return;
    }

    let metrics = [];
    try {
        const dataSource = await dataSourceRepo.getDataSourceById(workspaceId, dataSourceId);
        metrics = dataSource.metrics;
    } catch (error) {
        console.error("Failed to fetch data source:", error.message);
        return; // skip if metrics can't be fetched
    }

        // skip if no metrics exist
    if (!metrics || metrics.length === 0) return;

    // appsync mutation
    const mutation = `
        mutation NotifyDataUpdate(
            $workspaceId: ID!, 
            $dataSourceId: ID!, 
            $metrics: [ID!]
        ) {
            notifyDataUpdate(
                workspaceId: $workspaceId, 
                dataSourceId: $dataSourceId, 
                metrics: $metrics
            ) {
                workspaceId,
                dataSourceId,
                metrics
            }
        }
    `;

    const variables = { workspaceId, dataSourceId, metrics };

    try {
        await axios.post(
            process.env.APPSYNC_URL,
            { query: mutation, variables },
            {
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": process.env.APPSYNC_API_KEY
                }
            }
        );
    } catch (error) {
        console.error("Unable to send mutation:", error.message);
    }
};