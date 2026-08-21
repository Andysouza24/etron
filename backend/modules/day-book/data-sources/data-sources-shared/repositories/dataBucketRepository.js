// Author(s): Rhys Cleary

const { GetObjectCommand, PutObjectCommand, ListObjectsV2Command, DeleteObjectsCommand, NoSuchKey, S3Client, S3ServiceException, HeadObjectCommand } = require("@aws-sdk/client-s3");
const s3Client = new S3Client({});
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { toParquet, fromParquet } = require("../utils/typeConversion");

const bucketName = process.env.WORKSPACE_BUCKET;

function handleS3Error(error, message) {
    if (error instanceof S3ServiceException) {
        console.error(`${message}:`, error);
        throw new Error(message);
    } else {
        throw error;
    }
}

// save data polled for data sources to s3
async function saveStoredData(workspaceId, dataSourceId, data) {
    const date = new Date().toISOString().split('T')[0];
    const key = `workspaces/${workspaceId}/day-book/dataSources/${dataSourceId}/data/${date}.parquet`;

    try {
        let body = data;
        if (data && typeof data.pipe === "function") {
            body = await streamToBuffer(data);
        }

        await s3Client.send(
            new PutObjectCommand({
                Bucket: bucketName,
                Key: key,
                Body: body,
                ContentType: "application/octet-stream"
            }),
        );

    } catch (error) {
        handleS3Error(error, `Error saving data to ${bucketName}`);
    }
}

// save data for a partition to S3
async function savePartitionedData(workspaceId, dataSourceId, data, partitionValue) {
    if (!partitionValue) throw new Error("partitionValue is required");

    // you can customize folder structure if needed
    const key = `workspaces/${workspaceId}/day-book/dataSources/${dataSourceId}/data/${partitionValue}.parquet`;

    try {
        let body = data;
        if (data && typeof data.pipe === "function") {
            body = await streamToBuffer(data);
        }

        await s3Client.send(
            new PutObjectCommand({
                Bucket: bucketName,
                Key: key,
                Body: body,
                ContentType: "application/octet-stream"
            })
        );
    } catch (error) {
        handleS3Error(error, `Error saving partitioned data to ${bucketName}`);
    }
}

// load data from a partition from S3
async function loadPartitionedData(workspaceId, dataSourceId, partitionValue) {
    if (!partitionValue) throw new Error("partitionValue is required");

    // you can customize folder structure if needed
    const key = `workspaces/${workspaceId}/day-book/dataSources/${dataSourceId}/data/${partitionValue}.parquet`;

    try {
        // load schema for data source
        const schema = await getDataSchema(workspaceId, dataSourceId);
        if (!schema) {
            throw new Error(`Schema not found for dataSourceId ${dataSourceId}`);
        }
        const response = await s3Client.send(
            new GetObjectCommand({
                Bucket: bucketName,
                Key: key,
            }),
        );

        const buffer = await streamToBuffer(response.Body);

        // convert parquet buffer to JSON
        const jsonData = await fromParquet(buffer, schema);

        return jsonData;
    } catch (error) {
        if (error.name === "NoSuchKey") {
            return [];
        }
        handleS3Error(error, `Error saving partitioned data to ${bucketName}`);
    }
}

async function doesObjectExist(bucket, key) {
    try {
        await s3Client.send(
            new HeadObjectCommand({
                Bucket: bucket,
                Key: key
            })
        );
        return true;
    } catch (error) {
        if (error.name === "NotFound" || error.$metadata?.httpStatusCode === 404) {
            return false;
        }
        handleS3Error(error, `Error checking existence of ${key} in ${bucket}`);
    }
}

// stable hash of a row's content, ignoring per-ingest fields so the same source row matches across ingests
function buildRowContentHash(row) {
    if (!row || typeof row !== "object") return JSON.stringify(row);
    const keys = Object.keys(row).filter((k) => k !== "timestamp" && k !== "rowId").sort();
    return keys.map((k) => `${k}=${JSON.stringify(row[k] === undefined ? null : row[k])}`).join("|");
}

// list every parquet partition currently stored for a data source
async function listStoredDataKeys(workspaceId, dataSourceId) {
    const prefix = `workspaces/${workspaceId}/day-book/dataSources/${dataSourceId}/data/`;
    const keys = [];
    let ContinuationToken;
    do {
        const result = await s3Client.send(new ListObjectsV2Command({
            Bucket: bucketName,
            Prefix: prefix,
            ContinuationToken,
        }));
        for (const obj of result.Contents || []) {
            if (obj.Key && obj.Key.endsWith(".parquet")) keys.push(obj.Key);
        }
        ContinuationToken = result.IsTruncated ? result.NextContinuationToken : null;
    } while (ContinuationToken);
    return keys;
}

// append-new. Append only rows whose content is not already present in any existing partition; existing rows are untouched
async function appendNewToStoredData(workspaceId, dataSourceId, newData, schema) {
    if (!Array.isArray(newData) || newData.length === 0) return { appended: 0 };

    try {
        const existingHashes = new Set();
        const keys = await listStoredDataKeys(workspaceId, dataSourceId);
        for (const key of keys) {
            try {
                const existingFile = await s3Client.send(new GetObjectCommand({
                    Bucket: bucketName,
                    Key: key,
                }));
                const existingBuffer = await streamToBuffer(existingFile.Body);
                const existingRows = await fromParquet(existingBuffer, schema);
                for (const row of existingRows) {
                    existingHashes.add(buildRowContentHash(row));
                }
            } catch (err) {
                if (err.name === "NoSuchKey") continue;
                throw err;
            }
        }

        const filtered = [];
        const seenInBatch = new Set();
        for (const row of newData) {
            const hash = buildRowContentHash(row);
            if (existingHashes.has(hash)) continue;
            if (seenInBatch.has(hash)) continue;
            seenInBatch.add(hash);
            filtered.push(row);
        }

        if (filtered.length === 0) return { appended: 0 };

        await appendToStoredData(workspaceId, dataSourceId, filtered, schema);
        return { appended: filtered.length };
    } catch (error) {
        handleS3Error(error, `Error appending new rows to ${bucketName}`);
    }
}

// extend data. Append to existing S3 data
async function appendToStoredData(workspaceId, dataSourceId, newData, schema) {
    const date = new Date().toISOString().split('T')[0];
    const key = `workspaces/${workspaceId}/day-book/dataSources/${dataSourceId}/data/${date}.parquet`;

    try {
        let finalBuffer = null;

        // check if data exists
        const exists = await doesObjectExist(bucketName, key);

        if (exists) {
            // try fetching the existing data
            const existingFile = await s3Client.send(
                new GetObjectCommand({
                    Bucket: bucketName,
                    Key: key,
                })
            );

            const existingBuffer = await streamToBuffer(existingFile.Body);
            
            // convert existing data from parquet to json
            const existingData = await fromParquet(existingBuffer, schema);

            const mergedData = [...existingData, ...newData];

            finalBuffer = await toParquet(mergedData, schema);
        } else {
            finalBuffer = await toParquet(newData, schema);
        }

        await saveStoredData(workspaceId, dataSourceId, finalBuffer);

    } catch (error) {
        handleS3Error(error, `Error saving/appending data to ${bucketName}`);
    }
}

// remove data
async function removeAllStoredData(workspaceId, dataSourceId) {
    const prefix = `workspaces/${workspaceId}/day-book/dataSources/${dataSourceId}/`;
    try {
        const objectList = await s3Client.send(
            new ListObjectsV2Command({
                Bucket: bucketName,
                Prefix: prefix
            }),
        );

        if (!objectList.Contents || objectList.Contents.length === 0) {
            console.log("No objects found for prefix:", prefix);
            return;
        }

        const deleteParams = {
            Bucket: bucketName,
            Delete: { Objects: objectList.Contents.map(object => ({ Key: object.Key })) }
        };

        await s3Client.send(new DeleteObjectsCommand(deleteParams));

    } catch (error) {
        handleS3Error(error, `Error removing stored data from ${bucketName}`);
    }
}

// remove metric data from store
async function removeAllMetricData(workspaceId, metricId) {
    const prefix = `workspaces/${workspaceId}/day-book/metrics/${metricId}/`;
    try {
        const objectList = await s3Client.send(
            new ListObjectsV2Command({
                Bucket: bucketName,
                Prefix: prefix
            }),
        );

        if (!objectList.Contents || objectList.Contents.length === 0) {
            return;
        }

        const deleteParams = {
            Bucket: bucketName,
            Delete: { Objects: objectList.Contents.map(object => ({ Key: object.Key })) }
        };

        await s3Client.send(new DeleteObjectsCommand(deleteParams));

    } catch (error) {
        handleS3Error(error, `Error removing stored data from ${bucketName}`);
    }
}

async function getStoredData(key) {
    try {
        const response = await s3Client.send(
            new GetObjectCommand({
                Bucket: bucketName,
                Key: key,
            }),
        );

        return response.Body;
    } catch (error) {
        if (error.name === "NoSuchKey") {
            return null;
        }
        handleS3Error(error, `Error retrieving object ${key} from ${bucketName}`);
    }
}

async function getUploadUrl(workspaceId, dataSourceId) {
    const key = `workspaces/${workspaceId}/day-book/dataSources/uploads/${dataSourceId}.csv`;
    
    try {
        const command = new PutObjectCommand({
            Bucket: bucketName,
            Key: key,
            ContentType: "text/csv"
        });

        return await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    } catch (error) {
        handleS3Error(error, `Error getting upload url from ${bucketName}`);
    }
}

async function getDownloadUrl(key) {
    try {
        const command = new GetObjectCommand({
            Bucket: bucketName,
            Key: key,
            ContentType: "text/csv"
        });

        return await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    } catch (error) {
        handleS3Error(error, `Error generating download url from ${bucketName}`);
    }
}

async function replaceStoredData(workspaceId, dataSourceId, data) {
    await removeAllStoredData(workspaceId, dataSourceId);
    await saveStoredData(workspaceId, dataSourceId, data);
}

async function getDataSchema(workspaceId, dataSourceId) {
    const key = `workspaces/${workspaceId}/day-book/dataSources/${dataSourceId}/schema.json`;

    try {
        const object = await s3Client.send(
            new GetObjectCommand({
                Bucket: bucketName,
                Key: key,
            }),
        );

        const schema = await streamToString(object.Body);
        return JSON.parse(schema);
    } catch (error) {
        if (error.name === "NoSuchKey") {
            return null;
        }
        handleS3Error(error, `Error retrieving data schema ${key} from ${bucketName}`);
    }
}

async function saveSchema(workspaceId, dataSourceId, schema) {
    const key = `workspaces/${workspaceId}/day-book/dataSources/${dataSourceId}/schema.json`;

    try {
        await s3Client.send(
            new PutObjectCommand({
                Bucket: bucketName,
                Key: key,
                Body: JSON.stringify(schema, null, 2),
                ContentType: "application/json"
            }),
        );
    } catch (error) {
        handleS3Error(error, `Error saving data schema to ${bucketName}`);
    }
}

// --- temp schema + temp data ---
// While a data source is in an error state (schema drift, processing error, etc.)
// the main schema + data stay frozen so existing metrics keep working with their
// last known-good shape. Fresh ingests are cast against an auto-generated
// all-string "temp" schema and appended to a parallel /temp-data/ prefix so the
// data source still appears to update (timestamps stay fresh) until the user
// confirms a revised schema.

function tempSchemaKey(workspaceId, dataSourceId) {
    return `workspaces/${workspaceId}/day-book/dataSources/${dataSourceId}/temp-schema.json`;
}

function tempDataPrefix(workspaceId, dataSourceId) {
    return `workspaces/${workspaceId}/day-book/dataSources/${dataSourceId}/temp-data/`;
}

function mainDataPrefix(workspaceId, dataSourceId) {
    return `workspaces/${workspaceId}/day-book/dataSources/${dataSourceId}/data/`;
}

async function getTempSchema(workspaceId, dataSourceId) {
    try {
        const object = await s3Client.send(
            new GetObjectCommand({ Bucket: bucketName, Key: tempSchemaKey(workspaceId, dataSourceId) }),
        );
        const schema = await streamToString(object.Body);
        return JSON.parse(schema);
    } catch (error) {
        if (error.name === "NoSuchKey") return null;
        handleS3Error(error, `Error retrieving temp schema from ${bucketName}`);
    }
}

async function saveTempSchema(workspaceId, dataSourceId, schema) {
    try {
        await s3Client.send(
            new PutObjectCommand({
                Bucket: bucketName,
                Key: tempSchemaKey(workspaceId, dataSourceId),
                Body: JSON.stringify(schema, null, 2),
                ContentType: "application/json",
            }),
        );
    } catch (error) {
        handleS3Error(error, `Error saving temp schema to ${bucketName}`);
    }
}

async function deletePrefix(prefix) {
    let ContinuationToken;
    do {
        const objectList = await s3Client.send(new ListObjectsV2Command({
            Bucket: bucketName,
            Prefix: prefix,
            ContinuationToken,
        }));
        if (objectList.Contents && objectList.Contents.length > 0) {
            await s3Client.send(new DeleteObjectsCommand({
                Bucket: bucketName,
                Delete: { Objects: objectList.Contents.map((o) => ({ Key: o.Key })) },
            }));
        }
        ContinuationToken = objectList.IsTruncated ? objectList.NextContinuationToken : null;
    } while (ContinuationToken);
}

async function clearTempSchema(workspaceId, dataSourceId) {
    try {
        await s3Client.send(new DeleteObjectsCommand({
            Bucket: bucketName,
            Delete: { Objects: [{ Key: tempSchemaKey(workspaceId, dataSourceId) }] },
        }));
    } catch (error) {
        // best effort - the file may not exist yet
        if (error.name !== "NoSuchKey") {
            console.warn(`[dataBucket] clearTempSchema failed for ${workspaceId}/${dataSourceId}:`, error.message);
        }
    }
}

async function clearTempStoredData(workspaceId, dataSourceId) {
    try {
        await deletePrefix(tempDataPrefix(workspaceId, dataSourceId));
    } catch (error) {
        handleS3Error(error, `Error clearing temp data in ${bucketName}`);
    }
}

// list every parquet file under a given prefix
async function listKeysUnderPrefix(prefix) {
    const keys = [];
    let ContinuationToken;
    do {
        const result = await s3Client.send(new ListObjectsV2Command({
            Bucket: bucketName,
            Prefix: prefix,
            ContinuationToken,
        }));
        for (const obj of result.Contents || []) {
            if (obj.Key && obj.Key.endsWith(".parquet")) keys.push(obj.Key);
        }
        ContinuationToken = result.IsTruncated ? result.NextContinuationToken : null;
    } while (ContinuationToken);
    return keys;
}

// Append rows to today's partition under /temp-data/. Mirrors appendToStoredData
// but writes to the temp prefix so the live data stays untouched while in error.
async function appendToTempStoredData(workspaceId, dataSourceId, newData, schema) {
    if (!Array.isArray(newData) || newData.length === 0) return;
    const date = new Date().toISOString().split('T')[0];
    const key = `${tempDataPrefix(workspaceId, dataSourceId)}${date}.parquet`;

    try {
        let finalBuffer = null;
        const exists = await doesObjectExist(bucketName, key);

        if (exists) {
            const existingFile = await s3Client.send(
                new GetObjectCommand({ Bucket: bucketName, Key: key }),
            );
            const existingBuffer = await streamToBuffer(existingFile.Body);
            const existingData = await fromParquet(existingBuffer, schema);
            const mergedData = [...existingData, ...newData];
            finalBuffer = await toParquet(mergedData, schema);
        } else {
            finalBuffer = await toParquet(newData, schema);
        }

        await s3Client.send(
            new PutObjectCommand({
                Bucket: bucketName,
                Key: key,
                Body: finalBuffer,
                ContentType: "application/octet-stream",
            }),
        );
    } catch (error) {
        handleS3Error(error, `Error appending temp data to ${bucketName}`);
    }
}

// Replace the entire /temp-data/ prefix with a single partition built from
// `data`. Used for "overwrite" methods on errored sources.
async function replaceTempStoredData(workspaceId, dataSourceId, data, schema) {
    await clearTempStoredData(workspaceId, dataSourceId);
    if (!Array.isArray(data) || data.length === 0) return;
    const date = new Date().toISOString().split('T')[0];
    const key = `${tempDataPrefix(workspaceId, dataSourceId)}${date}.parquet`;
    const buffer = await toParquet(data, schema);
    try {
        await s3Client.send(
            new PutObjectCommand({
                Bucket: bucketName,
                Key: key,
                Body: buffer,
                ContentType: "application/octet-stream",
            }),
        );
    } catch (error) {
        handleS3Error(error, `Error replacing temp data in ${bucketName}`);
    }
}

// Read every row currently stored under /data/ or /temp-data/ for a data source.
// Returns an array of objects in insertion order across partitions. Used by the
// "resolve error" reprocess flow.
async function readAllStoredRows(workspaceId, dataSourceId, schema) {
    if (!Array.isArray(schema) || schema.length === 0) return [];
    const keys = await listKeysUnderPrefix(mainDataPrefix(workspaceId, dataSourceId));
    const rows = [];
    for (const key of keys.sort()) {
        try {
            const obj = await s3Client.send(new GetObjectCommand({ Bucket: bucketName, Key: key }));
            const buffer = await streamToBuffer(obj.Body);
            const partition = await fromParquet(buffer, schema);
            if (Array.isArray(partition)) rows.push(...partition);
        } catch (err) {
            if (err.name === "NoSuchKey") continue;
            throw err;
        }
    }
    return rows;
}

async function readAllTempStoredRows(workspaceId, dataSourceId, schema) {
    if (!Array.isArray(schema) || schema.length === 0) return [];
    const keys = await listKeysUnderPrefix(tempDataPrefix(workspaceId, dataSourceId));
    const rows = [];
    for (const key of keys.sort()) {
        try {
            const obj = await s3Client.send(new GetObjectCommand({ Bucket: bucketName, Key: key }));
            const buffer = await streamToBuffer(obj.Body);
            const partition = await fromParquet(buffer, schema);
            if (Array.isArray(partition)) rows.push(...partition);
        } catch (err) {
            if (err.name === "NoSuchKey") continue;
            throw err;
        }
    }
    return rows;
}

function streamToString(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", chunk => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    stream.on("error", reject);
  });
}

function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", chunk => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

module.exports = {
    saveStoredData,
    removeAllStoredData,
    replaceStoredData,
    getUploadUrl,
    getDownloadUrl,
    getStoredData,
    getDataSchema,
    saveSchema,
    appendToStoredData,
    appendNewToStoredData,
    savePartitionedData,
    loadPartitionedData,
    removeAllMetricData,
    // temp schema + temp data (used while a data source is in error)
    getTempSchema,
    saveTempSchema,
    clearTempSchema,
    appendToTempStoredData,
    replaceTempStoredData,
    clearTempStoredData,
    readAllStoredRows,
    readAllTempStoredRows,
};