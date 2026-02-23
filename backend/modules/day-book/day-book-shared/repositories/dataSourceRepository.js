// Author(s): Rhys Cleary
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { 
    DynamoDBDocumentClient, 
    PutCommand, 
    GetCommand, 
    DeleteCommand, 
    UpdateCommand,
    QueryCommand,
    BatchWriteCommand 
} = require("@aws-sdk/lib-dynamodb");

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
async function updateDataSourceStatus(workspaceId, dataSourceId, statusItem) {
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

    updateFields.push("#lastUpdate = :lastUpdate");
    expressionAttributeValues[":lastUpdate"] = new Date().toISOString();
    expressionAttributeNames["#lastUpdate"] = "lastUpdate";

    let updateExpression = "SET " + updateFields.join(", ");
    if (removeFields.length > 0) {
        updateExpression += " REMOVE " + removeFields.join(", ");
    }

    await dynamoDB.send(
        new UpdateCommand( {
            TableName: tableName,
            Key: {
                workspaceId: workspaceId,
                dataSourceId: dataSourceId
            },
            UpdateExpression: updateExpression,
            ExpressionAttributeValues: expressionAttributeValues,
            ExpressionAttributeNames: expressionAttributeNames,
        })
    );
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

module.exports = {
    addDataSource,
    updateDataSource,
    removeDataSource,
    getDataSourceById,
    getDataSourcesByWorkspaceId,
    updateDataSourceStatus,
    addMetricToDataSource,
    removeMetricFromDataSource,
    removeAllDataSources
}