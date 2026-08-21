// posts `notifyDataSourceUpdate` mutation
// subscription delivers data source create/update/delete events to all clients in the workspace so other devices/users see changes in real time
// `action` is one of "CREATE" | "UPDATE" | "DELETE" (mirrors the Boards/Metrics pattern). status/progress-only broadcasts may omit it.
const NOTIFY_DATA_SOURCE_UPDATE_MUTATION = `
    mutation NotifyDataSourceUpdate(
        $workspaceId: ID!,
        $dataSourceId: ID!,
        $name: String,
        $sourceType: String,
        $status: String,
        $method: String,
        $metrics: [ID!],
        $associatedMetrics: [ID!],
        $config: AWSJSON,
        $error: String,
        $lastUpdate: AWSDateTime,
        $expiry: AWSDateTime,
        $createdAt: AWSDateTime,
        $updatedAt: AWSDateTime,
        $createdBy: ID,
        $progressStage: String,
        $progressPercent: Int,
        $action: String
    ) {
        notifyDataSourceUpdate(
            workspaceId: $workspaceId,
            dataSourceId: $dataSourceId,
            name: $name,
            sourceType: $sourceType,
            status: $status,
            method: $method,
            metrics: $metrics,
            associatedMetrics: $associatedMetrics,
            config: $config,
            error: $error,
            lastUpdate: $lastUpdate,
            expiry: $expiry,
            createdAt: $createdAt,
            updatedAt: $updatedAt,
            createdBy: $createdBy,
            progressStage: $progressStage,
            progressPercent: $progressPercent,
            action: $action
        ) {
            workspaceId
            dataSourceId
            name
            sourceType
            status
            method
            metrics
            associatedMetrics
            config
            error
            lastUpdate
            expiry
            createdAt
            updatedAt
            createdBy
            progressStage
            progressPercent
            action
        }
    }
`;

function buildVariables(dataSource, action) {
    return {
        workspaceId: dataSource.workspaceId,
        dataSourceId: dataSource.dataSourceId,
        name: dataSource.name ?? null,
        sourceType: dataSource.sourceType ?? null,
        status: dataSource.status ?? null,
        method: dataSource.method ?? null,
        metrics: dataSource.metrics ?? null,
        associatedMetrics: dataSource.associatedMetrics ?? null,
        config: dataSource.config ? JSON.stringify(dataSource.config) : null,
        error: dataSource.errorMessage ?? dataSource.error ?? null,
        lastUpdate: dataSource.lastUpdate ?? null,
        expiry: dataSource.expiry ?? null,
        createdAt: dataSource.createdAt ?? null,
        updatedAt: dataSource.updatedAt ?? null,
        createdBy: dataSource.createdBy ?? null,
        progressStage: dataSource.progressStage ?? null,
        progressPercent: typeof dataSource.progressPercent === "number" ? dataSource.progressPercent : null,
        action: action ?? null,
    };
}

async function notifyDataSourceUpdate(dataSource, action) {
    if (!dataSource || !dataSource.workspaceId || !dataSource.dataSourceId) return;

    const url = process.env.APP_SYNC_URL || process.env.APPSYNC_URL;
    const apiKey = process.env.APP_SYNC_API_KEY || process.env.APPSYNC_API_KEY;
    if (!url || !apiKey) {
        console.warn("[notifyDataSourceUpdate] AppSync env vars not configured; skipping broadcast");
        return;
    }

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": apiKey,
            },
            body: JSON.stringify({
                query: NOTIFY_DATA_SOURCE_UPDATE_MUTATION,
                variables: buildVariables(dataSource, action),
            }),
        });
        if (!response.ok) {
            const text = await response.text();
            console.warn(
                `[notifyDataSourceUpdate] AppSync returned ${response.status} for ${dataSource.workspaceId}/${dataSource.dataSourceId}: ${text}`
            );
        }
    } catch (error) {
        console.warn(
            `[notifyDataSourceUpdate] Failed to broadcast for ${dataSource.workspaceId}/${dataSource.dataSourceId}: ${error.message}`
        );
    }
}

module.exports = {
    notifyDataSourceUpdate,
};
