// Author(s): Rhys Cleary

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  DeleteCommand,
  UpdateCommand,
  QueryCommand,
  ScanCommand,
  BatchWriteCommand,
} = require("@aws-sdk/lib-dynamodb");

const dynamoDB = DynamoDBDocumentClient.from(new DynamoDBClient());

const tableName = "Workspaces";

// ROLES

// add role to workspace
async function addRole(roleItem) {
  const { roleId, ...rest } = roleItem;
  const updatedRoleItem = {
    ...rest,
    sk: `role#${roleId}`,
  };

  // send request to datastore
  await dynamoDB.send(
    new PutCommand({
      TableName: tableName,
      Item: updatedRoleItem,
    })
  );
}

// remove role from workspace
async function removeRole(workspaceId, roleId) {
  const sk = `role#${roleId}`;

  // send request to delete entry
  await dynamoDB.send(
    new DeleteCommand({
      TableName: tableName,
      Key: {
        workspaceId: workspaceId,
        sk: sk,
      },
    })
  );
}

// update role in workspace
async function updateRole(workspaceId, roleId, data) {
  const updateFields = [];
  const expressionAttributeValues = {};
  const expressionAttributeNames = {};

  if (data.name !== undefined) {
    updateFields.push("#name = :name");
    expressionAttributeValues[":name"] = data.name;
    expressionAttributeNames["#name"] = "name";
  }

  if (data.permissions !== undefined) {
    updateFields.push("#permissions = :permissions");
    expressionAttributeValues[":permissions"] = data.permissions;
    expressionAttributeNames["#permissions"] = "permissions";
  }

  if (data.hasAccess !== undefined) {
    updateFields.push("#hasAccess = :hasAccess");
    expressionAttributeValues[":hasAccess"] = data.hasAccess;
    expressionAttributeNames["#hasAccess"] = "hasAccess";
  }

  updateFields.push("#updatedAt = :updatedAt");
  expressionAttributeValues[":updatedAt"] = new Date().toISOString();
  expressionAttributeNames["#updatedAt"] = "updatedAt";

  const sk = `role#${roleId}`;

  const result = await dynamoDB.send(
    new UpdateCommand({
      TableName: tableName,
      Key: {
        workspaceId: workspaceId,
        sk: sk,
      },
      UpdateExpression: "SET " + updateFields.join(", "),
      ExpressionAttributeValues: expressionAttributeValues,
      ExpressionAttributeNames: expressionAttributeNames,
      ReturnValues: "ALL_NEW",
    })
  );

  const itemAttributes = result.Attributes;
  const { sk: skValue, ...rest } = itemAttributes;

  return {
    ...rest,
    roleId: skValue.replace("role#", ""),
  };
}

// get role in a workspace
async function getRoleById(workspaceId, roleId) {
  const sk = `role#${roleId}`;

  const result = await dynamoDB.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        workspaceId: workspaceId,
        sk: sk,
      },
    })
  );

  const item = result.Item;

  if (!item) {
    return null;
  }

  const { sk: skValue, ...rest } = item;

  return {
    ...rest,
    roleId: skValue.replace("role#", ""),
  };
}

// get all roles in a workspace
async function getRolesByWorkspaceId(workspaceId) {
  // get the roles in a workspace
  const result = await dynamoDB.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression:
        "workspaceId = :workspaceId AND begins_with(sk, :prefix)",
      ExpressionAttributeValues: {
        ":workspaceId": workspaceId,
        ":prefix": "role#",
      },
    })
  );

  return (result.Items || null).map(({ sk, ...rest }) => ({
    ...rest,
    roleId: sk.replace("role#", ""),
  }));
}

// get owner role id
async function getOwnerRoleId(workspaceId) {
  const result = await dynamoDB.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression:
        "workspaceId = :workspaceId AND begins_with(sk, :prefix)",
      ExpressionAttributeValues: {
        ":workspaceId": workspaceId,
        ":prefix": "role#",
      },
    })
  );

  const owner = (result.Items || []).find((item) => item.name === "Owner");
  return owner ? owner.sk.replace("role#", "") : null;
}

// BOARDS

// add board to workspace
async function addBoard(boardItem) {
  const { boardId, ...rest } = boardItem;
  const updatedBoardItem = {
    ...rest,
    sk: `board#${boardId}`,
  };

  // send request to datastore
  await dynamoDB.send(
    new PutCommand({
      TableName: tableName,
      Item: updatedBoardItem,
    })
  );
}

// remove board from workspace
async function removeBoard(workspaceId, boardId) {
  const sk = `board#${boardId}`;

  // send request to delete entry
  await dynamoDB.send(
    new DeleteCommand({
      TableName: tableName,
      Key: {
        workspaceId: workspaceId,
        sk: sk,
      },
    })
  );
}

// update board in workspace
async function updateBoard(workspaceId, boardId, data) {
  const updateFields = [];
  const expressionAttributeValues = {};
  const expressionAttributeNames = {};

  if (data.name !== undefined) {
    updateFields.push("#name = :name");
    expressionAttributeValues[":name"] = data.name;
    expressionAttributeNames["#name"] = "name";
  }

  if (data.config !== undefined) {
    updateFields.push("#config = :config");
    expressionAttributeValues[":config"] = data.config;
    expressionAttributeNames["#config"] = "config";
  }

  if (data.isDashboard !== undefined) {
    updateFields.push("#isDashboard = :isDashboard");
    expressionAttributeValues[":isDashboard"] = data.isDashboard;
    expressionAttributeNames["#isDashboard"] = "isDashboard";
  }

  if (data.editedBy !== undefined) {
    updateFields.push("#editedBy = :editedBy");
    expressionAttributeValues[":editedBy"] = data.editedBy;
    expressionAttributeNames["#editedBy"] = "editedBy";
  }

  if (data.createdBy !== undefined) {
    updateFields.push("#createdBy = :createdBy");
    expressionAttributeValues[":createdBy"] = data.createdBy;
    expressionAttributeNames["#createdBy"] = "createdBy";
  }

  updateFields.push("#updatedAt = :updatedAt");
  expressionAttributeValues[":updatedAt"] = new Date().toISOString();
  expressionAttributeNames["#updatedAt"] = "updatedAt";

  const sk = `board#${boardId}`;

  const result = await dynamoDB.send(
    new UpdateCommand({
      TableName: tableName,
      Key: {
        workspaceId: workspaceId,
        sk: sk,
      },
      UpdateExpression: "SET " + updateFields.join(", "),
      ExpressionAttributeValues: expressionAttributeValues,
      ExpressionAttributeNames: expressionAttributeNames,
      ReturnValues: "ALL_NEW",
    })
  );

  const itemAttributes = result.Attributes;
  const { sk: skValue, ...rest } = itemAttributes;

  return {
    ...rest,
    boardId: skValue.replace("board#", ""),
  };
}

// get board in a workspace
async function getBoardById(workspaceId, boardId) {
  const sk = `board#${boardId}`;

  const result = await dynamoDB.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        workspaceId: workspaceId,
        sk: sk,
      },
    })
  );

  const item = result.Item;

  if (!item) {
    return null;
  }

  const { sk: skValue, ...rest } = item;

  return {
    ...rest,
    boardId: skValue.replace("board#", ""),
  };
}

// get all boards in a workspace
async function getBoardsByWorkspaceId(workspaceId) {
  // get the boards in a workspace
  const result = await dynamoDB.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression:
        "workspaceId = :workspaceId AND begins_with(sk, :board)",
      ExpressionAttributeValues: {
        ":workspaceId": workspaceId,
        ":board": "board#",
      },
    })
  );

  return (result.Items || null).map(({ sk, ...rest }) => ({
    ...rest,
    boardId: sk.replace("board#", ""),
  }));
}

// WORKSPACE

// add a new workspace entry
async function addWorkspace(workspaceItem) {
  // send request to datastore
  await dynamoDB.send(
    new PutCommand({
      TableName: tableName,
      Item: workspaceItem,
    })
  );
}

// remove workspace
async function removeWorkspace(workspaceId) {
  // send request to delete entry
  await dynamoDB.send(
    new DeleteCommand({
      TableName: tableName,
      Key: {
        workspaceId: workspaceId,
        sk: "meta",
      },
    })
  );
}

// get workspace by id
async function getWorkspaceById(workspaceId) {
  const result = await dynamoDB.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        workspaceId: workspaceId,
        sk: "meta",
      },
    })
  );

  return result.Item || null;
}

// get workspace by ownerId
async function getWorkspaceByOwnerId(ownerId) {
  const result = await dynamoDB.send(
    new QueryCommand({
      TableName: tableName,
      IndexName: "ownerId-index",
      KeyConditionExpression: "ownerId = :ownerId",
      ExpressionAttributeValues: {
        ":ownerId": ownerId,
      },
    })
  );

  return result.Items || null;
}

// get all workspaces
async function getAllWorkspaces() {
  const result = await dynamoDB.send(
    new ScanCommand({
      TableName: tableName,
    })
  );

  return result.Items || null;
}

// get workspace by id
async function updateWorkspace(workspaceId, data) {
  const updateFields = [];
  const expressionAttributeValues = {};
  const expressionAttributeNames = {};

  if (data.name !== undefined) {
    updateFields.push("#name = :name");
    expressionAttributeValues[":name"] = data.name;
    expressionAttributeNames["#name"] = "name";
  }

  if (data.location !== undefined) {
    updateFields.push("#location = :location");
    expressionAttributeValues[":location"] = data.location;
    expressionAttributeNames["#location"] = "location";
  }

  if (data.description !== undefined) {
    updateFields.push("#description = :description");
    expressionAttributeValues[":description"] = data.description;
    expressionAttributeNames["#description"] = "description";
  }

  updateFields.push("#updatedAt = :updatedAt");
  expressionAttributeValues[":updatedAt"] = new Date().toISOString();
  expressionAttributeNames["#updatedAt"] = "updatedAt";

  const result = await dynamoDB.send(
    new UpdateCommand({
      TableName: tableName,
      Key: {
        workspaceId: workspaceId,
        sk: "meta",
      },
      UpdateExpression: "SET " + updateFields.join(", "),
      ExpressionAttributeValues: expressionAttributeValues,
      ExpressionAttributeNames: expressionAttributeNames,
      ReturnValues: "ALL_NEW",
    })
  );

  const itemAttributes = result.Attributes;
  const { sk, ...rest } = itemAttributes;

  return {
    ...rest,
  };
}

// remove all the workspace data
async function removeAllWorkspaceData(workspaceId) {
  const { Items } = await dynamoDB.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "workspaceId = :workspaceId",
      ExpressionAttributeValues: { ":workspaceId": workspaceId },
    })
  );

  if (!Items || Items.length === 0) return;

  // batch delete the items
  const deleteRequests = Items.map((item) => ({
    DeleteRequest: { Key: { workspaceId, sk: item.sk } },
  }));

  for (let i = 0; i < deleteRequests.length; i += 25) {
    const batch = deleteRequests.slice(i, i + 25);
    await dynamoDB.send(
      new BatchWriteCommand({
        RequestItems: { [tableName]: batch },
      })
    );
  }
}

// MODULES

// add module to workspace
async function addModule(moduleItem) {
  const { moduleId, ...rest } = moduleItem;
  const updatedModuleItem = {
    ...rest,
    sk: `module#${moduleId}`,
  };

  // send request to datastore
  await dynamoDB.send(
    new PutCommand({
      TableName: tableName,
      Item: updatedModuleItem,
    })
  );
}

// remove module from workspace
async function removeModule(workspaceId, moduleId) {
  const sk = `module#${moduleId}`;

  // send request to delete entry
  await dynamoDB.send(
    new DeleteCommand({
      TableName: tableName,
      Key: {
        workspaceId: workspaceId,
        sk: sk,
      },
    })
  );
}

// update module in workspace
async function updateModule(workspaceId, moduleId, enabled) {
  const updateFields = [];
  const expressionAttributeValues = {};
  const expressionAttributeNames = {};

  updateFields.push("#enabled = :enabled");
  expressionAttributeValues[":enabled"] = enabled;
  expressionAttributeNames["#enabled"] = "enabled";

  updateFields.push("#updatedAt = :updatedAt");
  expressionAttributeValues[":updatedAt"] = new Date().toISOString();
  expressionAttributeNames["#updatedAt"] = "updatedAt";

  const sk = `module#${moduleId}`;

  const result = await dynamoDB.send(
    new UpdateCommand({
      TableName: tableName,
      Key: {
        workspaceId: workspaceId,
        sk: sk,
      },
      UpdateExpression: "SET " + updateFields.join(", "),
      ExpressionAttributeValues: expressionAttributeValues,
      ExpressionAttributeNames: expressionAttributeNames,
      ReturnValues: "ALL_NEW",
    })
  );

  const itemAttributes = result.Attributes;
  const { sk: skValue, ...rest } = itemAttributes;

  return {
    ...rest,
    moduleId: skValue.replace("module#", ""),
  };
}

// get all modules in a workspace
async function getModulesByWorkspaceId(workspaceId) {
  // get the modules in a workspace
  const result = await dynamoDB.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression:
        "workspaceId = :workspaceId AND begins_with(sk, :prefix)",
      ExpressionAttributeValues: {
        ":workspaceId": workspaceId,
        ":prefix": "module#",
      },
    })
  );

  return (result.Items || null).map(({ sk, ...rest }) => ({
    ...rest,
    moduleId: sk.replace("module#", ""),
  }));
}

// get all modules in a workspace by key
async function getModuleByKey(workspaceId, moduleKey) {
  // get the modules in a workspace
  const result = await dynamoDB.send(
    new QueryCommand({
      TableName: tableName,
      IndexName: "workspaceId-moduleKey-index",
      KeyConditionExpression:
        "workspaceId = :workspaceId AND moduleKey = :moduleKey",
      ExpressionAttributeValues: {
        ":workspaceId": workspaceId,
        ":moduleKey": moduleKey,
      },
    })
  );

  return (result.Items || null).map(({ sk, ...rest }) => ({
    ...rest,
    moduleId: sk.replace("module#", ""),
  }));
}

module.exports = {
  addRole,
  updateRole,
  removeRole,
  getRoleById,
  getRolesByWorkspaceId,
  getOwnerRoleId,
  addBoard,
  updateBoard,
  removeBoard,
  getBoardById,
  getBoardsByWorkspaceId,
  addWorkspace,
  removeWorkspace,
  getWorkspaceById,
  getWorkspaceByOwnerId,
  getAllWorkspaces,
  updateWorkspace,
  removeAllWorkspaceData,
  addModule,
  updateModule,
  removeModule,
  getModulesByWorkspaceId,
  getModuleByKey,
};
