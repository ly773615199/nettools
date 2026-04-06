/**
 * 权限检查中间件
 * 用法: requirePermission('storage', 'create')
 */
const { hasPermission, Actions } = require('./permissions');

/**
 * 创建权限检查中间件
 * @param {string} module - 模块名 (storage, tunnel, proxy, vpn, download, fileServer, system, backup, user)
 * @param {string} action - 操作名 (list, view, create, update, delete, start, stop, execute, manage)
 */
function requirePermission(module, action) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const role = req.user.role || 'guest';

    // admin 拥有所有权限
    if (role === 'admin') {
      return next();
    }

    // 特殊处理：user 只能操作自己的资源
    if (action === 'update' || action === 'delete') {
      // 资源所有权检查会在路由层处理
    }

    if (!hasPermission(role, module, action)) {
      return res.status(403).json({
        error: 'Permission denied',
        required: `${module}:${action}`,
        role: role,
      });
    }

    next();
  };
}

/**
 * 资源所有权检查中间件
 * 确保 user 只能操作自己创建的资源
 * @param {object} Model - Sequelize 模型
 * @param {string} paramName - URL 参数名 (默认 'id')
 * @param {string} ownerField - 模型中标识所有者的字段 (默认 'userId')
 */
function requireOwnership(Model, paramName = 'id', ownerField = 'userId') {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (req.user.role === 'admin') {
      return next();
    }

    try {
      const resource = await Model.findByPk(req.params[paramName]);
      if (!resource) {
        return res.status(404).json({ error: 'Resource not found' });
      }
      if (resource[ownerField] !== req.user.id) {
        return res.status(403).json({ error: 'Access denied: not the resource owner' });
      }
      req.resource = resource;
      next();
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };
}

module.exports = { requirePermission, requireOwnership };
