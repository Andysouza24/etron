// Author(s): Rhys Cleary, Holly Wyatt
// Data source CRUD: create (remote + local), read (single/list), delete, upload URL.

const { v4: uuidv4 } = require("uuid");
const { LambdaClient, InvokeCommand } = require("@aws-sdk/client-lambda");

const dataSourceRepo = require("@etron/day-book-shared/repositories/dataSourceRepository");
const dataSourceSecretsRepo = require("@etron/data-sources-shared/repositories/dataSourceSecretsRepository");
const metricRepo = require("@etron/day-book-shared/repositories/metricRepository");
const adapterFactory = require("@etron/data-sources-shared/adapters/adapterFactory");
const { removeAllStoredData, getUploadUrl, getDataSchema } = require("@etron/data-sources-shared/repositories/dataBucketRepository");
const { validateWorkspaceId } = require("@etron/shared/utils/validation");
const { notifyDataSourceUpdate } = require("@etron/day-book-shared/utils/notifyDataSourceUpdate");
const { notifyMetricUpdate } = require("@etron/day-book-shared/utils/notifyMetricUpdate");

const {
    backfillMicromaxDashboardParent,
    cascadeDeleteMicromaxDashboardChildren,
    enqueueMicromaxDashboardChildTransform,
    isParentSourceType,
    isFileSourceType,
} = require("./dashboardRawData");

const {
    PERMISSIONS,
    requirePermission,
    requireEnabled,
    resolveAndValidateAdapter,
    auditDataSource,
} = require("./helpers");

function validateCommonCreateFields({ name, method, expiry }) {
    if (!name || typeof name !== "string") {
        throw new Error("Please specify a type of data source");
    }
    if (method && !["overwrite", "extend", "append-new"].includes(method)) {
        throw new Error("Please specify the method 'overwrite', 'extend' or 'append-new'");
    }
    if (method === "extend" && expiry && typeof expiry !== "object") {
        throw new Error("Expiry is not in the correct format");
    }
}
// run post-create activation side effects for remote data source
// used when a source is created and when a pending source is activated by wizard final step
// side effects are best effort and never block caller
async function runRemoteActivationSideEffects(authUserId, dataSourceItem) {
    const { workspaceId, dataSourceId, sourceType } = dataSourceItem;

    const client = new LambdaClient();
    try {
        const command = new InvokeCommand({
            FunctionName: process.env.POLLING_LAMBDA_NAME,
            InvocationType: "Event",
            Payload: Buffer.from(JSON.stringify({ workspaceId, dataSource: dataSourceItem })),
        });
        await client.send(command);
    } catch (error) {
        console.error("Failed to trigger the polling lambda");
    }

    if (isParentSourceType(sourceType)) {
        try {
            await backfillMicromaxDashboardParent(authUserId, dataSourceId, { workspaceId });
        } catch (err) {
            console.error("[crud] Dashboard parent backfill failed (non-fatal):", err);
        }
    }
}

async function createRemoteDataSource(authUserId, payload) {
    const workspaceId = payload.workspaceId;
    await validateWorkspaceId(workspaceId);
    await requirePermission(authUserId, workspaceId, PERMISSIONS.MANAGE_DATASOURCES);

    const { name, sourceType, method, expiry, config, secrets, pendingSetup } = payload;
    validateCommonCreateFields({ name, method, expiry });

    resolveAndValidateAdapter(sourceType, { config, secrets });

    // Only one dashboard parent connection of each type is allowed per workspace.
    if (isParentSourceType(sourceType)) {
        const existing = await dataSourceRepo.getDataSourcesByWorkspaceId(workspaceId);
        const alreadyConnected = (existing || []).some(
            (ds) => ds.sourceType === sourceType
        );
        if (alreadyConnected) {
            throw new Error(`A ${sourceType} connection already exists for this workspace`);
        }
    }

    const dataSourceId = uuidv4();
    const date = new Date().toISOString();

    const dataSourceItem = {
        workspaceId,
        dataSourceId,
        name,
        sourceType,
        method: method || "overwrite",
        expiry: expiry || null,
        status: pendingSetup ? "pending_setup" : "active",
        createdBy: authUserId,
        config,
        createdAt: date,
        lastUpdate: date,
        associatedMetrics: [],
    };

    await dataSourceRepo.addDataSource(dataSourceItem);
    await dataSourceSecretsRepo.saveSecrets(workspaceId, dataSourceId, secrets);

    await auditDataSource({
        action: "Created",
        filter: "created",
        workspaceId,
        userId: authUserId,
        dataSourceId,
        name,
    });

    await notifyDataSourceUpdate(dataSourceItem, "CREATE");

    if (!pendingSetup) {
        await runRemoteActivationSideEffects(authUserId, dataSourceItem);
    }

    return { ...dataSourceItem, secrets };
}
// activate a remote data source created with 'pendingSetup: true'
// persists user-confirmed schema if provided
// flips status to active and runs same post-create side effects
// calling on an active data source is rejected
async function activateDataSource(authUserId, dataSourceId, payload) {
    const workspaceId = payload.workspaceId;
    await validateWorkspaceId(workspaceId);
    await requirePermission(authUserId, workspaceId, PERMISSIONS.MANAGE_DATASOURCES);

    if (!dataSourceId || typeof dataSourceId !== "string") {
        throw new Error("dataSourceId must be a UUID, 'string'");
    }

    const dataSource = await dataSourceRepo.getDataSourceById(workspaceId, dataSourceId);
    if (!dataSource) throw new Error(`Data source not found: ${dataSourceId}`);
    if (dataSource.status === "active") {
        throw new Error("Data source is already active");
    }
    requireEnabled(dataSource);

    const { confirmedSchema } = payload;
    if (confirmedSchema && Array.isArray(confirmedSchema) && confirmedSchema.length) {
        // re-resolve types/dateFormat against fresh data so date columns get cast to timestamp
        let schemaToSave = confirmedSchema;
        if (isFileSourceType(dataSource.sourceType)) {
            try {
                const { readMicromaxDashboardFileRawData } = require("./dashboardRawData");
                const { translateData } = require("@etron/data-sources-shared/utils/translateData");
                const { normaliseHeterogeneousRows } = require("@etron/data-sources-shared/utils/normaliseRows");
                const { sanitiseMicromaxDashboardData } = require("@etron/data-sources-shared/utils/sanitiseMicromaxDashboardData");
                const { buildResolvedSchemaFromConfirmed } = require("./schema");
                const rawData = await readMicromaxDashboardFileRawData(workspaceId, dataSource);
                const { rows: sanitisedRows } = sanitiseMicromaxDashboardData(rawData);
                const translatedData = normaliseHeterogeneousRows(translateData(sanitisedRows));
                if (Array.isArray(translatedData) && translatedData.length > 0) {
                    schemaToSave = buildResolvedSchemaFromConfirmed(translatedData, confirmedSchema);
                }
            } catch (err) {
                // fall back to the raw confirmedSchema if the file cannot be read at activation time
                // the transform will re-infer when data arrives
                console.error("[crud] dashboard schema resolution failed (non-fatal):", err);
            }
        }
        // schema persistence lives in the data-sources-shared bucket repo so that the polling lambda and view-data path read the same schema
        const { saveSchemaAndUpdateTable } = require("@etron/data-sources-shared/utils/schema");
        await saveSchemaAndUpdateTable(workspaceId, dataSourceId, schemaToSave);
    }
    // an empty confirmedSchema is allowed - the user has reviewed an empty file and accepted there are no fields yet
    // the source is still activated - when data first arrives, the transform/poller will auto-infer a schema and flag requiresReview so the user can re-review

    await dataSourceRepo.updateDataSourceStatus(workspaceId, dataSourceId, {
        status: "active",
        errorMessage: null,
        // user has just reviewed - clear any prior requiresReview flag
        requiresReview: false,
    });

    const activatedItem = { ...dataSource, status: "active" };

    // side effects depend on the source type:
    /*  - micromax-dashboard parent has no live polling and its children are activated individually via the wizard, so skip side effects
        - micromax-dashboard-file children are processed by the SQS transform pipeline - enqueue a single transform job for the file
        - other remote sources go through the polling lambda + standard activation side effects. */
    if (isParentSourceType(dataSource.sourceType)) {
        // parent is just a container; nothing to poll or backfill at activate time.
    } else if (isFileSourceType(dataSource.sourceType)) {
        try {
            await enqueueMicromaxDashboardChildTransform(workspaceId, dataSourceId);
        } catch (err) {
            console.error("[crud] enqueueMicromaxDashboardChildTransform failed (non-fatal):", err);
        }
    } else {
        await runRemoteActivationSideEffects(authUserId, activatedItem);
    }

    await notifyDataSourceUpdate(activatedItem, "UPDATE");

    return activatedItem;
}

async function createLocalDataSource(authUserId, payload) {
    const workspaceId = payload.workspaceId;
    await validateWorkspaceId(workspaceId);
    await requirePermission(authUserId, workspaceId, PERMISSIONS.MANAGE_DATASOURCES);

    const { name, sourceType, method, expiry } = payload;

    if (!sourceType) {
        throw new Error("Please specify the type of data source");
    }
    validateCommonCreateFields({ name, method, expiry });

    const adapter = adapterFactory.getAdapter(sourceType);
    if (!adapter) {
        throw new Error("The data type sent is not supported");
    }

    const dataSourceId = uuidv4();
    const date = new Date().toISOString();

    const dataSourceItem = {
        workspaceId,
        dataSourceId,
        name,
        sourceType,
        method: method || "overwrite",
        expiry: expiry || null,
        status: "pending_upload",
        createdBy: authUserId,
        createdAt: date,
        lastUpdate: date,
        associatedMetrics: [],
    };

    await dataSourceRepo.addDataSource(dataSourceItem);
    const uploadUrl = await getUploadUrl(workspaceId, dataSourceId);

    await auditDataSource({
        action: "Created",
        filter: "created",
        workspaceId,
        userId: authUserId,
        dataSourceId,
        name,
    });

    await notifyDataSourceUpdate(dataSourceItem, "CREATE");

    return { ...dataSourceItem, uploadUrl };
}

async function getLocalDataSourceUploadUrl(authUserId, workspaceId, dataSourceId) {
    await validateWorkspaceId(workspaceId);
    await requirePermission(authUserId, workspaceId, PERMISSIONS.MANAGE_DATASOURCES);

    const dataSource = await dataSourceRepo.getDataSourceById(workspaceId, dataSourceId);
    if (!dataSource) throw new Error("DataSource not found");

    if (dataSource.sourceType != "local-csv") {
        throw new Error("Invalid data source type. Must be local.");
    }

    const fileUploadUrl = await getUploadUrl(workspaceId, dataSourceId);
    return { fileUploadUrl };
}

async function getDataSourceInWorkspace(authUserId, workspaceId, dataSourceId) {
    await validateWorkspaceId(workspaceId);
    await requirePermission(authUserId, workspaceId, PERMISSIONS.VIEW_DATASOURCES);

    const dataSource = await dataSourceRepo.getDataSourceById(workspaceId, dataSourceId);
    if (!dataSource) return null;

    const secrets = await dataSourceSecretsRepo.getSecrets(workspaceId, dataSourceId);

    // schema may not yet exist for freshly-created sources; treat as empty in that case
    let schema = [];
    try {
        schema = (await getDataSchema(workspaceId, dataSourceId)) || [];
    } catch (e) {
        schema = [];
    }

    return { ...dataSource, secrets, schema };
}

async function getDataSourcesInWorkspace(authUserId, workspaceId) {
    await validateWorkspaceId(workspaceId);
    await requirePermission(authUserId, workspaceId, PERMISSIONS.VIEW_DATASOURCES);

    const dataSources = await dataSourceRepo.getDataSourcesByWorkspaceId(workspaceId);
    const dataSourceSecrets = await dataSourceSecretsRepo.getSecretsByWorkspaceId(workspaceId);

    return dataSources.map(source => ({
        ...source,
        secrets: dataSourceSecrets[source.dataSourceId] || {},
    }));
}

async function deleteDataSourceInWorkspace(authUserId, workspaceId, dataSourceId) {
    await validateWorkspaceId(workspaceId);
    await requirePermission(authUserId, workspaceId, PERMISSIONS.MANAGE_DATASOURCES);

    const dataSource = await dataSourceRepo.getDataSourceById(workspaceId, dataSourceId);
    if (!dataSource) {
        throw new Error("Data Source not found");
    }

    // Dashboard file children are managed by the ingest pipeline.
    // Block direct deletion so the user can't desynchronise the bucket and
    // the data source list — files disappear when removed from S3 or when
    // the parent connection is deleted.
    if (isFileSourceType(dataSource.sourceType)) {
        throw new Error(
            "Dashboard files are managed automatically. Delete the parent connection or remove the file from the bucket."
        );
    }

    // Deleting a parent dashboard connection should also remove every file
    // child that belongs to it.
    if (isParentSourceType(dataSource.sourceType)) {
        try {
            await cascadeDeleteMicromaxDashboardChildren(workspaceId, dataSourceId);
        } catch (err) {
            console.error("[crud] cascadeDeleteMicromaxDashboardChildren failed (continuing):", err);
        }
    }

    await removeAllStoredData(workspaceId, dataSourceId);

    // Disconnecting a data source fully deletes every metric that depends on it.
    // Disable (toggleDataSourceEnabled) is the path that leaves metrics intact;
    // disconnect is destructive by design. Capture each metric snapshot before
    // deletion so the DELETE broadcast carries enough context for clients to
    // drop them from local state. Boards then render the standard
    // 'metric deleted' placeholder for any items that referenced them.
    const deletedMetrics = [];
    if (dataSource.metrics && dataSource.metrics.length > 0) {
        await Promise.all(
            dataSource.metrics.map(async (metricId) => {
                try {
                    const metric = await metricRepo.getMetricById(workspaceId, metricId);
                    if (!metric) return;
                    await metricRepo.removeMetric(workspaceId, metricId);
                    deletedMetrics.push(metric);
                } catch (err) {
                    console.error(`[crud] Failed to delete metric ${metricId} during data source disconnect:`, err);
                }
            })
        );
    }

    await dataSourceRepo.removeDataSource(workspaceId, dataSourceId);
    await dataSourceSecretsRepo.removeSecrets(workspaceId, dataSourceId);

    await auditDataSource({
        action: "Deleted",
        filter: "deleted",
        workspaceId,
        userId: authUserId,
        dataSourceId,
        name: dataSource.name,
    });

    await notifyDataSourceUpdate(dataSource, "DELETE");

    // broadcast a DELETE for every metric so other devices drop them from their
    // metric list; boards fall back to the deleted-metric placeholder card
    await Promise.all(
        deletedMetrics.map(metric =>
            notifyMetricUpdate(metric, "DELETE")
        )
    );

    return { message: "Data source successfully deleted" };
}

// flip a data source between enabled and disabled
// disabled sources keep ingesting in the background but reject every user action
async function toggleDataSourceEnabled(authUserId, dataSourceId, payload) {
    const { workspaceId, enabled } = payload || {};
    await validateWorkspaceId(workspaceId);
    await requirePermission(authUserId, workspaceId, PERMISSIONS.MANAGE_DATASOURCES);

    if (!dataSourceId || typeof dataSourceId !== "string") {
        throw new Error("dataSourceId must be a UUID, 'string'");
    }
    if (typeof enabled !== "boolean") {
        throw new Error("`enabled` must be a boolean");
    }

    const dataSource = await dataSourceRepo.getDataSourceById(workspaceId, dataSourceId);
    if (!dataSource) {
        throw new Error("Data Source not found");
    }

    const updated = await dataSourceRepo.updateDataSourceEnabled(workspaceId, dataSourceId, enabled);

    await auditDataSource({
        action: enabled ? "Enabled" : "Disabled",
        filter: "updated",
        workspaceId,
        userId: authUserId,
        dataSourceId,
        name: dataSource.name,
    });

    // when a dashboard parent is toggled, cascade to all of its file children
    // so the whole pipeline flips state together. failures on individual
    // children are non-fatal - the parent state still wins via guards.
    if (isParentSourceType(dataSource.sourceType)) {
        try {
            const children = await dataSourceRepo.findChildrenByParent(workspaceId, dataSourceId);
            await Promise.all(
                children.map((child) =>
                    dataSourceRepo
                        .updateDataSourceEnabled(workspaceId, child.dataSourceId, enabled)
                        .catch((err) =>
                            console.error(
                                `[crud] cascade toggle failed for child ${child.dataSourceId}:`,
                                err
                            )
                        )
                )
            );
        } catch (err) {
            console.error("[crud] cascade toggle: failed to load children:", err);
        }
    }

    return updated;
}

module.exports = {
    createRemoteDataSource,
    createLocalDataSource,
    activateDataSource,
    getLocalDataSourceUploadUrl,
    getDataSourceInWorkspace,
    getDataSourcesInWorkspace,
    deleteDataSourceInWorkspace,
    toggleDataSourceEnabled,
};
