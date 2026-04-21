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

const {
    PERMISSIONS,
    requirePermission,
    resolveAndValidateAdapter,
    auditDataSource,
} = require("./helpers");

function validateCommonCreateFields({ name, method, expiry }) {
    if (!name || typeof name !== "string") {
        throw new Error("Please specify a type of data source");
    }
    if (method && !["overwrite", "extend"].includes(method)) {
        throw new Error("Please specify the method 'overwrite' or 'extend'");
    }
    if (method === "extend" && expiry && typeof expiry !== "object") {
        throw new Error("Expiry is not in the correct format");
    }
}

async function createRemoteDataSource(authUserId, payload) {
    const workspaceId = payload.workspaceId;
    await validateWorkspaceId(workspaceId);
    await requirePermission(authUserId, workspaceId, PERMISSIONS.MANAGE_DATASOURCES);

    const { name, sourceType, method, expiry, config, secrets } = payload;
    validateCommonCreateFields({ name, method, expiry });

    resolveAndValidateAdapter(sourceType, { config, secrets });

    const dataSourceId = uuidv4();
    const date = new Date().toISOString();

    const dataSourceItem = {
        workspaceId,
        dataSourceId,
        name,
        sourceType,
        method: method || "overwrite",
        expiry: expiry || null,
        status: "active",
        createdBy: authUserId,
        config,
        createdAt: date,
        lastUpdate: date,
        associatedMetrics: [],
    };

    await dataSourceRepo.addDataSource(dataSourceItem);
    await dataSourceSecretsRepo.saveSecrets(workspaceId, dataSourceId, secrets);

    // try triggering the polling lambda (best-effort)
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

    await auditDataSource({
        action: "Created",
        filter: "created",
        workspaceId,
        userId: authUserId,
        dataSourceId,
        name,
    });

    return { ...dataSourceItem, secrets };
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

    await removeAllStoredData(workspaceId, dataSourceId);

    // set metrics associated with the data source to not active
    if (dataSource.metrics && dataSource.metrics.length > 0) {
        await Promise.all(
            dataSource.metrics.map(metricId =>
                metricRepo.updateMetricDataSourceStatus(workspaceId, metricId, false)
            )
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

    return { message: "Data source successfully deleted" };
}

module.exports = {
    createRemoteDataSource,
    createLocalDataSource,
    getLocalDataSourceUploadUrl,
    getDataSourceInWorkspace,
    getDataSourcesInWorkspace,
    deleteDataSourceInWorkspace,
};
