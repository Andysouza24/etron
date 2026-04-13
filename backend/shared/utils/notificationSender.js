const { SQSClient, SendMessageCommand } = require("@aws-sdk/client-sqs");

const sqsClient = new SQSClient();

async function sendNotification({ userId, title, body, data = {} }) {
    if (!process.env.NOTIFICATION_QUEUE_URL) {
        console.warn("NOTIFICATION_QUEUE_URL not configured. Skipping notification.");
        return;
    }

    try {
        await sqsClient.send(new SendMessageCommand({
            QueueUrl: process.env.NOTIFICATION_QUEUE_URL,
            MessageBody: JSON.stringify({ userId, title, body, data }),
        }));
        console.log("Sent notification event to SQS");
    } catch (error) {
        console.error("Failed to send notification event:", error);
    }
}

module.exports = { sendNotification };