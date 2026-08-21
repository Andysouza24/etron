// Author(s): Rhys Cleary, Holly Wyatt
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

const tableName = "Metrics";

// add metric
async function addMetric(metricItem) {
    await dynamoDB.send(
        new PutCommand( {
            TableName: tableName,
            Item: metricItem
        })
    );
}

// update metric
async function updateMetric(workspaceId, metricId, metricItem) {
    const updateFields = [];
    const expressionAttributeValues = {};
    const expressionAttributeNames = {};

    if (metricItem.name !== undefined) {
        updateFields.push("#name = :name");
        expressionAttributeValues[":name"] = metricItem.name;
        expressionAttributeNames["#name"] = "name";
    }

    if (metricItem.dataSourceId !== undefined) {
        updateFields.push("#dataSourceId = :dataSourceId");
        expressionAttributeValues[":dataSourceId"] = metricItem.dataSourceId;
        expressionAttributeNames["#dataSourceId"] = "dataSourceId";
    }

    if (metricItem.config !== undefined) {
        updateFields.push("#config = :config");
        expressionAttributeValues[":config"] = metricItem.config;
        expressionAttributeNames["#config"] = "config";
    }

    if (metricItem.metricType !== undefined) {
        updateFields.push("#metricType = :metricType");
        expressionAttributeValues[":metricType"] = metricItem.metricType;
        expressionAttributeNames["#metricType"] = "metricType";
    }

    if (metricItem.sourceMetrics !== undefined) {
        updateFields.push("#sourceMetrics = :sourceMetrics");
        expressionAttributeValues[":sourceMetrics"] = metricItem.sourceMetrics;
        expressionAttributeNames["#sourceMetrics"] = "sourceMetrics";
    }

    if (metricItem.calculation !== undefined) {
        updateFields.push("#calculation = :calculation");
        expressionAttributeValues[":calculation"] = metricItem.calculation;
        expressionAttributeNames["#calculation"] = "calculation";
    }

    if (metricItem.aggregationMethod !== undefined) {
        updateFields.push("#aggregationMethod = :aggregationMethod");
        expressionAttributeValues[":aggregationMethod"] = metricItem.aggregationMethod;
        expressionAttributeNames["#aggregationMethod"] = "aggregationMethod";
    }

    if (metricItem.trendDirection !== undefined) {
        updateFields.push("#trendDirection = :trendDirection");
        expressionAttributeValues[":trendDirection"] = metricItem.trendDirection;
        expressionAttributeNames["#trendDirection"] = "trendDirection";
    }

    updateFields.push("#updatedAt = :updatedAt");
    expressionAttributeValues[":updatedAt"] = new Date().toISOString();
    expressionAttributeNames["#updatedAt"] = "updatedAt";

    const result = await dynamoDB.send(
        new UpdateCommand( {
            TableName: tableName,
            Key: {
                workspaceId: workspaceId,
                metricId: metricId
            },
            UpdateExpression: "SET " + updateFields.join(", "),
            ExpressionAttributeValues: expressionAttributeValues,
            ExpressionAttributeNames: expressionAttributeNames,
            ReturnValues: "ALL_NEW"
        })
    );

    return result;
}

// update metric data source status
async function updateMetricDataSourceStatus(workspaceId, metricId, isActive) {
    const updateFields = [];
    const expressionAttributeValues = {};
    const expressionAttributeNames = {};

    // update the activeDataSource flag
    updateFields.push("#activeDataSource = :activeDataSource");
    expressionAttributeValues[":activeDataSource"] = isActive;
    expressionAttributeNames["#activeDataSource"] = "activeDataSource";

    // update the updatedAt timestamp
    updateFields.push("#updatedAt = :updatedAt");
    expressionAttributeValues[":updatedAt"] = new Date().toISOString();
    expressionAttributeNames["#updatedAt"] = "updatedAt";

    const result = await dynamoDB.send(
        new UpdateCommand( {
            TableName: tableName,
            Key: {
                workspaceId: workspaceId,
                metricId: metricId
            },
            UpdateExpression: "SET " + updateFields.join(", "),
            ExpressionAttributeValues: expressionAttributeValues,
            ExpressionAttributeNames: expressionAttributeNames,
            ReturnValues: "ALL_NEW"
        })
    );

    return result;
}

// remove metric
async function removeMetric(workspaceId, metricId) {
    await dynamoDB.send(
        new DeleteCommand( {
            TableName: tableName,
            Key: {
                workspaceId: workspaceId,
                metricId: metricId
            },
        })
    );
}

// remove all the metrics
async function removeAllMetrics(workspaceId) {
    const { Items } = await dynamoDB.send(new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: "workspaceId = :workspaceId",
        ExpressionAttributeValues: { ":workspaceId": workspaceId }
    }));

    if (!Items || Items.length === 0) return;

    // batch delete the items
    const deleteRequests = Items.map(item => ({
        DeleteRequest: { Key: { workspaceId, metricId: item.metricId } }
    }));

    for (let i = 0; i < deleteRequests.length; i += 25) {
        const batch = deleteRequests.slice(i, i + 25);
        await dynamoDB.send(new BatchWriteCommand({
            RequestItems: { [tableName]: batch }
        }));
  }
}

// get metric by id
async function getMetricById(workspaceId, metricId) {
    const result = await dynamoDB.send(
        new GetCommand({
            TableName: tableName,
            Key: {
                workspaceId: workspaceId,
                metricId: metricId
            }
        })
    );
    
    return result.Item;
}

// get the variables of a metric
async function getMetricVariableNames(workspaceId, metricId) {
    const result = await getMetricById(workspaceId, metricId);
    const variables = [
        ...result.config.dependentVariables,
        result.config.independentVariable
    ];
    if (result.config.dimensionField) {
        variables.push(result.config.dimensionField);
    }
    return variables;
}

// get metrics by workspaceId
async function getMetricsByWorkspaceId(workspaceId) {
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
    addMetric,
    updateMetric,
    updateMetricDataSourceStatus,
    removeMetric,
    getMetricById,
    getMetricVariableNames,
    getMetricsByWorkspaceId,
    removeAllMetrics
}