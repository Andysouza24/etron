const { v4: uuidv4 } = require("uuid");
const { SQSClient, SendMessageCommand } = require("@aws-sdk/client-sqs");

const dataSourceRepo = require("@etron/day-book-shared/repositories/dataSourceRepository");
const { removeAllStoredData } = require("@etron/data-sources-shared/repositories/dataBucketRepository");
const micromaxParentAdapter = require("@etron/data-sources-shared/adapters/micromaxDashboardAdapter");
const micromaxFileAdapter = require("@etron/data-sources-shared/adapters/micromaxDashboardFileAdapter");
const testConnectionParentAdapter = require("@etron/data-sources-shared/adapters/testConnectionAdapter");
const testConnectionFileAdapter = require("@etron/data-sources-shared/adapters/testConnectionFileAdapter");
const featureFlags = require("@etron/data-sources-shared/utils/featureFlags");

const sqsClient = new SQSClient({});

// Registered parent/file adapter pairs. The ingest pipeline supports any
// number of (parent, file) adapter pairs; each pair owns a unique S3 prefix.
// Pairs can be gated behind feature flags so the pipeline ignores their S3
// events without removing the underlying adapter code.
const ADAPTER_PAIRS = [
    { parent: micromaxParentAdapter, file: micromaxFileAdapter },
    ...(featureFlags.testConnection
        ? [{ parent: testConnectionParentAdapter, file: testConnectionFileAdapter }]
        : []),
];

// Resolves the (parent, file) adapter pair responsible for a given S3 key
// based on its prefix. Returns null if no registered pair matches.
function findAdapterPairForKey(key) {
    if (!key) return null;
    return ADAPTER_PAIRS.find((pair) => key.startsWith(pair.parent.EXPORT_PREFIX)) || null;
}

// Returns a display name for a child data source given a fileName like
// "sales-daily.json" -> "sales-daily".
function deriveDisplayName(fileName) {
    return fileName.replace(/\.json$/i, "");
}

// Loads every parent connection (across all registered adapter pairs) workspace-by-workspace.
async function listParents() {
    const results = await Promise.all(
        ADAPTER_PAIRS.map((pair) => dataSourceRepo.findDataSourcesBySourceType(pair.parent.SOURCE_TYPE))
    );
    return results.flat();
}

// Finds an existing child for a given (workspaceId, parentDataSourceId, fileName).
async function findExistingChild(workspaceId, parentDataSourceId, fileName, fileAdapter) {
    const children = await dataSourceRepo.findChildrenByParent(workspaceId, parentDataSourceId);
    return children.find(
        (c) => c.sourceType === fileAdapter.SOURCE_TYPE && c?.config?.fileName === fileName
    ) || null;
}

// Ensures a child exists for the given parent + fileName. Returns the child.
async function ensureChildDataSource(parent, fileName, fileAdapter) {
    const existing = await findExistingChild(parent.workspaceId, parent.dataSourceId, fileName, fileAdapter);
    if (existing) return existing;

    const date = new Date().toISOString();
    const child = {
        workspaceId: parent.workspaceId,
        dataSourceId: uuidv4(),
        name: deriveDisplayName(fileName),
        sourceType: fileAdapter.SOURCE_TYPE,
        method: "append-new",
        expiry: null,
        status: "processing",
        createdBy: parent.createdBy || "system",
        config: {
            fileName,
            parentDataSourceId: parent.dataSourceId,
            // Per-file permission scaffolding. Empty arrays mean "inherit
            // permissions from the parent connection". A future UI can manage
            // these on a per-file basis.
            permissions: { roles: [], users: [] },
        },
        createdAt: date,
        lastUpdate: date,
        associatedMetrics: [],
    };

    await dataSourceRepo.addDataSource(child);
    console.log(`[MicromaxDashboardIngest] Created child ${child.dataSourceId} for ${parent.workspaceId}/${fileName}`);
    return child;
}

// Resolves an S3 key like `exports/foo.json` (or `test-exports/foo.json`) into
// every (parent, child) pair to ingest. Creates missing children for each
// parent connection that matches the key's prefix.
async function resolveCreateTargets(key) {
    const pair = findAdapterPairForKey(key);
    if (!pair) return [];

    const parsed = pair.parent.parseObjectKey(key);
    if (!parsed) return [];

    const allParents = await listParents();
    const parents = allParents.filter((p) => p.sourceType === pair.parent.SOURCE_TYPE);
    if (parents.length === 0) return [];

    const targets = [];
    for (const parent of parents) {
        try {
            const child = await ensureChildDataSource(parent, parsed.fileName, pair.file);
            targets.push({ workspaceId: parent.workspaceId, dataSourceId: child.dataSourceId });
        } catch (err) {
            console.error(
                `[MicromaxDashboardIngest] ensureChildDataSource failed for ${parent.workspaceId}/${parsed.fileName}:`,
                err
            );
            throw err;
        }
    }
    return targets;
}

// Resolves an S3 key into every (workspaceId, dataSourceId) child that should
// be removed. Does not delete here; callers do.
async function resolveDeleteTargets(key) {
    const pair = findAdapterPairForKey(key);
    if (!pair) return [];

    const parsed = pair.parent.parseObjectKey(key);
    if (!parsed) return [];

    const matches = await dataSourceRepo.findDataSourcesBySourceTypeAndFileName(
        pair.file.SOURCE_TYPE,
        parsed.fileName,
    );
    return matches.map((m) => ({ workspaceId: m.workspaceId, dataSourceId: m.dataSourceId }));
}

async function enqueueTransformJob({ bucket, key, workspaceId, dataSourceId }) {
    const queueUrl = process.env.DASHBOARD_RAW_DATA_QUEUE_URL;
    if (!queueUrl) {
        throw new Error("DASHBOARD_RAW_DATA_QUEUE_URL env var is not set");
    }

    // mark data source as processing before the sqs message is sent so the UI displays accurate status while a fresh job is in flight
    // overwritten on completion
    try {
        await dataSourceRepo.updateDataSourceStatus(workspaceId, dataSourceId, {
            status: "processing",
            errorMessage: null,
            progressStage: "Queued",
            progressPercent: 5,
        });
    } catch (err) {
        console.warn(
            `[MicromaxDashboardIngest] Failed to set processing status for ${workspaceId}/${dataSourceId}:`,
            err
        );
    }

    await sqsClient.send(new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify({ bucket, key, workspaceId, dataSourceId }),
    }));

    console.log(`[MicromaxDashboardIngest] Enqueued transform job for ${workspaceId}/${dataSourceId}`);
}

// Removes the parquet/schema/etc. data for a child and deletes the data source
// row. Best-effort: data removal failures are logged but do not block the row
// deletion.
async function deleteChildDataSource({ workspaceId, dataSourceId }) {
    try {
        await removeAllStoredData(workspaceId, dataSourceId);
    } catch (err) {
        console.error(
            `[MicromaxDashboardIngest] removeAllStoredData failed for ${workspaceId}/${dataSourceId}:`,
            err
        );
    }
    await dataSourceRepo.removeDataSource(workspaceId, dataSourceId);
    console.log(`[MicromaxDashboardIngest] Deleted child data source ${workspaceId}/${dataSourceId}`);
}

module.exports = {
    resolveCreateTargets,
    resolveDeleteTargets,
    enqueueTransformJob,
    deleteChildDataSource,
};
