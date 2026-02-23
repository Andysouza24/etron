// Author(s): Rhys Cleary, Holly Wyatt

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { 
    DynamoDBDocumentClient, 
    PutCommand, 
    GetCommand, 
    DeleteCommand, 
    UpdateCommand,
    QueryCommand,
    BatchWriteCommand 
} = require("@aws-sdk/lib-dynamodb");

const dynamoDB = DynamoDBDocumentClient.from(new DynamoDBClient());

const tableName = "WorkspaceUsers";

// add user to workspace
async function addUser(userItem) {
    if (!userItem.workspaceId || !userItem.userId) {
        throw new Error("Missing required parameters workspaceId and userId");
    }

    // send request to datastore
    await dynamoDB.send(
        new PutCommand( {
            TableName: tableName,
            Item: userItem
        })
    );
}

// remove user from workspace
async function removeUser(workspaceId, userId) {
    if (!workspaceId || !userId) {
        throw new Error("Missing required parameters workspaceId and userId");
    }
    
    // send request to delete entry
    await dynamoDB.send(
        new DeleteCommand( {
            TableName: tableName,
            Key: {
                workspaceId: workspaceId,
                userId: userId
            },
        })
    );
}

// update user info in workspace
async function updateUser(workspaceId, userId, data) {
    if (!workspaceId || !userId) {
        throw new Error("Missing required parameters workspaceId and userId");
    }

    const updateFields = [];
    const expressionAttributeValues = {};
    const expressionAttributeNames = {};

    if (data.given_name !== undefined) {
        updateFields.push("#given_name = :given_name");
        expressionAttributeValues[":given_name"] = data.given_name;
        expressionAttributeNames["#given_name"] = "given_name";
    }

    if (data.family_name !== undefined) {
        updateFields.push("#family_name = :family_name");
        expressionAttributeValues[":family_name"] = data.family_name;
        expressionAttributeNames["#family_name"] = "family_name";
    }

    if (data.picture !== undefined) {
        updateFields.push("#picture = :picture");
        expressionAttributeValues[":picture"] = data.picture;
        expressionAttributeNames["#picture"] = "picture";
    }

    if (data.type !== undefined) {
        updateFields.push("#type = :type");
        expressionAttributeValues[":type"] = data.type;
        expressionAttributeNames["#type"] = "type";
    }

    if (data.roleId !== undefined) {
        updateFields.push("#roleId = :roleId");
        expressionAttributeValues[":roleId"] = data.roleId;
        expressionAttributeNames["#roleId"] = "roleId";
    }

    updateFields.push("#updatedAt = :updatedAt");
    expressionAttributeValues[":updatedAt"] = new Date().toISOString();
    expressionAttributeNames["#updatedAt"] = "updatedAt";

    const result = await dynamoDB.send(
        new UpdateCommand( {
            TableName: tableName,
            Key: {
                workspaceId: workspaceId,
                userId: userId
            },
            UpdateExpression: "SET " + updateFields.join(", "),
            ExpressionAttributeValues: expressionAttributeValues,
            ExpressionAttributeNames: expressionAttributeNames,
            ReturnValues: "ALL_NEW"
        })
    );

    return result.Attributes;
}

// get user in workspace
async function getUser(workspaceId, userId) {
    if (!workspaceId || !userId) {
        throw new Error("Missing required parameters workspaceId and userId");
    }
    
    const result = await dynamoDB.send(
        new GetCommand({
            TableName: tableName,
            Key: {
                workspaceId: workspaceId,
                userId: userId
            }
        })
    );
    
    return result.Item || null;
}

// get user by userId
async function getUserByUserId(userId) {
    const result = await dynamoDB.send(
        new QueryCommand({
            TableName: tableName,
            IndexName: "userId-index",
            KeyConditionExpression: "userId = :userId",
            ExpressionAttributeValues: {
                ":userId": userId
            }
        })
    );

    return result.Items[0] || null
}

// get all users in a workspace
async function getUsersByWorkspaceId(workspaceId) {
    if (!workspaceId) {
        throw new Error("Missing required parameter workspaceId");
    }

    // find the users in a workspace
    const result = await dynamoDB.send(
        new QueryCommand({
            TableName: tableName,
            KeyConditionExpression: "workspaceId = :workspaceId",
            ExpressionAttributeValues: {
                ":workspaceId": workspaceId
            }
        })
    );

    return result.Items || null;
}

// get user by workspaceId and email
async function getUserByWorkspaceIdAndEmail(workspaceId, email) {
    const result = await dynamoDB.send(
        new QueryCommand({
            TableName: tableName,
            IndexName: "workspaceId-email-index",
            KeyConditionExpression: "workspaceId = :workspaceId AND email = :email",
            ExpressionAttributeValues: {
                ":workspaceId": workspaceId,
                ":email": email
            }
        })
    );

    return result.Items[0];
}

// get the roleId of a user in a workspace
function getUserRoleIds(user){
    if (!user) return [];
    if (user.roleIds && Array.isArray(user.roleIds)) return user.roleIds;
    if (user.roleId) return [user.roleId];
    return [];
}


// set the role of a user in a workspace and bumps permission version
async function setUserRoles(workspaceId, userId, roleId) {
    const params = {
        TableName: tableName,
        Key: { workspaceId, userId },
        UpdateExpression: "SET #roleId = :roleId, permissionsVersion = if_not_exists(permissionsVersion, :zero) + :one, updatedAt = :now",
        ExpressionAttributeValues: {
            ":roleId": roleId,
            ":zero": 0,
            ":one": 1,
            ":now": new Date().toISOString()
        },
        ReturnValues: "ALL_NEW"
    };
    const result = await dynamoDB.send(new UpdateCommand(params));
    return result.Attributes;
}

// bump permissions version for a user in a workspace
async function bumpPermissionsVersion(workspaceId, userId) {
    // consider updated at
    const params = {
        TableName: tableName,
        Key: { workspaceId, userId },
        UpdateExpression: "SET permissionsVersion = if_not_exists(permissionsVersion, :zero) + :one",
        ExpressionAttributeValues: {
            ":zero": 0,
            ":one": 1
        }
    };
    await dynamoDB.send(new UpdateCommand(params));
}

// bump permissions version for all users with a given role in a workspace
async function bumpPermissionsVersionForRole(workspaceId, roleId) {
    const users = await getUsersByWorkspaceId(workspaceId);

    const affectedUsers = users.filter(u => {
        const id = getUserRoleIds(u);
        return id.includes(roleId);
    });

    if (affectedUsers.length === 0) return;

    const batchSize = 10;
    for (let i = 0; i < affectedUsers.length; i += batchSize) {
        const batch = affectedUsers.slice(i, i + batchSize);
        await Promise.all(batch.map(user => bumpPermissionsVersion(workspaceId, user.userId)));

    }
}

// remove all the users
async function removeAllUsers(workspaceId) {
    const { Items } = await dynamoDB.send(new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: "workspaceId = :workspaceId",
        ExpressionAttributeValues: { ":workspaceId": workspaceId }
    }));

    if (!Items || Items.length === 0) return;

    // batch delete the items
    const deleteRequests = Items.map(item => ({
        DeleteRequest: { Key: { workspaceId, userId: item.userId } }
    }));

    for (let i = 0; i < deleteRequests.length; i += 25) {
        const batch = deleteRequests.slice(i, i + 25);
        await dynamoDB.send(new BatchWriteCommand({
            RequestItems: { [tableName]: batch }
        }));
  }
}

module.exports = {
    addUser,
    removeUser,
    updateUser,
    getUser,
    getUserByUserId,
    getUsersByWorkspaceId,
    getUserByWorkspaceIdAndEmail,
    removeAllUsers,
    getUserRoleIds,
    setUserRoles,
    bumpPermissionsVersion,
    bumpPermissionsVersionForRole,
}