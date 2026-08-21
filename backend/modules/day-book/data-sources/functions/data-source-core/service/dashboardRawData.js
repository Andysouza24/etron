// Manual orchestration helpers for the micromax-dashboard pipeline.

const { v4: uuidv4 } = require("uuid");
const {
    S3Client,
    HeadObjectCommand,
    GetObjectCommand,
    ListObjectsV2Command,
} = require("@aws-sdk/client-s3");
const { SQSClient, SendMessageCommand } = require("@aws-sdk/client-sqs");

const dataSourceRepo = require("@etron/day-book-shared/repositories/dataSourceRepository");
const { removeAllStoredData } = require("@etron/data-sources-shared/repositories/dataBucketRepository");
const micromaxParentAdapter = require("@etron/data-sources-shared/adapters/micromaxDashboardAdapter");
const micromaxFileAdapter = require("@etron/data-sources-shared/adapters/micromaxDashboardFileAdapter");
const testConnectionParentAdapter = require("@etron/data-sources-shared/adapters/testConnectionAdapter");
const testConnectionFileAdapter = require("@etron/data-sources-shared/adapters/testConnectionFileAdapter");
const featureFlags = require("@etron/data-sources-shared/utils/featureFlags");
const { getDefaultDashboardSchema } = require("@etron/data-sources-shared/utils/defaultDashboardSchemas");

const { requirePermission, requireEnabled, PERMISSIONS } = require("./helpers");

const s3Client = new S3Client({});
const sqsClient = new SQSClient({});

// Registered (parent, file) adapter pairs that share the dashboard pipeline.
// New parent/child adapter pairs that follow the same S3-prefix-per-folder
// pattern can be added here without touching the rest of this module. Pairs
// can be gated behind feature flags so CRUD/rescan/discover reject the type
// while the adapter code stays in place.
const ADAPTER_PAIRS = [
    { parent: micromaxParentAdapter, file: micromaxFileAdapter },
    ...(featureFlags.testConnection
        ? [{ parent: testConnectionParentAdapter, file: testConnectionFileAdapter }]
        : []),
];

function getPairForParentType(sourceType) {
    return ADAPTER_PAIRS.find((p) => p.parent.SOURCE_TYPE === sourceType) || null;
}

function getPairForFileType(sourceType) {
    return ADAPTER_PAIRS.find((p) => p.file.SOURCE_TYPE === sourceType) || null;
}

function isParentSourceType(sourceType) {
    return !!getPairForParentType(sourceType);
}

function isFileSourceType(sourceType) {
    return !!getPairForFileType(sourceType);
}

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

async function findExistingChild(workspaceId, parentDataSourceId, fileName, fileAdapter) {
    const children = await dataSourceRepo.findChildrenByParent(workspaceId, parentDataSourceId);
    return children.find(
        (c) => c.sourceType === fileAdapter.SOURCE_TYPE && c?.config?.fileName === fileName
    ) || null;
}

function buildChildRecord(parent, fileName, initialStatus, fileAdapter) {
    const date = new Date().toISOString();
    return {
        workspaceId: parent.workspaceId,
        dataSourceId: uuidv4(),
        name: deriveDisplayName(fileName),
        sourceType: fileAdapter.SOURCE_TYPE,
        method: "append-new",
        expiry: null,
        status: initialStatus,
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
}

async function ensureChildDataSource(parent, fileName, fileAdapter, { initialStatus = "processing" } = {}) {
    const existing = await findExistingChild(parent.workspaceId, parent.dataSourceId, fileName, fileAdapter);
    if (existing) return existing;

    const child = buildChildRecord(parent, fileName, initialStatus, fileAdapter);
    await dataSourceRepo.addDataSource(child);
    console.log(`[DashboardRawData] Created child ${child.dataSourceId} for ${parent.workspaceId}/${fileName}`);
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
    requireEnabled(dataSource);

    const pair = getPairForFileType(dataSource.sourceType);
    if (!pair) {
        throw new Error(`Refresh not supported for sourceType: ${dataSource.sourceType}`);
    }

    const fileName = dataSource.config?.fileName;
    if (!fileName) {
        throw new Error("Data source is missing config.fileName");
    }

    const key = pair.parent.buildObjectKey(fileName);

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

// Lists every file under the parent's S3 prefix, ensures a child exists for
// each (under the given parent connection), and enqueues a transform job per
// file. Best effort: per-file errors are logged and processing continues.
async function backfillMicromaxDashboardParent(authUserId, parentDataSourceId, { workspaceId }) {
    if (!workspaceId) throw new Error("Please specify a workspaceId");
    if (!parentDataSourceId) throw new Error("Missing parentDataSourceId");

    await requirePermission(authUserId, workspaceId, PERMISSIONS.MANAGE_DATASOURCES);

    const { bucket, queueUrl } = requireBucketAndQueue();

    const parent = await dataSourceRepo.getDataSourceById(workspaceId, parentDataSourceId);
    if (!parent) throw new Error(`Parent connection not found: ${parentDataSourceId}`);
    const pair = getPairForParentType(parent.sourceType);
    if (!pair) {
        throw new Error(`Backfill not supported for sourceType: ${parent.sourceType}`);
    }

    let ContinuationToken;
    let totalEnqueued = 0;
    do {
        const result = await s3Client.send(new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: pair.parent.EXPORT_PREFIX,
            ContinuationToken,
        }));
        for (const obj of result.Contents || []) {
            const parsed = pair.parent.parseObjectKey(obj.Key);
            if (!parsed) continue;
            try {
                const child = await ensureChildDataSource(parent, parsed.fileName, pair.file);
                await enqueueTransformJob({
                    bucket,
                    queueUrl,
                    key: obj.Key,
                    workspaceId: parent.workspaceId,
                    dataSourceId: child.dataSourceId,
                });
                totalEnqueued += 1;
            } catch (err) {
                console.error(`[DashboardRawData] Backfill failed for ${obj.Key}:`, err);
            }
        }
        ContinuationToken = result.IsTruncated ? result.NextContinuationToken : null;
    } while (ContinuationToken);

    console.log(`[DashboardRawData] Backfill enqueued ${totalEnqueued} job(s) for ${workspaceId}/${parentDataSourceId}`);
    return { enqueued: totalEnqueued };
}

// Removes every file child of the given parent connection. Called when a
// parent is being deleted so we don't leave orphaned data sources behind.
async function cascadeDeleteMicromaxDashboardChildren(workspaceId, parentDataSourceId) {
    const parent = await dataSourceRepo.getDataSourceById(workspaceId, parentDataSourceId);
    const pair = parent ? getPairForParentType(parent.sourceType) : null;
    const fileSourceType = pair ? pair.file.SOURCE_TYPE : null;

    const children = await dataSourceRepo.findChildrenByParent(workspaceId, parentDataSourceId);
    let removed = 0;
    for (const child of children) {
        if (fileSourceType && child.sourceType !== fileSourceType) continue;
        if (!fileSourceType && !isFileSourceType(child.sourceType)) continue;
        try {
            await removeAllStoredData(workspaceId, child.dataSourceId);
        } catch (err) {
            console.error(`[DashboardRawData] removeAllStoredData failed for ${workspaceId}/${child.dataSourceId}:`, err);
        }
        await dataSourceRepo.removeDataSource(workspaceId, child.dataSourceId);
        removed += 1;
    }
    console.log(`[DashboardRawData] Cascaded delete of ${removed} child(ren) for parent ${parentDataSourceId}`);
    return { removed };
}

// lists every file in the parent's `exports/` prefix and ensures a child data source exists for each
// files with a bundled default schema (including known-empty `[]` schemas) are enqueued for transform with the schema embedded in the SQS payload
// files without a bundled schema are created in `pending_setup` so the wizard can surface them for manual review
// per-child status updates are sent silently during this setup batch - only an aggregated "X of Y files" progress update is broadcast on the parent
// returns the children list
async function discoverMicromaxDashboardChildren(authUserId, parentDataSourceId, { workspaceId }) {
    if (!workspaceId) throw new Error("Please specify a workspaceId");
    if (!parentDataSourceId) throw new Error("Missing parentDataSourceId");

    await requirePermission(authUserId, workspaceId, PERMISSIONS.MANAGE_DATASOURCES);

    const { bucket, queueUrl } = requireBucketAndQueue();

    const parent = await dataSourceRepo.getDataSourceById(workspaceId, parentDataSourceId);
    if (!parent) throw new Error(`Parent connection not found: ${parentDataSourceId}`);
    requireEnabled(parent);
    const pair = getPairForParentType(parent.sourceType);
    if (!pair) {
        throw new Error(`Discover not supported for sourceType: ${parent.sourceType}`);
    }

    // 1. enumerate every export file once
    const exportFiles = [];
    let ContinuationToken;
    do {
        const result = await s3Client.send(new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: pair.parent.EXPORT_PREFIX,
            ContinuationToken,
        }));
        for (const obj of result.Contents || []) {
            const parsed = pair.parent.parseObjectKey(obj.Key);
            if (parsed) exportFiles.push({ key: obj.Key, fileName: parsed.fileName });
        }
        ContinuationToken = result.IsTruncated ? result.NextContinuationToken : null;
    } while (ContinuationToken);

    // 2. load existing children once and index them by file name
    const existingChildren = await dataSourceRepo.findChildrenByParent(workspaceId, parentDataSourceId);
    const existingByFileName = new Map();
    for (const c of existingChildren) {
        if (c.sourceType === pair.file.SOURCE_TYPE && c?.config?.fileName) {
            existingByFileName.set(c.config.fileName, c);
        }
    }

    // 3. plan: create missing children + decide which files to enqueue
    const childrenToCreate = [];
    const messages = [];
    for (const { fileName, key } of exportFiles) {
        const defaultSchema = getDefaultDashboardSchema(fileName);
        const hasDefault = defaultSchema !== null;
        let child = existingByFileName.get(fileName);
        if (!child) {
            const initialStatus = hasDefault ? "processing" : "pending_setup";
            child = buildChildRecord(parent, fileName, initialStatus, pair.file);
            childrenToCreate.push(child);
        }
        if (hasDefault) {
            messages.push({
                bucket,
                key,
                workspaceId,
                dataSourceId: child.dataSourceId,
                parentDataSourceId,
                defaultSchema,
                silent: true,
            });
        }
    }

    // 4. create new child records in parallel
    if (childrenToCreate.length > 0) {
        await Promise.all(childrenToCreate.map((c) => dataSourceRepo.addDataSource(c)));
    }

    // 5. seed parent counters and broadcast a single "starting setup" notification
    await dataSourceRepo.initDashboardSetupCounters(workspaceId, parentDataSourceId, messages.length);

    // 6. fan out SQS transform jobs in parallel
    await Promise.all(
        messages.map((msg) =>
            sqsClient.send(new SendMessageCommand({
                QueueUrl: queueUrl,
                MessageBody: JSON.stringify(msg),
            }))
        )
    );

    console.log(
        `[DashboardRawData] Discover enqueued ${messages.length} known file(s) for ${workspaceId}/${parentDataSourceId}; ${exportFiles.length - messages.length} pending manual review`
    );

    // 7. return the up-to-date children list (re-fetch to include newly created rows)
    const childrenAfter = childrenToCreate.length > 0
        ? await dataSourceRepo.findChildrenByParent(workspaceId, parentDataSourceId)
        : existingChildren;
    return {
        children: childrenAfter.filter((c) => c.sourceType === pair.file.SOURCE_TYPE),
    };
}

// Reads the raw JSON for a single dashboard file (child data source).
// Used by the wizard's per-child schema preview.
async function readMicromaxDashboardFileRawData(workspaceId, child) {
    const { bucket } = requireBucketAndQueue();
    const fileName = child?.config?.fileName;
    if (!fileName) throw new Error("Child data source is missing config.fileName");

    const pair = getPairForFileType(child.sourceType);
    if (!pair) {
        throw new Error(`Read raw data not supported for sourceType: ${child.sourceType}`);
    }

    const key = pair.parent.buildObjectKey(fileName);
    const obj = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const body = await obj.Body.transformToString();
    try {
        return JSON.parse(body);
    } catch {
        throw new Error(`File ${key} is not valid JSON`);
    }
}

// Enqueues a single transform job for an already-existing child data source.
// Called when the user activates a child via the wizard so the previously
// confirmed schema is honoured by the transform pipeline.
async function enqueueMicromaxDashboardChildTransform(workspaceId, childDataSourceId) {
    const { bucket, queueUrl } = requireBucketAndQueue();

    const child = await dataSourceRepo.getDataSourceById(workspaceId, childDataSourceId);
    if (!child) throw new Error(`Data source not found: ${childDataSourceId}`);
    const pair = getPairForFileType(child.sourceType);
    if (!pair) {
        throw new Error(`Transform enqueue not supported for sourceType: ${child.sourceType}`);
    }

    const fileName = child.config?.fileName;
    if (!fileName) throw new Error("Child data source is missing config.fileName");

    const key = pair.parent.buildObjectKey(fileName);
    await enqueueTransformJob({ bucket, queueUrl, key, workspaceId, dataSourceId: childDataSourceId });
    return { success: true };
}

module.exports = {
    refreshMicromaxDashboardFile,
    backfillMicromaxDashboardParent,
    discoverMicromaxDashboardChildren,
    cascadeDeleteMicromaxDashboardChildren,
    enqueueMicromaxDashboardChildTransform,
    readMicromaxDashboardFileRawData,
    isParentSourceType,
    isFileSourceType,
};
