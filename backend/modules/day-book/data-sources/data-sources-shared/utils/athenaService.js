// Author(s): Rhys Cleary
const {
    AthenaClient,
    StartQueryExecutionCommand,
    GetQueryExecutionCommand,
    GetQueryResultsCommand,
} = require("@aws-sdk/client-athena");

const client = new AthenaClient({});

function sanitiseIdentifier(name) {
    // replace invalid characters with underscores
    return name.replace(/[^A-Za-z0-9_]/g, "_");
}

async function startQuery(query, database, outputLocation) {
    const response = await client.send(
        new StartQueryExecutionCommand({
            QueryString: query,
            QueryExecutionContext: { Database: database },
            ResultConfiguration: { OutputLocation: outputLocation }
        }),
    );

    const queryExecutionId = response.QueryExecutionId;

    // poll until the query completes
    let queryState = "RUNNING";
    while (queryState === "RUNNING" || queryState === "QUEUED") {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const statusResponse = await client.send(
            new GetQueryExecutionCommand({ QueryExecutionId: queryExecutionId })
        );
        console.log(statusResponse);
        queryState = statusResponse.QueryExecution.Status.State;

        if (queryState === "FAILED") {
            throw new Error(
                `Athena query failed: ${statusResponse.QueryExecution.Status.StateChangeReason}`
            );
        }

        if (queryState === "CANCELLED") {
            throw new Error("Athena query was cancelled");
        }

        console.log(`Query ${queryExecutionId} is ${queryState}`);
    }

    return queryExecutionId;
}

async function getQueryResults(queryExecutionId, nextToken, maxResults = 50) {
    return await client.send(
        new GetQueryResultsCommand({
            QueryExecutionId: queryExecutionId,
            NextToken: nextToken,
            MaxResults: maxResults,
        })
    );
}

function parseResults(results) {
    const columnInfo = results.ResultSet?.ResultSetMetadata?.ColumnInfo;
    if (!columnInfo || columnInfo.length === 0) return [];
    
    const columns = columnInfo.map(column => column.Name);
    const rows = results.ResultSet?.Rows || [];
    const dataRows = rows.slice(1); // remove header row

    return dataRows.map(row => {
        const object = {};
        row.Data.forEach((field, i) => {
            object[columns[i]] = 
                field.VarCharValue ??
                field.BooleanValue ??
                field.DoubleValue ??
                field.LongValue ?? 
                null;
        });
        return object;
    });
}

async function runQuery(query, database, outputLocation, options = {}) {
    const { pageSize = 50, maxPages = 1, nextToken } = options;

    let queryExecutionId = options.queryExecutionId;
    if (!queryExecutionId) {
        queryExecutionId = await startQuery(query, database, outputLocation);
    }

    let allData = [];
    let token = nextToken;
    let pageCount = 0;

    // fetch the results
    do {
        const results = await getQueryResults(queryExecutionId, token, pageSize);
        const parsed = parseResults(results);
        allData = allData.concat(parsed);

        token = results.NextToken;
        pageCount++;
    } while (token && pageCount < maxPages);

    return {
        data: allData,
        queryExecutionId,
        nextToken: token
    };
}

async function runDDL(query, database, outputLocation) {
    const queryExecutionId = await startQuery(query, database, outputLocation);
    console.log(`DDL completed: ${queryExecutionId}`);
    return queryExecutionId;
}

function toAthenaType(type) {
    switch (type) {
        case "bigint":
            return "bigint";
        case "double":
        case "decimal(18,2)":
            return "double";
        case "boolean":
            return "boolean";
        case "timestamp":
            return "timestamp";
        case "string":
        default:
            return "string";
    }

}

async function createAthenaTable(schema, tableName, dataLocation, database, outputLocation) {
    if (!Array.isArray(schema) || schema.length === 0) {
        throw new Error("Cannot create Athena table: the schema is empty");
    }
    const sanitisedTableName = sanitiseIdentifier(tableName); 
    const columns = schema.map(column => `\`${sanitiseIdentifier(column.name)}\` ${toAthenaType(column.type)}`).join(", ");

    const ddl = `CREATE EXTERNAL TABLE \`${sanitisedTableName}\` (${columns}) STORED AS PARQUET LOCATION '${dataLocation}'`;

    console.log("Athena DDL:\n", ddl);

    await runDDL(ddl, database, outputLocation);

    return sanitisedTableName;
}

module.exports = {
    runQuery,
    createAthenaTable,
    runDDL
}