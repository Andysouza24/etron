// Manual orchestration helpers for the micromax-dashboard pipeline.

const { v4: uuidv4 } = require("uuid");
const {
    S3Client,
    HeadObjectCommand,
    ListObjectsV2Command,
} = require("@aws-sdk/client-s3");
const { SQSClient, SendMessageCommand } = require("@aws-sdk/client-sqs");

const dataSourceRepo = require("@etron/day-book-shared/repositories/dataSourceRepository");
const { removeAllStoredData } = require("@etron/data-sources-shared/repositories/dataBucketRepository");
const parentAdapter = require("@etron/data-sources-shared/adapters/micromaxDashboardAdapter");
const fileAdapter = require("@etron/data-sources-shared/adapters/micromaxDashboardFileAdapter");

const { requirePermission, PERMISSIONS } = require("./helpers");

const s3Client = new S3Client({});
const sqsClient = new SQSClient({});

function requireBucketAndQueue() {
    const bucket = process.env.DASHBOARD_RAW_DATA_BUCKET;
    const queueUrl = process.env.DASHBOARD_RAW_DATA_QUEUE_URL;
    if (!bucket) throw new Error("DASHBOARD_RAW_DATA_BUCKET env var is not set");
    if (!queueUrl) throw new Error("DASHBOARD_RAW_DATA_QUEUE_URL env var is not set");
    return { bucket, queueUrl };
}

function deriveDisplayName(fileName) {
    return fileName.replace(/\.json$/i, "");
}

async function findExistingChild(workspaceId, parentDataSourceId, fileName) {
    const children = await dataSourceRepo.findChildrenByParent(workspaceId, parentDataSourceId);
    return children.find(
        (c) => c.sourceType === fileAdapter.SOURCE_TYPE && c?.config?.fileName === fileName
    ) || null;
}

async function ensureChildDataSource(parent, fileName) {
    const existing = await findExistingChild(parent.workspaceId, parent.dataSourceId, fileName);
    if (existing) return existing;

    const date = new Date().toISOString();
    const child = {
        workspaceId: parent.workspaceId,
        dataSourceId: uuidv4(),
        name: deriveDisplayName(fileName),
        sourceType: fileAdapter.SOURCE_TYPE,
        method: "overwrite",
        expiry: null,
        status: "processing",
        createdBy: parent.createdBy || "system",
        config: {
            fileName,
            parentDataSourceId: parent.dataSourceId,
            permissions: { roles: [], users: [] },
        },
        createdAt: date,
        lastUpdate: date,
        associatedMetrics: [],
    };

    await dataSourceRepo.addDataSource(child);
    console.log(`[MicromaxDashboard] Created child ${child.dataSourceId} for ${parent.workspaceId}/${fileName}`);
    return child;
}

async function enqueueTransformJob({ bucket, queueUrl, key, workspaceId, dataSourceId }) {
    // mark data source as processing before the sqs message is sent so the UI displays accurate status while a fresh job is in flight
    // overwritten on completion
    try {
        await dataSourceRepo.updateDataSourceStatus(workspaceId, dataSourceId, {
            status: "processing",
            errorMessage: null,
        });
    } catch (err) {
        console.warn(
            `[MicromaxDashboard] Failed to set processing status for ${workspaceId}/${dataSourceId}:`,
            err
        );
    }

    await sqsClient.send(new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify({ bucket, key, workspaceId, dataSourceId }),
    }));
}

// Manual refresh of a single dashboard file (child data source).
async function refreshMicromaxDashboardFile(authUserId, dataSourceId, { workspaceId }) {
    if (!workspaceId) throw new Error("Please specify a workspaceId");
    if (!dataSourceId) throw new Error("Missing dataSourceId");

    await requirePermission(authUserId, workspaceId, PERMISSIONS.MANAGE_DATASOURCES);

    const { bucket, queueUrl } = requireBucketAndQueue();

    const dataSource = await dataSourceRepo.getDataSourceById(workspaceId, dataSourceId);
    if (!dataSource) throw new Error(`Data source not found: ${dataSourceId}`);

    if (dataSource.sourceType !== fileAdapter.SOURCE_TYPE) {
        throw new Error(`Refresh not supported for sourceType: ${dataSource.sourceType}`);
    }

    const fileName = dataSource.config?.fileName;
    if (!fileName) {
        throw new Error("Data source is missing config.fileName");
    }

    const key = parentAdapter.buildObjectKey(fileName);

    try {
        await s3Client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    } catch (err) {
        if (err?.$metadata?.httpStatusCode === 404 || err?.name === "NotFound") {
            throw new Error(`No raw data file found at s3://${bucket}/${key}`);
        }
        throw err;
    }

    await enqueueTransformJob({ bucket, queueUrl, key, workspaceId, dataSourceId });
    console.log(`[MicromaxDashboard] Manual refresh enqueued for ${workspaceId}/${dataSourceId} from ${key}`);
    return { success: true, message: "Refresh queued" };
}

// Lists every file in `exports/`, ensures a child exists for each (under the
// given parent connection), and enqueues a transform job per file. Best
// effort: per-file errors are logged and processing continues.
async function backfillMicromaxDashboardParent(authUserId, parentDataSourceId, { workspaceId }) {
    if (!workspaceId) throw new Error("Please specify a workspaceId");
    if (!parentDataSourceId) throw new Error("Missing parentDataSourceId");

    await requirePermission(authUserId, workspaceId, PERMISSIONS.MANAGE_DATASOURCES);

    const { bucket, queueUrl } = requireBucketAndQueue();

    const parent = await dataSourceRepo.getDataSourceById(workspaceId, parentDataSourceId);
    if (!parent) throw new Error(`Parent connection not found: ${parentDataSourceId}`);
    if (parent.sourceType !== parentAdapter.SOURCE_TYPE) {
        throw new Error(`Backfill not supported for sourceType: ${parent.sourceType}`);
    }

    let ContinuationToken;
    let totalEnqueued = 0;
    do {
        const result = await s3Client.send(new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: parentAdapter.EXPORT_PREFIX,
            ContinuationToken,
        }));
        for (const obj of result.Contents || []) {
            const parsed = parentAdapter.parseObjectKey(obj.Key);
            if (!parsed) continue;
            try {
                const child = await ensureChildDataSource(parent, parsed.fileName);
                await enqueueTransformJob({
                    bucket,
                    queueUrl,
                    key: obj.Key,
                    workspaceId: parent.workspaceId,
                    dataSourceId: child.dataSourceId,
                });
                totalEnqueued += 1;
            } catch (err) {
                console.error(`[MicromaxDashboard] Backfill failed for ${obj.Key}:`, err);
            }
        }
        ContinuationToken = result.IsTruncated ? result.NextContinuationToken : null;
    } while (ContinuationToken);

    console.log(`[MicromaxDashboard] Backfill enqueued ${totalEnqueued} job(s) for ${workspaceId}/${parentDataSourceId}`);
    return { enqueued: totalEnqueued };
}

// Removes every file child of the given parent connection. Called when a
// parent is being deleted so we don't leave orphaned data sources behind.
async function cascadeDeleteMicromaxDashboardChildren(workspaceId, parentDataSourceId) {
    const children = await dataSourceRepo.findChildrenByParent(workspaceId, parentDataSourceId);
    let removed = 0;
    for (const child of children) {
        if (child.sourceType !== fileAdapter.SOURCE_TYPE) continue;
        try {
            await removeAllStoredData(workspaceId, child.dataSourceId);
        } catch (err) {
            console.error(`[MicromaxDashboard] removeAllStoredData failed for ${workspaceId}/${child.dataSourceId}:`, err);
        }
        await dataSourceRepo.removeDataSource(workspaceId, child.dataSourceId);
        removed += 1;
    }
    console.log(`[MicromaxDashboard] Cascaded delete of ${removed} child(ren) for parent ${parentDataSourceId}`);
    return { removed };
}

module.exports = {
    refreshMicromaxDashboardFile,
    backfillMicromaxDashboardParent,
    cascadeDeleteMicromaxDashboardChildren,
};
