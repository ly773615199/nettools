/**
 * 用户管理路由 [G8] - 多用户权限管理
 * admin: 完全管理 user/guest
 * user: 只能修改自己
 * guest: 只读
 */
const bcrypt = require('bcrypt');
const { authMiddleware } = require('../core/auth');

function registerUserRoutes(app, models, requirePerm) {
  const { User } = models;

  // 列出用户 - admin 可看全部，其他角色只能看自己
  app.get('/api/users', authMiddleware, requirePerm('user', 'list'), async (req, res) => {
    try {
      let users;
      if (req.user.role === 'admin') {
        users = await User.findAll({ attributes: { exclude: ['password'] } });
      } else {
        users = await User.findByPk(req.user.id, { attributes: { exclude: ['password'] } });
        users = users ? [users] : [];
      }
      res.json({ data: users, total: users.length });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // 获取单个用户
  app.get('/api/users/:id', authMiddleware, requirePerm('user', 'view'), async (req, res) => {
    try {
      const user = await User.findByPk(req.params.id, { attributes: { exclude: ['password'] } });
      if (!user) return res.status(404).json({ error: 'User not found' });

      // 非 admin 只能查看自己
      if (req.user.role !== 'admin' && user.id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      res.json({ data: user });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // 创建用户 - 仅 admin
  app.post('/api/users', authMiddleware, requirePerm('user', 'create'), async (req, res) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Only admin can create users' });
      }

      const { username, password, role } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: 'username and password are required' });
      }

      // 检查用户名是否已存在
      const existing = await User.findOne({ where: { username } });
      if (existing) {
        return res.status(400).json({ error: 'Username already exists' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await User.create({
        username,
        password: hashedPassword,
        role: role || 'user',
      });

      const userData = user.get({ plain: true });
      delete userData.password;
      res.json({ data: userData, message: 'User created' });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // 更新用户 - admin 可修改任何人，user 只能改自己
  app.put('/api/users/:id', authMiddleware, requirePerm('user', 'update'), async (req, res) => {
    try {
      const { id } = req.params;
      const { username, password, role } = req.body;
      const user = await User.findByPk(id);
      if (!user) return res.status(404).json({ error: 'User not found' });

      // 非 admin 只能修改自己
      if (req.user.role !== 'admin' && user.id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // user 不能修改角色
      if (req.user.role !== 'admin' && role) {
        return res.status(403).json({ error: 'Only admin can change roles' });
      }

      let hashedPassword = user.password;
      if (password) {
        hashedPassword = await bcrypt.hash(password, 10);
      }

      await user.update({
        username: username || user.username,
        password: hashedPassword,
        role: req.user.role === 'admin' ? (role || user.role) : user.role,
      });

      const userData = user.get({ plain: true });
      delete userData.password;
      res.json({ data: userData, message: 'User updated' });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // 删除用户 - 仅 admin
  app.delete('/api/users/:id', authMiddleware, requirePerm('user', 'delete'), async (req, res) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Only admin can delete users' });
      }

      const user = await User.findByPk(req.params.id);
      if (!user) return res.status(404).json({ error: 'User not found' });

      // 不能删除自己
      if (user.id === req.user.id) {
        return res.status(400).json({ error: 'Cannot delete yourself' });
      }

      await user.destroy();
      res.json({ message: 'User deleted' });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // 获取当前用户权限
  app.get('/api/users/me/permissions', authMiddleware, async (req, res) => {
    try {
      const { getRolePermissions } = require('../core/permissions');
      const permissions = getRolePermissions(req.user.role || 'guest');
      res.json({
        data: {
          user: {
            id: req.user.id,
            username: req.user.username,
            role: req.user.role,
          },
          permissions,
        },
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}

module.exports = { registerUserRoutes };
