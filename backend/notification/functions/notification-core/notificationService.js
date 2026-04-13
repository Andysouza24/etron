const { randomUUID } = require("crypto");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
    DynamoDBDocumentClient,
    PutCommand,
    DeleteCommand,
    GetCommand,
    QueryCommand,
} = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

async function registerPushToken(userId, { pushToken, platform }) {
    if (!pushToken) throw new Error("pushToken is required");

    await docClient.send(
        new PutCommand({
            TableName: "DevicePushTokens",
            Item: {
                userId,
                pushToken,
                platform: platform || "unknown",
                createdAt: new Date().toISOString(),
            },
        })
    );

    return { message: "Push token registered" };
}

async function removePushToken(userId, { pushToken }) {
    if (!pushToken) throw new Error("pushToken is required");

    await docClient.send(
        new DeleteCommand({
            TableName: "DevicePushTokens",
            Key: { userId, pushToken },
        })
    );

    return { message: "Push token removed" };
}

async function getPreferences(userId) {
    const result = await docClient.send(
        new GetCommand({
            TableName: "NotificationPreferences",
            Key: { userId },
        })
    );

    return result.Item || { userId, enabled: true };
}

async function updatePreferences(userId, preferences) {
    await docClient.send(
        new PutCommand({
            TableName: "NotificationPreferences",
            Item: {
                userId,
                ...preferences,
                updatedAt: new Date().toISOString(),
            },
        })
    );

    return { message: "Preferences updated" };
}

async function createNotification(userId, { title, body, data }) {
    if (!title) throw new Error("title is required");

    const notificationId = randomUUID();
    const createdAt = new Date().toISOString();

    const item = {
        userId,
        notificationId,
        title,
        body: body || "",
        data: data || {},
        read: false,
        createdAt,
    };

    await docClient.send(
        new PutCommand({
            TableName: "UserNotifications",
            Item: item,
        })
    );

    return item;
}

async function getNotifications(userId) {
    const result = await docClient.send(
        new QueryCommand({
            TableName: "UserNotifications",
            IndexName: "createdAt-index",
            KeyConditionExpression: "userId = :uid",
            ExpressionAttributeValues: { ":uid": userId },
            ScanIndexForward: false,
        })
    );

    return result.Items || [];
}

// used by the evaluator to look up tokens when sending
async function getUserPushTokens(userId) {
    const result = await docClient.send(
        new QueryCommand({
            TableName: "DevicePushTokens",
            KeyConditionExpression: "userId = :uid",
            ExpressionAttributeValues: { ":uid": userId },
        })
    );

    return (result.Items || []).map((item) => item.pushToken);
}

module.exports = {
    registerPushToken,
    removePushToken,
    getPreferences,
    updatePreferences,
    getUserPushTokens,
    createNotification,
    getNotifications,
};