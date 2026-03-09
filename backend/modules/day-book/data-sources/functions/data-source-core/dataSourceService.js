// Author(s): Rhys Cleary, Holly Wyatt

const dataSourceRepo = require("@etron/day-book-shared/repositories/dataSourceRepository");
const dataSourceSecretsRepo = require("@etron/data-sources-shared/repositories/dataSourceSecretsRepository");
const workspaceRepo = require("@etron/shared/repositories/workspaceRepository");
const metricRepo = require("@etron/day-book-shared/repositories/metricRepository")
const {v4 : uuidv4} = require('uuid');
const adapterFactory = require("@etron/data-sources-shared/adapters/adapterFactory");
const { saveStoredData, removeAllStoredData, getUploadUrl, getStoredData, getDataSchema, saveSchema, savePartitionedData, loadPartitionedData, removeAllMetricData, appendToStoredData, replaceStoredData } = require("@etron/data-sources-shared/repositories/dataBucketRepository");
const { validateFormat } = require("@etron/data-sources-shared/utils/validateFormat");
const { translateData } = require("@etron/data-sources-shared/utils/translateData");
const { toParquet } = require("@etron/data-sources-shared/utils/typeConversion");
const { generateSchema, classifyColumn, detectNumericType } = require("@etron/data-sources-shared/utils/schema");
const { saveSchemaAndUpdateTable } = require("@etron/data-sources-shared/utils/schema");
const { validateWorkspaceId } = require("@etron/shared/utils/validation");
const { runQuery } = require("@etron/data-sources-shared/utils/athenaService");
const { castDataToSchema } = require("@etron/data-sources-shared/utils/castDataToSchema");
const { hasPermission } = require("@etron/shared/utils/permissions");
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');
const { logAuditEvent } = require("@etron/shared/utils/auditLogger");
const { detectDateFormat, parseWithUserFormat } = require("@etron/data-sources-shared/utils/dateParser");

// Permissions for this service
const PERMISSIONS = {
    VIEW_DATASOURCES: "modules.daybook.datasources.view_dataSources",
    MANAGE_DATASOURCES: "modules.daybook.datasources.manage_dataSources",
    VIEW_DATA: "modules.daybook.datasources.view_data"
};

async function createRemoteDataSource(authUserId, payload) {
    const workspaceId = payload.workspaceId;
    await validateWorkspaceId(workspaceId);

    const isAuthorised = await hasPermission(authUserId, workspaceId, PERMISSIONS.MANAGE_DATASOURCES);

    if (!isAuthorised) {
        throw new Error("User does not have permission to perform action");
    }

    const { name, sourceType, method, expiry, config, secrets } = payload;

    if (!sourceType) {
        throw new Error("Please specify the type of data source");
    }

    if (!name || typeof name !== "string") {
        throw new Error("Please specify a type of data source");
    }

    if (method && !["overwrite", "extend"].includes(method)) {
        throw new Error("Please specify the method 'overwrite' or 'extend'");
    }

    if (method === "extend") {
        if (expiry && typeof expiry !== "object") {
            throw new Error("Expiry is not in the correct format");
        }
    }

    // try to get adapter (will also check if it exists)
    const adapter = adapterFactory.getAdapter(sourceType);

    if (!adapter) {
        throw new Error("The data type sent is not supported");
    }

    // validate config
    const configValidation = adapter.validateConfig(config);
    if (!configValidation.valid) {
        throw new Error(configValidation.error);
    }

    // validate secrets
    const secretsValidation = adapter.validateSecrets(secrets, config?.authType);
    if (!secretsValidation.valid) {
        throw new Error(secretsValidation.error);
    }

    const dataSourceId = uuidv4();
    const date = new Date().toISOString();

    // create data source item and store in repo 
    const dataSourceItem = {
        workspaceId,
        dataSourceId,
        name,
        sourceType,
        method: method || "overwrite",
        expiry: expiry || null,
        status: "active",
        createdBy: authUserId,
        config,
        createdAt: date,
        lastUpdate: date,
        associatedMetrics: [],
    };

    await dataSourceRepo.addDataSource(dataSourceItem);

    // store the secrets in parameter storage
    await dataSourceSecretsRepo.saveSecrets(workspaceId, dataSourceId, secrets);

    // try triggering the polling lambda
    const client = new LambdaClient();
    try {
        const command = new InvokeCommand({
            FunctionName: process.env.POLLING_LAMBDA_NAME,
            InvocationType: "Event",
            Payload: Buffer.from(JSON.stringify({
                workspaceId,
                dataSource: dataSourceItem
            })),
        });
        await client.send(command);
    } catch (error) {
        console.error("Failed to trigger the polling lambda");
    }

    // log audit
    await logAuditEvent({
        workspaceId,
        userId: authUserId,
        action: "Created",
        filters: ["modules", "created"],
        module: "daybook",
        itemType: "dataSource",
        itemId: dataSourceId,
        itemName: name
    });

    return {
        ...dataSourceItem,
        secrets
    };
}

async function createLocalDataSource(authUserId, payload) {
    const workspaceId = payload.workspaceId;
    await validateWorkspaceId(workspaceId);

    const isAuthorised = await hasPermission(authUserId, workspaceId, PERMISSIONS.MANAGE_DATASOURCES);

    if (!isAuthorised) {
        throw new Error("User does not have permission to perform action");
    }

    const { name, sourceType, method, expiry } = payload;

    if (!sourceType) {
        throw new Error("Please specify the type of data source");
    }

    if (!name || typeof name !== "string") {
        throw new Error("Please specify a type of data source");
    }

    if (method && !["overwrite", "extend"].includes(method)) {
        throw new Error("Please specify the method 'overwrite' or 'extend'");
    }

    if (method === "extend") {
        if (expiry && typeof expiry !== "object") {
            throw new Error("Expiry is not in the correct format");
        }
    }

    // try to get adapter (will also check if it exists)
    const adapter = adapterFactory.getAdapter(sourceType);

    if (!adapter) {
        throw new Error("The data type sent is not supported");
    }

    const dataSourceId = uuidv4();
    const date = new Date().toISOString();

    // create data source item and store in repo 
    const dataSourceItem = {
        workspaceId,
        dataSourceId,
        name,
        sourceType,
        method: method || "overwrite",
        expiry: expiry || null,
        status: "pending_upload",
        createdBy: authUserId,
        createdAt: date,
        lastUpdate: date,
        associatedMetrics: [],
    };

    await dataSourceRepo.addDataSource(dataSourceItem);
    const uploadUrl = await getUploadUrl(workspaceId, dataSourceId);

    // log audit
    await logAuditEvent({
        workspaceId,
        userId: authUserId,
        action: "Created",
        filters: ["modules", "created"],
        module: "daybook",
        itemType: "dataSource",
        itemId: dataSourceId,
        itemName: name
    });

    return {
        ...dataSourceItem,
        uploadUrl
    };
}

async function updateDataSourceInWorkspace(authUserId, dataSourceId, payload) {
    const workspaceId = payload.workspaceId;
    await validateWorkspaceId(workspaceId);

    const isAuthorised = await hasPermission(authUserId, workspaceId, PERMISSIONS.MANAGE_DATASOURCES);

    if (!isAuthorised) {
        throw new Error("User does not have permission to perform action");
    }

    const dataSource = await dataSourceRepo.getDataSourceById(workspaceId, dataSourceId);

    if (!dataSource) {
        throw new Error("The data source does not exist");
    }

    const { name, method, expiry, config, secrets } = payload;

    if (method && !["overwrite", "extend"].includes(method)) {
        throw new Error("Please specify the method 'overwrite' or 'extend'");
    }

    if (method === "extend") {
        if (expiry && typeof expiry !== "object") {
            throw new Error("Expiry is not in the correct format");
        }
    }

    // try to get adapter
    const adapter = adapterFactory.getAdapter(dataSource.sourceType);

    if (!adapter) {
        throw new Error("The data type is not supported");
    }

    // validate config
    if (config) {
        const configValidation = adapter.validateConfig(config);
        if (!configValidation.valid) {
            throw new Error(configValidation.error);
        }
    }

    // validate secrets
    if (secrets) {
        const secretsValidation = adapter.validateSecrets(secrets, config?.authType);
        if (!secretsValidation.valid) {
            throw new Error(secretsValidation.error);
        }
    }
    
    // create data source item and store in repo 
    const dataSourceItem = {
        name,
        method,
        expiry,
        config
    };

    const updatedDataSource = await dataSourceRepo.updateDataSource(workspaceId, dataSourceId, dataSourceItem);

    // store the secrets in parameter storage
    if (secrets) {
        await dataSourceSecretsRepo.saveSecrets(workspaceId, dataSourceId, secrets);
    }

    // log audit
    await logAuditEvent({
        workspaceId,
        userId: authUserId,
        action: "Updated",
        filters: ["modules", "updated"],
        module: "daybook",
        itemType: "dataSource",
        itemId: dataSourceId,
        itemName: updatedDataSource.name
    });

    return {
        ...updatedDataSource,
        secrets
    };
}

async function getLocalDataSourceUploadUrl(authUserId, workspaceId, dataSourceId) {
    await validateWorkspaceId(workspaceId);

    const isAuthorised = await hasPermission(authUserId, workspaceId, PERMISSIONS.MANAGE_DATASOURCES);

    if (!isAuthorised) {
        throw new Error("User does not have permission to perform action");
    }

    const dataSource = await dataSourceRepo.getDataSourceById(workspaceId, dataSourceId);

    if (!dataSource) throw new Error("DataSource not found");

    if (dataSource.sourceType != "local-csv") {
        throw new Error("Invalid data source type. Must be local.");
    }

    const fileUploadUrl = await getUploadUrl(workspaceId, dataSourceId);
    
    return {
        fileUploadUrl
    };
}

async function getDataSourceInWorkspace(authUserId, workspaceId, dataSourceId) {
    await validateWorkspaceId(workspaceId);

    const isAuthorised = await hasPermission(authUserId, workspaceId, PERMISSIONS.VIEW_DATASOURCES);

    if (!isAuthorised) {
        throw new Error("User does not have permission to perform action");
    }

    const dataSource = await dataSourceRepo.getDataSourceById(workspaceId, dataSourceId);

    if (!dataSource) {
        return null;
    }

    const secrets = await dataSourceSecretsRepo.getSecrets(workspaceId, dataSourceId);

    return {
        ...dataSource,
        secrets
    }
}

async function getDataSourcesInWorkspace(authUserId, workspaceId) {
    await validateWorkspaceId(workspaceId);

    const isAuthorised = await hasPermission(authUserId, workspaceId, PERMISSIONS.VIEW_DATASOURCES);

    if (!isAuthorised) {
        throw new Error("User does not have permission to perform action");
    }

    // get data source details by workspace id
    const dataSources = await dataSourceRepo.getDataSourcesByWorkspaceId(workspaceId);

    // get secrets for data source
    const dataSourceSecrets = await dataSourceSecretsRepo.getSecretsByWorkspaceId(workspaceId);

    const combinedSources = dataSources.map(source => ({
        ...source,
        secrets: dataSourceSecrets[source.dataSourceId] || {}
    }));

    return combinedSources;
}

async function deleteDataSourceInWorkspace(authUserId, workspaceId, dataSourceId) {
    await validateWorkspaceId(workspaceId);
    
    const isAuthorised = await hasPermission(authUserId, workspaceId, PERMISSIONS.MANAGE_DATASOURCES);

    if (!isAuthorised) {
        throw new Error("User does not have permission to perform action");
    }

    // get data source details
    const dataSource = await dataSourceRepo.getDataSourceById(workspaceId, dataSourceId);

    if (!dataSource) {
        throw new Error("Data Source not found");
    }

    // remove data from bucket
    await removeAllStoredData(workspaceId, dataSourceId);

    // remove all metrics associated with the data source
    /*if (dataSource.metrics && dataSource.metrics.length > 0) {
        await Promise.all(
            dataSource.metrics.map(async (metricId) => {
                // remove data from S3
                await removeAllMetricData(workspaceId, metricId);
                // remove metric from repo
                await metricRepo.removeMetric(workspaceId, metricId);
            })
        );
    }*/

    // set metrics associated with the data source to not active
    if (dataSource.metrics && dataSource.metrics.length > 0) {
        await Promise.all(
            dataSource.metrics.map(async (metricId) => {
                // update data source status for metric
                await metricRepo.updateMetricDataSourceStatus(workspaceId, metricId, false);
            })
        );
    }

    // remove data source from repo and secrets
    await dataSourceRepo.removeDataSource(workspaceId, dataSourceId);
    await dataSourceSecretsRepo.removeSecrets(workspaceId, dataSourceId);

    // log audit
    await logAuditEvent({
        workspaceId,
        userId: authUserId,
        action: "Deleted",
        filters: ["modules", "deleted"],
        module: "daybook",
        itemType: "dataSource",
        itemId: dataSourceId,
        itemName: dataSource.name
    });

    return {message: "Data source successfully deleted"};
}

async function testConnection(authUserId, payload) {
    const { sourceType, config, secrets } = payload;

    console.log('[testConnection] start', { sourceType, authType: config?.authType, endpoint: config?.endpoint, hasSecrets: !!secrets });

    // try polling
    try {

        // check if type of data source is valid
        if (!sourceType) {
            throw new Error("Please specify a type of data source");
        }

        // try to get adapter (will also check if it exists)
        const adapter = adapterFactory.getAdapter(sourceType);

        if (!adapter) {
            throw new Error("The data type sent is not supported");
        }

        // validate config
        const configValidation = adapter.validateConfig(config);
        if (!configValidation.valid) {
            throw new Error(configValidation.error);
        }

        // validate secrets
        const secretsValidation = adapter.validateSecrets(secrets, config?.authType);
        if (!secretsValidation.valid) {
            throw new Error(secretsValidation.error);
        }


        const data = await adapter.poll(config, secrets);

        // Only return a summary/preview to avoid exceeding Lambda 6MB response limit
        const preview = Array.isArray(data) ? data.slice(0, 5) : (typeof data === 'object' ? { keys: Object.keys(data || {}) } : {});
        console.log('[testConnection] success', { sourceType, rowCount: Array.isArray(data) ? data.length : 'N/A' });

        return { status: "success", message: "Connection successful", preview };

    } catch (error) {
        console.error('[testConnection] failed', { sourceType, error: error.message });
        // if the data source fails polling return error
        const errorItem = {
            status: "error",
            errorMessage: error.message
        }

        return errorItem;
    }
}

// get a preview of the data translated from the data source
async function getRemotePreview(authUserId, payload) {
    const { sourceType, config, secrets } = payload;

    try {
        // check if type of data source is valid
        if (!sourceType) {
            throw new Error("Please specify a type of data source");
        }

        // try to get adapter (will also check if it exists)
        const adapter = adapterFactory.getAdapter(sourceType);

        if (!adapter) {
            throw new Error("The data type sent is not supported");
        }

        // validate config
        const configValidation = adapter.validateConfig(config);
        if (!configValidation.valid) {
            throw new Error(configValidation.error);
        }

        // validate secrets
        const secretsValidation = adapter.validateSecrets(secrets, config?.authType);
        if (!secretsValidation.valid) {
            throw new Error(secretsValidation.error);
        }

        // fetch data
        const data = await adapter.poll(config, secrets);

        // translate the data
        const translatedData = translateData(data);

        const {valid, error } = validateFormat(translatedData);
        if (!valid) throw new Error(`Invalid data format: ${error}`);

        // return the first 50 rows
        return translatedData.slice(0, 50);

    } catch (error) {
        // if the data source fails polling return error
        const errorItem = {
            status: "error",
            errorMessage: error.message
        }

        return errorItem;
    }
}

async function getAvailableSpreadsheets(authUserId, sourceType) {
    try {
        // get adapter
        if (!sourceType) {
            throw new Error("Please specify a type of data source");
        }

        // try to get adapter (will also check if it exists)
        const adapter = adapterFactory.getAdapter(sourceType);

        if (!adapter) {
            throw new Error("The data source specified is not supported");
        }


        const sheets = await adapter.getAvailableSheets(authUserId);

        return {
            status: "success",
            data: sheets
        };
    } catch (error) {
        return {
            status: "error",
            errorMessage: error.message
        };
    }
}

function sanitiseIdentifier(name) {
    return name.replace(/[^A-Za-z0-9_]/g, "_");
}

async function viewData(authUserId, workspaceId, dataSourceId, options = {}) {  // Grabs the data from a data source
    const isAuthorised = await hasPermission(authUserId, workspaceId, PERMISSIONS.VIEW_DATA);

    if (!isAuthorised) {
        throw new Error("User does not have permission to perform action");
    }

    // get the schema from the dataSource
    const schema = await getDataSchema(workspaceId, dataSourceId);
    if (!schema || schema.length === 0) {
        throw new Error("Data is still being processed. Please wait a moment and try again.");
    }

    const columns = schema.map(column => sanitiseIdentifier(column.name)).join(", ");
    const tableName = sanitiseIdentifier(`ds_${dataSourceId}`);
    const database = process.env.ATHENA_DATABASE;
    const outputLocation = `s3://${process.env.WORKSPACE_BUCKET}/workspaces/${workspaceId}/day-book/athenaResults/`;

    const query = `SELECT ${columns} FROM ${tableName}`;

    const { data, nextToken, queryExecutionId } = await runQuery(
        query,
        database,
        outputLocation,
        options
    );

    const filteredSchema = schema.filter(
        column => column.name !== 'rowId'
    );

    // cast received data to schema
    const castedData = castDataToSchema(data, filteredSchema);

    return {
        data: castedData,
        schema: filteredSchema,
        tableName,
        nextToken,
        queryExecutionId
    };
}

async function viewDataForMetric(authUserId, workspaceId, dataSourceId, metricId, options = {}) {  // Grabs only the data in the source used by a metric (less data transferred)
    const isAuthorised = await hasPermission(authUserId, workspaceId, PERMISSIONS.VIEW_DATA);

    if (!isAuthorised) {
        throw new Error("User does not have permission to perform action");
    }
    
    // get the schema from the dataSource
    const schema = await getDataSchema(workspaceId, dataSourceId);
    if (!schema || schema.length === 0) {
        throw new Error("Data is still being processed. Please wait a moment and try again.");
    }

    // get the metric columns
    const metricColumns = await metricRepo.getMetricVariableNames(workspaceId, metricId);

    const filteredSchema = schema.filter(
        column => metricColumns.includes(column.name)
    );

    const columns = filteredSchema.map(column => sanitiseIdentifier(column.name)).join(", ");
    const tableName = sanitiseIdentifier(`ds_${dataSourceId}`);
    const database = process.env.ATHENA_DATABASE;
    const outputLocation = `s3://${process.env.WORKSPACE_BUCKET}/workspaces/${workspaceId}/day-book/athenaResults/`;

    const query = `SELECT ${columns} FROM ${tableName}`;

    const { data, nextToken, queryExecutionId } = await runQuery(
        query,
        database,
        outputLocation,
        options
    );

    const finalSchema = filteredSchema.filter(
        column => column.name !== 'rowId'
    );

    // cast received data to schema
    const castedData = castDataToSchema(data, finalSchema);

    return {
        data: castedData,
        schema: finalSchema,
        tableName,
        nextToken,
        queryExecutionId
    };
}

// update the data in the parquet files (by parition (timestamp))
async function updatePartitionedData(authUserId, dataSourceId, payload) {
    const { workspaceId, updates, partitionField } = payload;

    const isAuthorised = await hasPermission(authUserId, workspaceId, PERMISSIONS.MANAGE_DATASOURCES);

    if (!isAuthorised) {
        throw new Error("User does not have permission to perform action");
    }

    await validateWorkspaceId(workspaceId);

    if (!updates || updates.length == 0) {
        throw new Error("No updates provided");
    }
    console.log("Updates provided.");

    try {
        // group by partition
        const partitionsMap = {};

        for (const update of updates) {
            const timestamp = update[partitionField];
            if (!timestamp) throw new Error(`Each update row must have a timestamp`);

            // extract date from timestamp
            const partitionValue = new Date(timestamp).toISOString().split("T")[0];

            if (!partitionsMap[partitionValue]) partitionsMap[partitionValue] = [];
            partitionsMap[partitionValue].push(update);
        }

        // process each partition
        for (const partitionValue of Object.keys(partitionsMap)) {
            const partitionUpdates = partitionsMap[partitionValue];

            // load the existing data
            console.log("Before loading paritition");
            const existingData = await loadPartitionedData(workspaceId, dataSourceId, partitionValue);
            console.log("Existing Data:", existingData);

            // merge the data
            const mergedMap = new Map();

            existingData.forEach(row => {
                if (row.rowId) mergedMap.set(row.rowId.trim().toLowerCase(), row);
            });

            // apply updates
            partitionUpdates.forEach(update => {
                if (!update.rowId) update.rowId = uuidv4(); // assigns rowId if missing
                const key = update.rowId.trim().toLowerCase();
                mergedMap.set(key, update); // replaces the existing row if it has the same rowId
            });

            const mergedData = Array.from(mergedMap.values());
            console.log("New data:", mergedData);

            // remove duplicates in the case there are duplicates (with the same rowId)
            const uniqueMap = new Map();
            for (const row of mergedData) {
                uniqueMap.set(row.rowId.trim().toLowerCase(), row);
            }
            const dedupedData = Array.from(uniqueMap.values());

            // validate and cast data to schema
            const schema = generateSchema(dedupedData);
            const castedData = castDataToSchema(dedupedData, schema);

            // convert to parquet
            const parquetBuffer = await toParquet(castedData, schema);

            // save the data back into s3
            await savePartitionedData(workspaceId, dataSourceId, parquetBuffer, partitionValue);
        }

        return {message: "Data sources data successfully updated"};
    } catch (error) {
        console.error(`Failed to update partitioned data source:`, error);
    }
}


// Preview the auto-detected schema for uploaded CSV data.
// Returns the schema with categories (date/value/dimension) and a sample of data.
// The user can review and adjust field categories before confirming.
async function previewSchema(authUserId, payload) {
    const { workspaceId, rawData } = payload;
    await validateWorkspaceId(workspaceId);

    const isAuthorised = await hasPermission(authUserId, workspaceId, PERMISSIONS.MANAGE_DATASOURCES);
    if (!isAuthorised) {
        throw new Error("User does not have permission to perform action");
    }

    if (!rawData) {
        throw new Error("No data provided for preview");
    }

    const translatedData = translateData(rawData);

    if (translatedData.length === 0) {
        throw new Error("The provided data is empty");
    }

    const { valid, error } = validateFormat(translatedData);
    if (!valid) throw new Error(`Invalid data format: ${error}`);

    // Generate schema with auto-detected types and categories
    const schema = generateSchema(translatedData.slice(0, 100));

    // Add suggested value types for dimension columns that could be numeric
    for (const column of schema) {
        if (column.category === "dimension") {
            const values = translatedData.slice(0, 100).map(row => row[column.name]);
            const numericType = detectNumericType(values, column.name);
            if (numericType) {
                column.suggestedValueType = numericType;
            }
        }
    }

    // Return schema and a small data sample for the user to review
    return {
        schema,
        sampleData: translatedData.slice(0, 10),
        totalRows: translatedData.length
    };
}

// Confirm and process the schema after the user has reviewed/adjusted field categories.
// Takes the user's confirmed schema (with category overrides) and processes the upload.
async function confirmSchemaAndProcess(authUserId, dataSourceId, payload) {
    const { workspaceId, confirmedSchema, rawData } = payload;
    await validateWorkspaceId(workspaceId);

    const isAuthorised = await hasPermission(authUserId, workspaceId, PERMISSIONS.MANAGE_DATASOURCES);
    if (!isAuthorised) {
        throw new Error("User does not have permission to perform action");
    }

    const dataSource = await dataSourceRepo.getDataSourceById(workspaceId, dataSourceId);
    if (!dataSource) {
        throw new Error(`Data source not found: ${dataSourceId}`);
    }

    if (!confirmedSchema || !Array.isArray(confirmedSchema) || confirmedSchema.length === 0) {
        throw new Error("Confirmed schema is required");
    }

    if (!rawData) {
        throw new Error("No data provided");
    }

    try {
        const translatedData = translateData(rawData);

        if (translatedData.length === 0) {
            await dataSourceRepo.updateDataSourceStatus(workspaceId, dataSourceId, {
                status: "no_data",
                errorMessage: "No data existent"
            });
            return { success: false };
        }

        const { valid, error } = validateFormat(translatedData);
        if (!valid) throw new Error(`Invalid data format: ${error}`);

        // Generate auto-detected schema to get the base types
        const autoSchema = generateSchema(translatedData.slice(0, 100));

        // Build the final schema based on user's confirmed categories
        const finalSchema = autoSchema.map(col => {
            const userCol = confirmedSchema.find(c => c.name === col.name);
            if (!userCol) return col;

            const toCat = userCol.category || col.category;

            // --- Transitioning to DATE ---
            if (toCat === "date") {
                // User specified a date format string explicitly
                if (userCol.userDateFormat) {
                    return { name: col.name, type: "timestamp", category: "date", userDateFormat: userCol.userDateFormat };
                }
                // If column was already detected as date with a format, keep it
                if (col.type === "timestamp" && col.dateFormat) {
                    return col;
                }
                // Try to auto-detect a date format from the data
                const dateValues = translatedData.slice(0, 100).map(row => row[col.name]);
                const dateFormat = detectDateFormat(dateValues);
                if (dateFormat) {
                    return { name: col.name, type: "timestamp", category: "date", dateFormat };
                }
                // Try native JS Date parsing as fallback
                const testValues = dateValues.filter(v => v != null && String(v).trim() !== "").slice(0, 10);
                const canParse = testValues.length > 0 && testValues.every(v => !isNaN(new Date(v).getTime()));
                if (canParse) {
                    return { name: col.name, type: "timestamp", category: "date" };
                }
                // Cannot convert — keep original type but mark category
                return { ...col, category: "date" };
            }

            // --- Transitioning to VALUE ---
            if (toCat === "value") {
                if (col.category === "value") {
                    // Already a value — user may have changed the sub-type
                    if (userCol.type && userCol.type !== col.type) {
                        return { name: col.name, type: userCol.type, category: "value" };
                    }
                    return col;
                }
                // Changing from non-value (dimension/date) to value
                const numValues = translatedData.slice(0, 100).map(row => row[col.name]);
                const detectedType = detectNumericType(numValues, col.name);
                const newType = userCol.type || detectedType || "double";
                return { name: col.name, type: newType, category: "value" };
            }

            // --- Transitioning to DIMENSION ---
            if (toCat === "dimension") {
                if (col.category === "dimension") return col;
                return { name: col.name, type: "string", category: "dimension" };
            }

            return col;
        });

        // Cast rows to the final schema
        const castedData = castDataToSchema(translatedData, finalSchema);

        // Convert to parquet
        const parquetBuffer = await toParquet(castedData, finalSchema);

        // Save data depending on method
        if (dataSource.method === "extend") {
            await appendToStoredData(workspaceId, dataSourceId, castedData, finalSchema);
        } else {
            await replaceStoredData(workspaceId, dataSourceId, parquetBuffer);
        }

        // Save the schema to S3
        await saveSchemaAndUpdateTable(workspaceId, dataSourceId, finalSchema);

        // Update status
        await dataSourceRepo.updateDataSourceStatus(workspaceId, dataSourceId, {
            status: "active",
            errorMessage: null
        });

        return { success: true, schema: finalSchema };
    } catch (error) {
        await dataSourceRepo.updateDataSourceStatus(workspaceId, dataSourceId, {
            status: "error",
            errorMessage: error.message
        });
        throw error;
    }
}

module.exports = {
    createRemoteDataSource,
    createLocalDataSource,
    updateDataSourceInWorkspace,
    getDataSourceInWorkspace,
    getDataSourcesInWorkspace,
    deleteDataSourceInWorkspace,
    testConnection,
    getRemotePreview,
    viewData,
    viewDataForMetric,
    getLocalDataSourceUploadUrl,
    getAvailableSpreadsheets,
    updatePartitionedData,
    previewSchema,
    confirmSchemaAndProcess
};