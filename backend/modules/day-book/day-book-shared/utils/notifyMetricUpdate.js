// posts `notifyMetricUpdate` mutation
// subscription delivers metric create/update/delete events to all clients in the workspace so other devices/users see changes in real time
// `action` is one of "CREATE" | "UPDATE" | "DELETE" (mirrors the Boards pattern)
const NOTIFY_METRIC_UPDATE_MUTATION = `
    mutation NotifyMetricUpdate(
        $workspaceId: ID!,
        $metricId: ID!,
        $name: String,
        $dataSourceId: ID,
        $activeDataSource: Boolean,
        $metricType: String,
        $config: AWSJSON,
        $sourceMetrics: [ID],
        $calculation: AWSJSON,
        $aggregationMethod: String,
        $trendDirection: String,
        $thumbnailKey: String,
        $createdAt: AWSDateTime,
        $updatedAt: AWSDateTime,
        $createdBy: ID,
        $action: String
    ) {
        notifyMetricUpdate(
            workspaceId: $workspaceId,
            metricId: $metricId,
            name: $name,
            dataSourceId: $dataSourceId,
            activeDataSource: $activeDataSource,
            metricType: $metricType,
            config: $config,
            sourceMetrics: $sourceMetrics,
            calculation: $calculation,
            aggregationMethod: $aggregationMethod,
            trendDirection: $trendDirection,
            thumbnailKey: $thumbnailKey,
            createdAt: $createdAt,
            updatedAt: $updatedAt,
            createdBy: $createdBy,
            action: $action
        ) {
            workspaceId
            metricId
            name
            dataSourceId
            activeDataSource
            metricType
            config
            sourceMetrics
            calculation
            aggregationMethod
            trendDirection
            thumbnailKey
            createdAt
            updatedAt
            createdBy
            action
        }
    }
`;

function buildVariables(metric, action) {
    return {
        workspaceId: metric.workspaceId,
        metricId: metric.metricId,
        name: metric.name ?? null,
        dataSourceId: metric.dataSourceId ?? null,
        activeDataSource:
            typeof metric.activeDataSource === "boolean" ? metric.activeDataSource : null,
        metricType: metric.metricType ?? null,
        config: metric.config != null ? JSON.stringify(metric.config) : null,
        sourceMetrics: Array.isArray(metric.sourceMetrics) ? metric.sourceMetrics : null,
        calculation: metric.calculation != null ? JSON.stringify(metric.calculation) : null,
        aggregationMethod: metric.aggregationMethod ?? null,
        trendDirection: metric.trendDirection ?? null,
        thumbnailKey: metric.thumbnailKey ?? null,
        createdAt: metric.createdAt ?? null,
        updatedAt: metric.updatedAt ?? null,
        createdBy: metric.createdBy ?? null,
        action: action ?? null,
    };
}

async function notifyMetricUpdate(metric, action) {
    if (!metric || !metric.workspaceId || !metric.metricId) return;

    const url = process.env.APP_SYNC_URL || process.env.APPSYNC_URL;
    const apiKey = process.env.APP_SYNC_API_KEY || process.env.APPSYNC_API_KEY;
    if (!url || !apiKey) {
        console.warn("[notifyMetricUpdate] AppSync env vars not configured; skipping broadcast");
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
                query: NOTIFY_METRIC_UPDATE_MUTATION,
                variables: buildVariables(metric, action),
            }),
        });
        if (!response.ok) {
            const text = await response.text();
            console.warn(
                `[notifyMetricUpdate] AppSync returned ${response.status} for ${metric.workspaceId}/${metric.metricId}: ${text}`
            );
        }
    } catch (error) {
        console.warn(
            `[notifyMetricUpdate] Failed to broadcast for ${metric.workspaceId}/${metric.metricId}: ${error.message}`
        );
    }
}

module.exports = {
    notifyMetricUpdate,
};
