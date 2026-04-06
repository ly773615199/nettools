/**
 * 认证路由 — 登录/注册/注销/忘记密码/验证码
 */
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const svgCaptcha = require('svg-captcha');
const { JWT_SECRET } = require('../core/auth');

function registerAuthRoutes(app, models) {
  const { User } = models;

  // 验证码
  app.get('/api/auth/captcha', (req, res) => {
    try {
      const captcha = svgCaptcha.create({
        size: 6, noise: 2, color: true, background: '#f4f4f4'
      });
      req.session = req.session || {};
      req.session.captcha = captcha.text;
      res.type('svg');
      res.send(captcha.data);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // 登录
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { username, password, rememberMe, captcha } = req.body;
      if (!captcha) {
        return res.status(401).json({ error: 'Captcha is required' });
      }

      const user = await User.findOne({ where: { username } });
      if (!user) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }

      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        JWT_SECRET,
        { expiresIn: rememberMe ? '7d' : '24h' }
      );

      res.json({
        token,
        user: { id: user.id, username: user.username, role: user.role }
      });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // 注册
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { username, password } = req.body;
      const existingUser = await User.findOne({ where: { username } });
      if (existingUser) {
        return res.status(400).json({ error: 'Username already exists' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await User.create({ username, password: hashedPassword, role: 'user' });

      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({
        token,
        user: { id: user.id, username: user.username, role: user.role }
      });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // 忘记密码
  app.post('/api/auth/forgot-password', async (req, res) => {
    try {
      const { username } = req.body;
      const user = await User.findOne({ where: { username } });
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      // TODO: 发送重置密码邮件
      res.json({ message: 'Reset password email sent' });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // 注销
  app.post('/api/auth/logout', (req, res) => {
    res.json({ message: 'Logout successful' });
  });
}

module.exports = { registerAuthRoutes };
