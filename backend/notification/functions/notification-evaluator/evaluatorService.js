const https = require("https");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand } = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

// look up all push tokens for a user
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

// send push notification via Expo push API
async function sendPushNotification({ userId, title, body, data = {} }) {
    const tokens = await getUserPushTokens(userId);
    if (tokens.length === 0) return { sent: 0 };

    const messages = tokens.map((token) => ({
        to: token,
        sound: "default",
        title,
        body,
        data, // e.g. { screen: "/(auth)/metric-detail", params: { metricId: "..." } }
    }));

    const payload = JSON.stringify(messages);

    const result = await new Promise((resolve, reject) => {
        const req = https.request(
            {
                hostname: "exp.host",
                path: "/--/api/v2/push/send",
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Content-Length": Buffer.byteLength(payload),
                },
            },
            (res) => {
                let data = "";
                res.on("data", (chunk) => (data += chunk));
                res.on("end", () => resolve(JSON.parse(data)));
            }
        );
        req.on("error", reject);
        req.write(payload);
        req.end();
    });

    return { sent: messages.length, result };
}

// main evaluation entry point — placeholder for threshold logic
async function evaluate(params) {
    // TODO: implement threshold evaluation
    // future flow:
    //   1. query metrics that have thresholds configured
    //   2. compare current values against thresholds
    //   3. for each breach, call sendPushNotification()
    //
    // example usage when thresholds are implemented:
    //   await sendPushNotification({
    //       userId: "user-uuid",
    //       title: "Metric Alert",
    //       body: "Revenue dropped below $10,000",
    //       data: { screen: "/(auth)/metric-detail", params: { metricId: "..." } },
    //   });

    return { message: "Evaluation complete", evaluated: 0 };
}

module.exports = { evaluate, sendPushNotification, getUserPushTokens };