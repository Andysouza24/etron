// Author(s): Rhys Cleary, Holly Wyatt

const dataSourceRepo = require("@etron/day-book-shared/repositories/dataSourceRepository");
const { notifyDataSourceUpdate } = require("@etron/day-book-shared/utils/notifyDataSourceUpdate");
const axios = require("axios");

const APPSYNC_HEADERS = {
    "Content-Type": "application/json",
    "x-api-key": process.env.APPSYNC_API_KEY,
};

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

    let dataSource;
    try {
        dataSource = await dataSourceRepo.getDataSourceById(workspaceId, dataSourceId);
    } catch (error) {
        console.error("Failed to fetch data source:", error.message);
        return; // skip if data source can't be fetched
    }

    if (!dataSource) {
        console.warn(`Data source ${workspaceId}/${dataSourceId} no longer exists; skipping notifications.`);
        return;
    }

    // Always broadcast the data source row so the frontend list reflects
    // status/progress changes (incl. new dashboard children appearing).
    await notifyDataSourceUpdate(dataSource);

    const metrics = dataSource.metrics;

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
            { headers: APPSYNC_HEADERS }
        );
    } catch (error) {
        console.error("Unable to send mutation:", error.message);
    }
};