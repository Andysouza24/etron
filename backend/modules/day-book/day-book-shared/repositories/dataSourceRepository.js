// Author(s): Rhys Cleary
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { 
    DynamoDBDocumentClient, 
    PutCommand, 
    GetCommand, 
    DeleteCommand, 
    UpdateCommand,
    QueryCommand,
    ScanCommand,
    BatchWriteCommand 
} = require("@aws-sdk/lib-dynamodb");
const { notifyDataSourceUpdate } = require("../utils/notifyDataSourceUpdate");

const dynamoDB = DynamoDBDocumentClient.from(new DynamoDBClient());

const tableName = "DataSources";

// add datasource
async function addDataSource(dataSourceItem) {
    await dynamoDB.send(
        new PutCommand( {
            TableName: tableName,
            Item: dataSourceItem
        })
    );
}

// add metric to data source
async function addMetricToDataSource(workspaceId, dataSourceId, metricId) {
    const result = await dynamoDB.send(
        new UpdateCommand( {
            TableName: tableName,
            Key: {
                workspaceId: workspaceId,
                dataSourceId: dataSourceId
            },
            UpdateExpression: `
                SET #metrics = list_append(if_not_exists(#metrics, :empty), :metric),
                    #lastUpdate = :lastUpdate
            `,
            ExpressionAttributeNames: { "#metrics": "metrics", "#lastUpdate": "lastUpdate" },
            ExpressionAttributeValues: {
                ":metric": [metricId],
                ":empty": [],
                ":lastUpdate": new Date().toISOString()
            },
            ReturnValues: "ALL_NEW"
        })
    );

    return result.Attributes;
}

// remove metric from data source
async function removeMetricFromDataSource(workspaceId, dataSourceId, metricId) {
    const getResult = await dynamoDB.send(
        new GetCommand({
            TableName: tableName,
            Key: {
                workspaceId: workspaceId,
                dataSourceId: dataSourceId
            },
            ProjectionExpression: "#metrics",
            ExpressionAttributeNames: { "#metrics": "metrics" }
        })
    );

    const metrics = getResult.Item?.metrics || [];
    const index = metrics.indexOf(metricId);

    if (index === -1) {
        throw new Error(`Metric ${metricId} not found in this dataSource ${dataSourceId}`);
    }

    const updateResult = await dynamoDB.send(
        new UpdateCommand( {
            TableName: tableName,
            Key: {
                workspaceId: workspaceId,
                dataSourceId: dataSourceId
            },
            UpdateExpression: `
                REMOVE #metrics[${index}]
                SET #lastUpdate = :lastUpdate
            `,
            ExpressionAttributeNames: { "#metrics": "metrics", "#lastUpdate": "lastUpdate" },
            ExpressionAttributeValues: {
                ":lastUpdate": new Date().toISOString()
            },
            ReturnValues: "ALL_NEW"
        })
    );

    return updateResult.Attributes;
}

// update datasource
async function updateDataSource(workspaceId, dataSourceId, dataSourceItem) {
    const updateFields = [];
    const expressionAttributeValues = {};
    const expressionAttributeNames = {};

    if (dataSourceItem.name !== undefined) {
        updateFields.push("#name = :name");
        expressionAttributeValues[":name"] = dataSourceItem.name;
        expressionAttributeNames["#name"] = "name";
    }

    if (dataSourceItem.config !== undefined) {
        updateFields.push("#config = :config");
        expressionAttributeValues[":config"] = dataSourceItem.config;
        expressionAttributeNames["#config"] = "config";
    }

    updateFields.push("#lastUpdate = :lastUpdate");
    expressionAttributeValues[":lastUpdate"] = new Date().toISOString();
    expressionAttributeNames["#lastUpdate"] = "lastUpdate";

    const result = await dynamoDB.send(
        new UpdateCommand( {
            TableName: tableName,
            Key: {
                workspaceId: workspaceId,
                dataSourceId: dataSourceId
            },
            UpdateExpression: "SET " + updateFields.join(", "),
            ExpressionAttributeValues: expressionAttributeValues,
            ExpressionAttributeNames: expressionAttributeNames,
            ReturnValues: "ALL_NEW"
        })
    );

    return result.Attributes;
}

// update datasource status
// pass { silent: true } to skip the AppSync broadcast (e.g. during bulk dashboard setup so subscribers aren't spammed with per-child updates)
async function updateDataSourceStatus(workspaceId, dataSourceId, statusItem, { silent = false } = {}) {
    const updateFields = [];
    const removeFields = [];
    const expressionAttributeValues = {};
    const expressionAttributeNames = {};

    updateFields.push("#status = :status");
    expressionAttributeValues[":status"] = statusItem.status;
    expressionAttributeNames["#status"] = "status";

    // Only set error if there's an actual error message, otherwise remove it
    if (statusItem.errorMessage) {
        updateFields.push("#error = :error");
        expressionAttributeValues[":error"] = statusItem.errorMessage;
        expressionAttributeNames["#error"] = "error";
    } else {
        removeFields.push("#error");
        expressionAttributeNames["#error"] = "error";
    }


    // progress fields
    // pass progress stage/progress percent so UI can show progress bar
    if (statusItem.status === "processing") {
        if (statusItem.progressStage !== undefined) {
            updateFields.push("#progressStage = :progressStage");
            expressionAttributeValues[":progressStage"] = statusItem.progressStage;
            expressionAttributeNames["#progressStage"] = "progressStage";
        }
        if (statusItem.progressPercent !== undefined) {
            updateFields.push("#progressPercent = :progressPercent");
            expressionAttributeValues[":progressPercent"] = statusItem.progressPercent;
            expressionAttributeNames["#progressPercent"] = "progressPercent";
        }
    } else {
        removeFields.push("#progressStage", "#progressPercent");
        expressionAttributeNames["#progressStage"] = "progressStage";
        expressionAttributeNames["#progressPercent"] = "progressPercent";
    }

    // requiresReview flag: surfaces "schema needs review" in the UI 
    // callers pass `true` to set the flag, `false` to clear it, or omit the field to leave it untouched
    if (statusItem.requiresReview === true) {
        updateFields.push("#requiresReview = :requiresReview");
        expressionAttributeValues[":requiresReview"] = true;
        expressionAttributeNames["#requiresReview"] = "requiresReview";
    } else if (statusItem.requiresReview === false) {
        removeFields.push("#requiresReview");
        expressionAttributeNames["#requiresReview"] = "requiresReview";
    }

    // errorType: classifies an error status so the UI can show "Schema drift",
    // "Processing error", etc. instead of a generic error chip. Cleared whenever
    // status is not 'error'. Callers can also explicitly clear by passing null.
    if (statusItem.status === "error" && statusItem.errorType !== undefined && statusItem.errorType !== null) {
        updateFields.push("#errorType = :errorType");
        expressionAttributeValues[":errorType"] = statusItem.errorType;
        expressionAttributeNames["#errorType"] = "errorType";
    } else if (statusItem.status !== "error" || statusItem.errorType === null) {
        removeFields.push("#errorType");
        expressionAttributeNames["#errorType"] = "errorType";
    }

    updateFields.push("#lastUpdate = :lastUpdate");
    expressionAttributeValues[":lastUpdate"] = new Date().toISOString();
    expressionAttributeNames["#lastUpdate"] = "lastUpdate";

    let updateExpression = "SET " + updateFields.join(", ");
    if (removeFields.length > 0) {
        updateExpression += " REMOVE " + removeFields.join(", ");
    }

    const result = await dynamoDB.send(
        new UpdateCommand( {
            TableName: tableName,
            Key: {
                workspaceId: workspaceId,
                dataSourceId: dataSourceId
            },
            UpdateExpression: updateExpression,
            ExpressionAttributeValues: expressionAttributeValues,
            ExpressionAttributeNames: expressionAttributeNames,
            ReturnValues: "ALL_NEW",
        })
    );

    // broadcasts new state so subscription picks up status/progress transitions without polling
    if (result.Attributes && !silent) {
        await notifyDataSourceUpdate(result.Attributes);
    }
    return result.Attributes;
}

// update progress fields without changing status
// used to publish stage updates while job is in flight 
// pass { silent: true } to skip the AppSync broadcast
async function updateDataSourceProgress(workspaceId, dataSourceId, { stage, percent }, { silent = false } = {}) {
    const expressionAttributeValues = { ":lastUpdate": new Date().toISOString() };
    const expressionAttributeNames = { "#lastUpdate": "lastUpdate" };
    const updateFields = ["#lastUpdate = :lastUpdate"];

    if (stage !== undefined) {
        updateFields.push("#progressStage = :progressStage");
        expressionAttributeValues[":progressStage"] = stage;
        expressionAttributeNames["#progressStage"] = "progressStage";
    }
    if (percent !== undefined) {
        updateFields.push("#progressPercent = :progressPercent");
        expressionAttributeValues[":progressPercent"] = percent;
        expressionAttributeNames["#progressPercent"] = "progressPercent";
    }

    try {
        const result = await dynamoDB.send(
            new UpdateCommand({
                TableName: tableName,
                Key: { workspaceId, dataSourceId },
                UpdateExpression: "SET " + updateFields.join(", "),
                ExpressionAttributeValues: expressionAttributeValues,
                ExpressionAttributeNames: expressionAttributeNames,
                ReturnValues: "ALL_NEW",
            })
        );

        // broadcasts new progress
        if (result.Attributes && !silent) {
            await notifyDataSourceUpdate(result.Attributes);
        }
        return result.Attributes;
    } catch (err) {
        // Progress updates are best-effort: never fail processing because of them.
        console.warn(`[dataSourceRepo] updateDataSourceProgress failed for ${workspaceId}/${dataSourceId}:`, err.message);
        return null;
    }
}

// initialise the dashboard setup counters on the parent data source
// total = how many child files are queued for transform as part of this setup run
// completed is reset to 0 so a re-discovery starts a fresh batch
async function initDashboardSetupCounters(workspaceId, parentDataSourceId, total) {
    const result = await dynamoDB.send(
        new UpdateCommand({
            TableName: tableName,
            Key: { workspaceId, dataSourceId: parentDataSourceId },
            UpdateExpression: "SET #setupTotal = :total, #setupCompleted = :zero, #progressStage = :stage, #progressPercent = :percent, #lastUpdate = :lastUpdate",
            ExpressionAttributeNames: {
                "#setupTotal": "setupTotal",
                "#setupCompleted": "setupCompleted",
                "#progressStage": "progressStage",
                "#progressPercent": "progressPercent",
                "#lastUpdate": "lastUpdate",
            },
            ExpressionAttributeValues: {
                ":total": total,
                ":zero": 0,
                ":stage": total > 0 ? `Importing 0 of ${total} files` : "Setup complete",
                ":percent": 0,
                ":lastUpdate": new Date().toISOString(),
            },
            ReturnValues: "ALL_NEW",
        })
    );
    if (result.Attributes) {
        await notifyDataSourceUpdate(result.Attributes);
    }
    return result.Attributes;
}

// atomically increments the parent's setupCompleted counter and broadcasts an aggregated progress update
// used by the dashboard transform pipeline so subscribers only see one notification per file completion on the parent
async function bumpDashboardSetupProgress(workspaceId, parentDataSourceId) {
    try {
        const result = await dynamoDB.send(
            new UpdateCommand({
                TableName: tableName,
                Key: { workspaceId, dataSourceId: parentDataSourceId },
                UpdateExpression: "ADD #setupCompleted :one SET #lastUpdate = :lastUpdate",
                ExpressionAttributeNames: {
                    "#setupCompleted": "setupCompleted",
                    "#lastUpdate": "lastUpdate",
                },
                ExpressionAttributeValues: {
                    ":one": 1,
                    ":lastUpdate": new Date().toISOString(),
                },
                ReturnValues: "ALL_NEW",
            })
        );
        const attrs = result.Attributes || {};
        const completed = Number(attrs.setupCompleted) || 0;
        const total = Number(attrs.setupTotal) || 0;
        const stage = total > 0 ? `Imported ${completed} of ${total} files` : `Imported ${completed} files`;
        const percent = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : null;
        await notifyDataSourceUpdate({ ...attrs, progressStage: stage, progressPercent: percent });
        return attrs;
    } catch (err) {
        console.warn(`[dataSourceRepo] bumpDashboardSetupProgress failed for ${workspaceId}/${parentDataSourceId}:`, err.message);
        return null;
    }
}

// remove datasource
async function removeDataSource(workspaceId, dataSourceId) {
    await dynamoDB.send(
        new DeleteCommand( {
            TableName: tableName,
            Key: {
                workspaceId: workspaceId,
                dataSourceId: dataSourceId
            },
        })
    );
}

// remove all the data sources
async function removeAllDataSources(workspaceId) {
    const { Items } = await dynamoDB.send(new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: "workspaceId = :workspaceId",
        ExpressionAttributeValues: { ":workspaceId": workspaceId }
    }));

    if (!Items || Items.length === 0) return;

    // batch delete the items
    const deleteRequests = Items.map(item => ({
        DeleteRequest: { Key: { workspaceId, dataSourceId: item.dataSourceId } }
    }));

    for (let i = 0; i < deleteRequests.length; i += 25) {
        const batch = deleteRequests.slice(i, i + 25);
        await dynamoDB.send(new BatchWriteCommand({
            RequestItems: { [tableName]: batch }
        }));
  }
}


// get datasource by id
async function getDataSourceById(workspaceId, dataSourceId) {
    const result = await dynamoDB.send(
        new GetCommand({
            TableName: tableName,
            Key: {
                workspaceId: workspaceId,
                dataSourceId: dataSourceId
            }
        })
    );
    
    return result.Item;
}

// get data sources by workspaceId
async function getDataSourcesByWorkspaceId(workspaceId) {
    const result = await dynamoDB.send(
        new QueryCommand({
            TableName: tableName,
            KeyConditionExpression: "workspaceId = :workspaceId",
            ExpressionAttributeValues: {
                ":workspaceId": workspaceId
            }
        })
    );

    return result.Items;
}

// finds every data source whose `sourceType === sourceType` and `config.fileName === fileName`.
// uses a paginated scan since there's no GSI on config fields. low-volume callers only.
async function findDataSourcesBySourceTypeAndFileName(sourceType, fileName) {
    const matches = [];
    let ExclusiveStartKey;

    do {
        const result = await dynamoDB.send(
            new ScanCommand({
                TableName: tableName,
                FilterExpression: "#sourceType = :sourceType AND #config.#fileName = :fileName",
                ExpressionAttributeNames: {
                    "#sourceType": "sourceType",
                    "#config": "config",
                    "#fileName": "fileName",
                },
                ExpressionAttributeValues: {
                    ":sourceType": sourceType,
                    ":fileName": fileName,
                },
                ExclusiveStartKey,
            })
        );

        if (result.Items) matches.push(...result.Items);
        ExclusiveStartKey = result.LastEvaluatedKey;
    } while (ExclusiveStartKey);

    return matches;
}

// finds every data source with the given sourceType. paginated scan; low-volume callers only.
async function findDataSourcesBySourceType(sourceType) {
    const matches = [];
    let ExclusiveStartKey;

    do {
        const result = await dynamoDB.send(
            new ScanCommand({
                TableName: tableName,
                FilterExpression: "#sourceType = :sourceType",
                ExpressionAttributeNames: { "#sourceType": "sourceType" },
                ExpressionAttributeValues: { ":sourceType": sourceType },
                ExclusiveStartKey,
            })
        );

        if (result.Items) matches.push(...result.Items);
        ExclusiveStartKey = result.LastEvaluatedKey;
    } while (ExclusiveStartKey);

    return matches;
}

// finds children of a parent (workspaceId-scoped query + filter on parentDataSourceId).
async function findChildrenByParent(workspaceId, parentDataSourceId) {
    const result = await dynamoDB.send(
        new QueryCommand({
            TableName: tableName,
            KeyConditionExpression: "workspaceId = :workspaceId",
            FilterExpression: "#config.#parentId = :parentId",
            ExpressionAttributeNames: {
                "#config": "config",
                "#parentId": "parentDataSourceId",
            },
            ExpressionAttributeValues: {
                ":workspaceId": workspaceId,
                ":parentId": parentDataSourceId,
            },
        })
    );
    return result.Items || [];
}

// flip the `enabled` flag on a data source
// `enabled === false` is the user-disabled state: background ingest continues but every
// user-initiated action is rejected. omitting the attribute is equivalent to enabled.
async function updateDataSourceEnabled(workspaceId, dataSourceId, enabled) {
    const result = await dynamoDB.send(
        new UpdateCommand({
            TableName: tableName,
            Key: { workspaceId, dataSourceId },
            UpdateExpression: "SET #enabled = :enabled, #lastUpdate = :lastUpdate",
            ExpressionAttributeNames: {
                "#enabled": "enabled",
                "#lastUpdate": "lastUpdate",
            },
            ExpressionAttributeValues: {
                ":enabled": !!enabled,
                ":lastUpdate": new Date().toISOString(),
            },
            ReturnValues: "ALL_NEW",
        })
    );

    if (result.Attributes) {
        await notifyDataSourceUpdate(result.Attributes);
    }
    return result.Attributes;
}

module.exports = {
    addDataSource,
    updateDataSource,
    updateDataSourceEnabled,
    removeDataSource,
    getDataSourceById,
    getDataSourcesByWorkspaceId,
    findDataSourcesBySourceTypeAndFileName,
    findDataSourcesBySourceType,
    findChildrenByParent,
    updateDataSourceStatus,
    updateDataSourceProgress,
    initDashboardSetupCounters,
    bumpDashboardSetupProgress,
    addMetricToDataSource,
    removeMetricFromDataSource,
    removeAllDataSources
}