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
};