/**
 * 用户管理路由
 */
const bcrypt = require('bcrypt');
const { authMiddleware } = require('../core/auth');

function registerUserRoutes(app, models) {
  const { User } = models;

  app.get('/api/users', authMiddleware, async (req, res) => {
    try {
      const users = await User.findAll();
      res.json({ data: users, total: users.length });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/users/:id', authMiddleware, async (req, res) => {
    try {
      const user = await User.findByPk(req.params.id);
      if (!user) return res.status(404).json({ error: 'User not found' });
      res.json({ data: user });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.put('/api/users/:id', authMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const { username, password, role } = req.body;
      const user = await User.findByPk(id);
      if (!user) return res.status(404).json({ error: 'User not found' });

      let hashedPassword = user.password;
      if (password) {
        hashedPassword = await bcrypt.hash(password, 10);
      }

      await user.update({
        username: username || user.username,
        password: hashedPassword,
        role: role || user.role
      });

      res.json({ message: 'User updated successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.delete('/api/users/:id', authMiddleware, async (req, res) => {
    try {
      const user = await User.findByPk(req.params.id);
      if (!user) return res.status(404).json({ error: 'User not found' });
      await user.destroy();
      res.json({ message: 'User deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });
}

module.exports = { registerUserRoutes };
