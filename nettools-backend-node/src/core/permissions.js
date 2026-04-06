/**
 * 权限定义 - 基于角色的访问控制 (RBAC)
 * 
 * 角色: admin / user / guest
 * 权限按模块划分: storage / tunnel / proxy / vpn / download / fileServer / system / backup / user
 */

// 权限动作
const Actions = {
  LIST: 'list',
  VIEW: 'view',
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  START: 'start',
  STOP: 'stop',
  EXECUTE: 'execute', // 手动触发备份等
  MANAGE: 'manage',   // 完全管理权限
};

// 权限矩阵: role -> module -> allowed actions
const PermissionMatrix = {
  admin: {
    storage:    [Actions.LIST, Actions.VIEW, Actions.CREATE, Actions.UPDATE, Actions.DELETE, Actions.MANAGE],
    tunnel:     [Actions.LIST, Actions.VIEW, Actions.CREATE, Actions.UPDATE, Actions.DELETE, Actions.START, Actions.STOP],
    proxy:      [Actions.LIST, Actions.VIEW, Actions.CREATE, Actions.UPDATE, Actions.DELETE, Actions.START, Actions.STOP],
    vpn:        [Actions.LIST, Actions.VIEW, Actions.CREATE, Actions.UPDATE, Actions.DELETE, Actions.START, Actions.STOP],
    download:   [Actions.LIST, Actions.VIEW, Actions.CREATE, Actions.DELETE, Actions.EXECUTE],
    fileServer: [Actions.LIST, Actions.VIEW, Actions.CREATE, Actions.UPDATE, Actions.DELETE, Actions.START, Actions.STOP],
    system:     [Actions.VIEW, Actions.UPDATE, Actions.MANAGE],
    backup:     [Actions.LIST, Actions.VIEW, Actions.CREATE, Actions.UPDATE, Actions.DELETE, Actions.EXECUTE],
    user:       [Actions.LIST, Actions.VIEW, Actions.CREATE, Actions.UPDATE, Actions.DELETE],
  },
  user: {
    storage:    [Actions.LIST, Actions.VIEW, Actions.CREATE, Actions.UPDATE, Actions.DELETE],
    tunnel:     [Actions.LIST, Actions.VIEW, Actions.CREATE, Actions.UPDATE, Actions.DELETE, Actions.START, Actions.STOP],
    proxy:      [Actions.LIST, Actions.VIEW, Actions.CREATE, Actions.UPDATE, Actions.DELETE, Actions.START, Actions.STOP],
    vpn:        [Actions.LIST, Actions.VIEW, Actions.CREATE, Actions.UPDATE, Actions.DELETE, Actions.START, Actions.STOP],
    download:   [Actions.LIST, Actions.VIEW, Actions.CREATE, Actions.DELETE],
    fileServer: [Actions.LIST, Actions.VIEW, Actions.CREATE, Actions.UPDATE, Actions.START, Actions.STOP],
    system:     [Actions.VIEW],
    backup:     [Actions.LIST, Actions.VIEW, Actions.CREATE, Actions.UPDATE, Actions.DELETE, Actions.EXECUTE],
    user:       [Actions.VIEW, Actions.UPDATE], // 只能修改自己
  },
  guest: {
    storage:    [Actions.LIST, Actions.VIEW],
    tunnel:     [Actions.LIST, Actions.VIEW],
    proxy:      [Actions.LIST, Actions.VIEW],
    vpn:        [Actions.LIST, Actions.VIEW],
    download:   [Actions.LIST, Actions.VIEW],
    fileServer: [Actions.LIST, Actions.VIEW],
    system:     [Actions.VIEW],
    backup:     [Actions.LIST, Actions.VIEW],
    user:       [Actions.VIEW],
  },
};

/**
 * 检查用户是否有指定权限
 * @param {string} role - 用户角色
 * @param {string} module - 模块名
 * @param {string} action - 操作名
 * @returns {boolean}
 */
function hasPermission(role, module, action) {
  const matrix = PermissionMatrix[role];
  if (!matrix) return false;
  const allowed = matrix[module];
  if (!allowed) return false;
  return allowed.includes(action);
}

/**
 * 获取角色的所有权限
 */
function getRolePermissions(role) {
  return PermissionMatrix[role] || {};
}

module.exports = {
  Actions,
  PermissionMatrix,
  hasPermission,
  getRolePermissions,
};
