const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { processUploadedFile } = require('./dashboardRawDataTransformService');

const s3Client = new S3Client({});

async function streamToString(stream) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('error', reject);
        stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    });
}

// SQS-triggered handler. Each message body is JSON: { bucket, key, workspaceId, dataSourceId, defaultSchema?, parentDataSourceId?, silent? }
// fetches the raw JSON file from S3 and runs the standard data-source transform pipeline
exports.handler = async (event) => {
    const failures = [];

    for (const record of event.Records || []) {
        let payload;
        try {
            payload = JSON.parse(record.body);
        } catch (err) {
            console.error('[DashboardRawDataTransform] Invalid SQS message body:', record.body, err);
            failures.push({ itemIdentifier: record.messageId });
            continue;
        }

        const { bucket, key, workspaceId, dataSourceId, defaultSchema, parentDataSourceId, silent } = payload;
        if (!bucket || !key || !workspaceId || !dataSourceId) {
            console.error('[DashboardRawDataTransform] Missing required fields in payload:', payload);
            failures.push({ itemIdentifier: record.messageId });
            continue;
        }

        try {
            console.log(`[DashboardRawDataTransform] Processing s3://${bucket}/${key} for ${workspaceId}/${dataSourceId}`);

            const obj = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
            const rawData = await streamToString(obj.Body);

            await processUploadedFile(workspaceId, dataSourceId, rawData, {
                defaultSchema,
                parentDataSourceId,
                silent: Boolean(silent),
            });

            console.log(`[DashboardRawDataTransform] Done for ${workspaceId}/${dataSourceId}`);
        } catch (err) {
            console.error(
                `[DashboardRawDataTransform] Failed ${workspaceId}/${dataSourceId} (s3://${bucket}/${key}):`,
                err
            );
            failures.push({ itemIdentifier: record.messageId });
        }
    }

    return { batchItemFailures: failures };
};
