// Author(s): Rhys Cleary
const workspaceUsersRepo = require("../repositories/workspaceUsersRepository");
const workspaceRepo = require("../repositories/workspaceRepository");
const {
  GetObjectCommand,
  NoSuchKey,
  S3Client,
  S3ServiceException,
} = require("@aws-sdk/client-s3");
const {
  getAppPermissions,
} = require("../repositories/appConfigBucketRepository");
const s3Client = new S3Client({});
const { permissionCache } = require("./permissionCache");

// get the default permissions. Permissions with defaultStatus: true
async function getDefaultPermissions() {
  const config = await getAppPermissions();

  if (!config) {
    return [];
  }

  const result = [];

  // get keys from the categories
  function getKeysFromCategories(categories, prefix) {
    if (!categories) return;

    for (const [categoryName, category] of Object.entries(categories)) {
      if (category.permissions) {
        for (const perm of category.permissions) {
          if (perm.defaultStatus) {
            result.push(`${prefix}.${perm.key}`);
          }
        }
      }

      // recursive if nested category
      if (category.categories) {
        getKeysFromCategories(category.categories, `${prefix}.${categoryName}`);
      }
    }
  }

  // get app permission keys
  if (config.app?.categories) {
    getKeysFromCategories(config.app.categories, "app");
  }

  // handle the modules
  if (config.modules) {
    for (const [moduleName, module] of Object.entries(config.modules)) {
      getKeysFromCategories(module.categories, `modules.${moduleName}`);
    }
  }

  return result;
}

// resolve the effective permissions from DynamoDB, bypassing the cache
async function _resolveEffectivePermissions(userId, workspaceId){
    const user = await workspaceUsersRepo.getUser(workspaceId, userId);
    const roleIds = workspaceUsersRepo.getUserRoleIds(user);

    if (roleIds.length === 0) {
        return { permissions: [], isOwner: false, version: 0 };
    }

    const roles = await Promise.all(
        roleIds.map(id => workspaceRepo.getRoleById(workspaceId, id))
    );

    const isOwner = roles.some(role => role?.owner === true);
    if (isOwner) {
        return {
            permissions: [],
            isOwner: true,
            hideGatedComponents: false,
            version: user.permissionsVersion || 0
        };
    }

    const permissionSet = new Set();
    // a user inherits the hide-gated-components flag if ANY of their roles
    // has it enabled; this keeps the UI behaviour predictable when a user
    // holds multiple roles.
    let hideGatedComponents = false;
    for (const role of roles) {
        if (role?.permissions) {
            for (const perm of role.permissions) {
                permissionSet.add(perm);
            }
        }
        if (role?.hideGatedComponents === true) {
            hideGatedComponents = true;
        }
    }

    return {
        permissions: Array.from(permissionSet),
        isOwner: false,
        hideGatedComponents,
        version: user.permissionsVersion || 0
    };

}

// returns the effective permissions for a user in a workspace, using Lambda in memory cache
async function getEffectivePermissions(userId, workspaceId) {
    const cached = permissionCache.get(workspaceId, userId);
    if (cached) return cached;

    const effective = await _resolveEffectivePermissions(userId, workspaceId);
    permissionCache.set(workspaceId, userId, effective);
    return effective;
}

// check a single permission
async function hasPermission(userId, workspaceId, permissionKey) {
    const effective = await getEffectivePermissions(userId, workspaceId);
    if (effective.isOwner) return true;
    return effective.permissions.includes(permissionKey);
}

module.exports = {
    getDefaultPermissions,
    getEffectivePermissions,
    hasPermission
};