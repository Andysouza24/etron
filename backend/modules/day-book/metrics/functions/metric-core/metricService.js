// Author(s): Rhys Cleary

const metricRepo = require("@etron/day-book-shared/repositories/metricRepository");
const dataSourceRepo = require("@etron/day-book-shared/repositories/dataSourceRepository");
const { notifyMetricUpdate } = require("@etron/day-book-shared/utils/notifyMetricUpdate");
const { getUploadUrl, getDownloadUrl } = require("@etron/metrics-shared/repositories/metricsBucketRepository");
const { hasPermission } = require("@etron/shared/utils/permissions");
const { validateWorkspaceId } = require("@etron/shared/utils/validation");
const {v4 : uuidv4} = require('uuid');
const { logAuditEvent } = require("@etron/shared/utils/auditLogger");
const { GetObjectCommand, PutObjectCommand, ListObjectsV2Command, DeleteObjectsCommand, NoSuchKey, S3Client, S3ServiceException } = require("@aws-sdk/client-s3");
const s3Client = new S3Client({});
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

// Permissions for this service
const PERMISSIONS = {
    VIEW_METRICS: "modules.daybook.metrics.view_metrics",
    MANAGE_METRICS: "modules.daybook.metrics.manage_metrics",
};

function handleS3Error(error, message) {
    if (error instanceof S3ServiceException) {
        console.error(`${message}:`, error);
        throw new Error(message);
    } else {
        throw error;
    }
}

async function getFileUrl(key, { ContentType }) { 
    try {
        const command = new PutObjectCommand({
            Bucket: "etron-metrics",
            Key: key,
            ContentType
        });

        return await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    } catch (error) {
        handleS3Error(error, `Error getting upload url from ${bucketName}`);
    }
}

async function createMetricInWorkspace(authUserId, payload) {
    const workspaceId = payload.workspaceId;
    await validateWorkspaceId(workspaceId);

    const isAuthorised = await hasPermission(authUserId, workspaceId, PERMISSIONS.MANAGE_METRICS);

    if (!isAuthorised) {
        throw new Error("User does not have permission to perform action");
    }

    const { name, dataSourceId, config } = payload;

    const metricId = uuidv4();
    const date = new Date().toISOString();

    // create metric item and store in repo 
    const metricItem = {
        workspaceId: workspaceId,
        metricId: metricId,
        dataSourceId: dataSourceId,
        activeDataSource: true,
        name: name,
        config: config,
        createdAt: date,
        createdBy: authUserId,
        updatedAt: date
    };

    const fileKey = `workspaces/${workspaceId}/metrics/${metricId}/metric.png`;
    const thumbnailKey = `workspaces/${workspaceId}/day-book/metrics/${metricId}/thumbnail.jpeg`;

    metricItem.thumbnailKey = thumbnailKey;

    const fileUploadUrl = await getFileUrl(fileKey, { 
        ContentType: "image/png"
    });

    const thumbnailUrl = await getUploadUrl(thumbnailKey, {
        ContentType: "image/jpeg"
    });

    await metricRepo.addMetric(metricItem);

    // add metricId to the associated data source
    await dataSourceRepo.addMetricToDataSource(workspaceId, dataSourceId, metricId);

    // broadcast to subscribers so other devices/users see the new metric
    await notifyMetricUpdate(metricItem, "CREATE");

    // log audit
    await logAuditEvent({
        workspaceId,
        userId: authUserId,
        action: "Created",
        filters: ["modules", "created"],
        module: "daybook",
        itemType: "metric",
        itemId: metricId,
        itemName: name
    });

    return {
        ...metricItem,
        fileUploadUrl,
        thumbnailUrl
    };
}

async function updateMetricInWorkspace(authUserId, metricId, payload) {
    const workspaceId = payload.workspaceId;
    await validateWorkspaceId(workspaceId);

    const isAuthorised = await hasPermission(authUserId, workspaceId, PERMISSIONS.MANAGE_METRICS);

    if (!isAuthorised) {
        throw new Error("User does not have permission to perform action");
    }

    const metric = await metricRepo.getMetricById(workspaceId, metricId);

    if (!metric) {
        throw new Error("The metric does not exist");
    }

    const { name, dataSourceId, config } = payload;
    
    // create metric item and store in repo 
    const metricItem = {
        name: name,
        dataSourceId: dataSourceId,
        config: config
    };

    const thumbnailUploadUrl = await getUploadUrl(metric.thumbnailKey, {
        ContentType: "image/jpeg"
    });

    const updatedMetric = await metricRepo.updateMetric(workspaceId, metricId, metricItem);

    // update data source to active
    await metricRepo.updateMetricDataSourceStatus(workspaceId, metricId, true);

    const thumbnailUrl = await getDownloadUrl(metric.thumbnailKey);

    // broadcast to subscribers so other devices/users see the updated metric
    await notifyMetricUpdate({
        workspaceId,
        metricId,
        name: updatedMetric?.name ?? name,
        dataSourceId: updatedMetric?.dataSourceId ?? dataSourceId,
        activeDataSource: true,
        config: updatedMetric?.config ?? config,
        thumbnailKey: metric.thumbnailKey,
        createdAt: updatedMetric?.createdAt ?? metric.createdAt,
        updatedAt: updatedMetric?.updatedAt ?? new Date().toISOString(),
        createdBy: updatedMetric?.createdBy ?? metric.createdBy,
        metricType: updatedMetric?.metricType ?? metric.metricType,
        sourceMetrics: updatedMetric?.sourceMetrics ?? metric.sourceMetrics,
        calculation: updatedMetric?.calculation ?? metric.calculation,
        aggregationMethod: updatedMetric?.aggregationMethod ?? metric.aggregationMethod,
        trendDirection: updatedMetric?.trendDirection ?? metric.trendDirection,
    }, "UPDATE");

    // log audit
    await logAuditEvent({
        workspaceId,
        userId: authUserId,
        action: "Updated",
        filters: ["modules", "created"],
        module: "daybook",
        itemType: "metric",
        itemId: metricId,
        itemName: updatedMetric.name
    });

    return {
        ...updatedMetric,
        thumbnailUrl,
        thumbnailUploadUrl
    }
}

async function getMetricInWorkspace(authUserId, workspaceId, metricId) {
    await validateWorkspaceId(workspaceId);

    const isAuthorised = await hasPermission(authUserId, workspaceId, PERMISSIONS.VIEW_METRICS);

    if (!isAuthorised) {
        throw new Error("User does not have permission to perform action");
    }

    const metric = await metricRepo.getMetricById(workspaceId, metricId);

    if (!metric) {
        return null;
    }

    return metric;
}

async function getMetricsInWorkspace(authUserId, workspaceId) {
    await validateWorkspaceId(workspaceId);

    const isAuthorised = await hasPermission(authUserId, workspaceId, PERMISSIONS.VIEW_METRICS);

    if (!isAuthorised) {
        throw new Error("User does not have permission to perform action");
    }

    // get metrics by workspace id
    return metricRepo.getMetricsByWorkspaceId(workspaceId);
}

async function deleteMetricInWorkspace(authUserId, workspaceId, metricId) {
    await validateWorkspaceId(workspaceId);
    
    const isAuthorised = await hasPermission(authUserId, workspaceId, PERMISSIONS.MANAGE_METRICS);

    if (!isAuthorised) {
        throw new Error("User does not have permission to perform action");
    }

    // get metric
    const metric = await metricRepo.getMetricById(workspaceId, metricId);

    if (!metric) {
        throw new Error("Metric not found");
    }

    // remove the metric from the associated data source
    await dataSourceRepo.removeMetricFromDataSource(workspaceId, metric.dataSourceId, metric.metricId);

    // remove metric from repo
    await metricRepo.removeMetric(workspaceId, metricId);

    // broadcast deletion to subscribers so other devices/users remove this metric from their list
    await notifyMetricUpdate(metric, "DELETE"); //TODO: fix, metric deletion not working

    // log audit
    await logAuditEvent({
        workspaceId,
        userId: authUserId,
        action: "Deleted",
        filters: ["modules", "deleted"],
        module: "daybook",
        itemType: "metric",
        itemId: metricId,
        itemName: metric.name
    });

    return {message: "Metric successfully deleted"};
}

async function getMetricsByDataSourceInWorkspace(authUserId, workspaceId, dataSourceId) {
    await validateWorkspaceId(workspaceId);
    const isAuthorised = await hasPermission(authUserId, workspaceId, PERMISSIONS.VIEW_METRICS);

    if (!isAuthorised) {
        throw new Error("User does not have permission to perform action");
    }

    const allMetrics = await metricRepo.getMetricsByWorkspaceId(workspaceId);
    const filtered = allMetrics.filter(m => m.dataSourceId === dataSourceId);

    return filtered;
}

module.exports = {
    createMetricInWorkspace,
    updateMetricInWorkspace,
    getMetricInWorkspace,
    getMetricsInWorkspace,
    getMetricsByDataSourceInWorkspace,
    deleteMetricInWorkspace
};
