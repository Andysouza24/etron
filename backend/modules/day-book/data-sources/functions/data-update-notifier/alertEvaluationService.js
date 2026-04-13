const metricRepo = require("@etron/day-book-shared/repositories/metricRepository");
const { SQSClient, SendMessageCommand } = require("@aws-sdk/client-sqs");
const {
    AthenaClient,
    StartQueryExecutionCommand,
    GetQueryExecutionCommand,
    GetQueryResultsCommand,
} = require("@aws-sdk/client-athena");

const sqsClient = new SQSClient();
const athenaClient = new AthenaClient({});

/**
 * Maps time period codes to milliseconds for date arithmetic.
 */
const TIME_PERIOD_MS = {
    "1d": 1 * 24 * 60 * 60 * 1000,
    "1w": 7 * 24 * 60 * 60 * 1000,
    "2w": 14 * 24 * 60 * 60 * 1000,
    "1m": 30 * 24 * 60 * 60 * 1000,
    "3m": 90 * 24 * 60 * 60 * 1000,
    "6m": 180 * 24 * 60 * 60 * 1000,
    "1y": 365 * 24 * 60 * 60 * 1000,
};

function sanitiseIdentifier(name) {
    return name.replace(/[^A-Za-z0-9_]/g, "_");
}

/**
 * Run an Athena query and return parsed row objects.
 */
async function runAthenaQuery(query, database, outputLocation) {
    const startResponse = await athenaClient.send(
        new StartQueryExecutionCommand({
            QueryString: query,
            QueryExecutionContext: { Database: database },
            ResultConfiguration: { OutputLocation: outputLocation },
        })
    );

    const queryExecutionId = startResponse.QueryExecutionId;

    // poll until complete
    let state = "RUNNING";
    while (state === "RUNNING" || state === "QUEUED") {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const status = await athenaClient.send(
            new GetQueryExecutionCommand({ QueryExecutionId: queryExecutionId })
        );
        state = status.QueryExecution.Status.State;
        if (state === "FAILED") {
            throw new Error(`Athena query failed: ${status.QueryExecution.Status.StateChangeReason}`);
        }
        if (state === "CANCELLED") {
            throw new Error("Athena query was cancelled");
        }
    }

    const results = await athenaClient.send(
        new GetQueryResultsCommand({ QueryExecutionId: queryExecutionId, MaxResults: 1000 })
    );

    const columns = (results.ResultSet?.ResultSetMetadata?.ColumnInfo || []).map((c) => c.Name);
    const rows = (results.ResultSet?.Rows || []).slice(1); // skip header

    return rows.map((row) => {
        const obj = {};
        row.Data.forEach((field, i) => {
            obj[columns[i]] = field.VarCharValue ?? null;
        });
        return obj;
    });
}

/**
 * Compute the aggregate (sum) of a dependent variable from query rows.
 */
function aggregateValues(rows, dependentVariable) {
    let sum = 0;
    for (const row of rows) {
        const val = parseFloat(row[dependentVariable]);
        if (!isNaN(val)) sum += val;
    }
    return sum;
}

/**
 * Evaluate a single alert condition.
 * Returns true if the alert should fire.
 */
function evaluateCondition(alert, currentValue, previousValue) {
    const threshold = parseFloat(alert.conditionValue);
    if (isNaN(threshold)) return false;

    const delta = currentValue - previousValue;
    const percentDelta = previousValue !== 0 ? (delta / Math.abs(previousValue)) * 100 : 0;

    switch (alert.condition) {
        case "less_than":
            return currentValue < threshold;
        case "greater_than":
            return currentValue > threshold;
        case "decreased_by":
            return delta < 0 && Math.abs(delta) > threshold;
        case "increased_by":
            return delta > 0 && delta > threshold;
        case "changed_by":
            return Math.abs(delta) > threshold;
        case "percent_decreased_by":
            return percentDelta < 0 && Math.abs(percentDelta) > threshold;
        case "percent_increased_by":
            return percentDelta > 0 && percentDelta > threshold;
        case "percent_changed_by":
            return Math.abs(percentDelta) > threshold;
        default:
            console.warn(`Unknown alert condition: ${alert.condition}`);
            return false;
    }
}

/**
 * Build a human-readable description of why the alert triggered.
 */
function buildAlertBody(alert, metricName, currentValue, previousValue) {
    const delta = currentValue - previousValue;
    const percentDelta = previousValue !== 0 ? ((delta / Math.abs(previousValue)) * 100).toFixed(1) : "N/A";
    const direction = delta >= 0 ? "increased" : "decreased";

    switch (alert.condition) {
        case "less_than":
            return `${metricName} is ${currentValue.toFixed(2)}, which is less than ${alert.conditionValue}.`;
        case "greater_than":
            return `${metricName} is ${currentValue.toFixed(2)}, which is greater than ${alert.conditionValue}.`;
        case "decreased_by":
        case "increased_by":
        case "changed_by":
            return `${metricName} has ${direction} by ${Math.abs(delta).toFixed(2)} (current: ${currentValue.toFixed(2)}, previous: ${previousValue.toFixed(2)}).`;
        case "percent_decreased_by":
        case "percent_increased_by":
        case "percent_changed_by":
            return `${metricName} has ${direction} by ${Math.abs(percentDelta)}% (current: ${currentValue.toFixed(2)}, previous: ${previousValue.toFixed(2)}).`;
        default:
            return `Alert "${alert.name}" triggered for ${metricName}.`;
    }
}

/**
 * Send a notification message to the SQS notification queue.
 */
async function queueNotification({ userId, title, body, data }) {
    const queueUrl = process.env.NOTIFICATION_QUEUE_URL;
    if (!queueUrl) {
        console.warn("NOTIFICATION_QUEUE_URL not configured. Skipping alert notification.");
        return;
    }

    await sqsClient.send(
        new SendMessageCommand({
            QueueUrl: queueUrl,
            MessageBody: JSON.stringify({ userId, title, body, data }),
        })
    );
}

/**
 * Evaluate all alerts for metrics associated with a data source that was just updated.
 *
 * @param {string} workspaceId
 * @param {string} dataSourceId
 * @param {string[]} metricIds — IDs of metrics linked to this data source
 */
async function evaluateAlerts(workspaceId, dataSourceId, metricIds) {
    if (!metricIds || metricIds.length === 0) return;

    const database = process.env.ATHENA_DATABASE;
    const outputLocation = `s3://${process.env.WORKSPACE_BUCKET}/workspaces/${workspaceId}/day-book/athenaResults/`;
    const tableName = sanitiseIdentifier(`ds_${dataSourceId}`);

    let triggeredCount = 0;

    for (const metricId of metricIds) {
        let metric;
        try {
            metric = await metricRepo.getMetricById(workspaceId, metricId);
        } catch (err) {
            console.error(`Failed to fetch metric ${metricId}:`, err.message);
            continue;
        }

        if (!metric || !metric.alerts || metric.alerts.length === 0) continue;

        const { config, alerts, createdBy, name: metricName } = metric;
        const independentVar = config.independentVariable;
        const dependentVars = config.dependentVariables || [];

        if (!independentVar || dependentVars.length === 0) continue;

        const sanitisedIndependent = sanitiseIdentifier(independentVar);
        const sanitisedDependents = dependentVars.map(sanitiseIdentifier);
        const selectColumns = [sanitisedIndependent, ...sanitisedDependents].join(", ");

        // Query all data for this metric's columns
        let rows;
        try {
            const query = `SELECT ${selectColumns} FROM ${tableName}`;
            rows = await runAthenaQuery(query, database, outputLocation);
        } catch (err) {
            console.error(`Athena query failed for metric ${metricId}:`, err.message);
            continue;
        }

        if (!rows || rows.length === 0) continue;

        // For each alert, evaluate against each dependent variable
        for (const alert of alerts) {
            const timePeriodMs = TIME_PERIOD_MS[alert.timePeriod];
            if (!timePeriodMs) continue;

            const now = Date.now();
            const currentStart = new Date(now - timePeriodMs);
            const previousStart = new Date(now - 2 * timePeriodMs);

            for (const depVar of dependentVars) {
                // Split rows into current and previous period based on the independent variable as a date
                const currentRows = [];
                const previousRows = [];

                for (const row of rows) {
                    const dateVal = new Date(row[independentVar]);
                    if (isNaN(dateVal.getTime())) continue;

                    if (dateVal >= currentStart) {
                        currentRows.push(row);
                    } else if (dateVal >= previousStart && dateVal < currentStart) {
                        previousRows.push(row);
                    }
                }

                const currentValue = aggregateValues(currentRows, depVar);
                const previousValue = aggregateValues(previousRows, depVar);

                if (evaluateCondition(alert, currentValue, previousValue)) {
                    const body = buildAlertBody(alert, metricName, currentValue, previousValue);

                    try {
                        await queueNotification({
                            userId: createdBy,
                            title: alert.name,
                            body,
                            data: {
                                type: "metric_alert",
                                screen: "/(auth)/(drawer)/modules/day-book/metrics/view-metric/[metricId]",
                                params: { metricId },
                            },
                        });
                        triggeredCount++;
                        console.log(`Alert "${alert.name}" triggered for metric ${metricId}, variable ${depVar}`);
                    } catch (err) {
                        console.error(`Failed to send alert notification for metric ${metricId}:`, err.message);
                    }
                }
            }
        }
    }

    console.log(`Alert evaluation complete: ${triggeredCount} alert(s) triggered`);
    return { triggered: triggeredCount };
}

module.exports = { evaluateAlerts, evaluateCondition };
