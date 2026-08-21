const {
    resolveCreateTargets,
    resolveDeleteTargets,
    enqueueTransformJob,
    deleteChildDataSource,
} = require("./dashboardRawDataIngestService");

// triggered by EventBridge for both "Object Created" and "Object Deleted"
// created uploads are materialised as `micromax-dashboard-file` data sources and queued for transform
// deletions tear down the matching child data sources and their stored data
exports.handler = async (event) => {
    const detailType = event?.["detail-type"];
    const bucket = event?.detail?.bucket?.name;
    const rawKey = event?.detail?.object?.key;
    const key = rawKey ? decodeURIComponent(rawKey.replace(/\+/g, " ")) : null;

    if (!bucket || !key) {
        console.warn("[MicromaxDashboardIngest] Missing bucket/key in event", JSON.stringify(event));
        return { statusCode: 400, body: "Invalid event" };
    }

    if (bucket !== process.env.DASHBOARD_RAW_DATA_BUCKET) {
        console.log(`[MicromaxDashboardIngest] Skipping. Bucket ${bucket} is not the configured ingest bucket.`);
        return { statusCode: 200, body: "Skipped" };
    }

    if (detailType === "Object Deleted") {
        let targets;
        try {
            targets = await resolveDeleteTargets(key);
        } catch (err) {
            console.error("[MicromaxDashboardIngest] resolveDeleteTargets failed:", err);
            throw err;
        }
        if (targets.length === 0) {
            console.log(`[MicromaxDashboardIngest] No child data source to delete for ${key}`);
            return { statusCode: 200, body: "Skipped" };
        }
        const errors = [];
        for (const target of targets) {
            try {
                await deleteChildDataSource(target);
            } catch (err) {
                console.error(`[MicromaxDashboardIngest] Delete failed for ${target.workspaceId}/${target.dataSourceId}:`, err);
                errors.push(err);
            }
        }
        if (errors.length > 0) {
            throw new Error(`Failed to delete ${errors.length} of ${targets.length} child data sources`);
        }
        return { statusCode: 200, body: `Deleted ${targets.length} child data source(s)` };
    }

    // Default: treat as Object Created.
    let targets;
    try {
        targets = await resolveCreateTargets(key);
    } catch (err) {
        console.error("[MicromaxDashboardIngest] resolveCreateTargets failed:", err);
        throw err;
    }

    if (targets.length === 0) {
        console.log(`[MicromaxDashboardIngest] No micromax-dashboard parent connections; skipping ${key}`);
        return { statusCode: 200, body: "Skipped" };
    }

    const errors = [];
    for (const target of targets) {
        try {
            await enqueueTransformJob({ bucket, key, ...target });
        } catch (err) {
            console.error(`[MicromaxDashboardIngest] Enqueue failed for ${target.workspaceId}/${target.dataSourceId}:`, err);
            errors.push(err);
        }
    }

    if (errors.length > 0) {
        throw new Error(`Failed to enqueue ${errors.length} of ${targets.length} transform jobs`);
    }

    return { statusCode: 200, body: `Enqueued ${targets.length} job(s)` };
};
