/**
 * Bore 隧道服务器 API 路由
 */
const { TunnelServer } = require('../models');
const boreServer = require('../services/boreServerManager');

function registerTunnelServerRoutes(app, authMiddleware) {

  // 列出所有隧道服务器
  app.get('/api/tunnel-servers', authMiddleware, async (req, res) => {
    try {
      const servers = await TunnelServer.findAll({ where: { userId: req.user.id } });
      const data = servers.map(s => {
        const plain = s.get({ plain: true });
        plain.running = boreServer.getServerStatus(s.id).running;
        return plain;
      });
      res.json({ data, total: data.length });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 获取单个服务器
  app.get('/api/tunnel-servers/:id', authMiddleware, async (req, res) => {
    try {
      const server = await TunnelServer.findByPk(req.params.id);
      if (!server) return res.status(404).json({ error: 'Server not found' });
      if (server.userId !== req.user.id) return res.status(403).json({ error: 'Access denied' });
      const data = server.get({ plain: true });
      data.running = boreServer.getServerStatus(server.id).running;
      res.json({ data });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 创建隧道服务器
  app.post('/api/tunnel-servers', authMiddleware, async (req, res) => {
    try {
      const { name, host, port, secret, minPort, maxPort } = req.body;
      if (!name) return res.status(400).json({ error: 'name is required' });

      const server = await TunnelServer.create({
        name,
        host: host || '0.0.0.0',
        port: Number(port) || 7835,
        secret: secret || null,
        minPort: Number(minPort) || 1024,
        maxPort: Number(maxPort) || 65535,
        status: 'stopped',
        userId: req.user.id,
      });

      res.json({ data: server, message: 'Tunnel server created' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 更新隧道服务器
  app.put('/api/tunnel-servers/:id', authMiddleware, async (req, res) => {
    try {
      const server = await TunnelServer.findByPk(req.params.id);
      if (!server) return res.status(404).json({ error: 'Server not found' });
      if (server.userId !== req.user.id) return res.status(403).json({ error: 'Access denied' });

      const { name, host, port, secret, minPort, maxPort } = req.body;
      const updates = {};
      if (name !== undefined) updates.name = name;
      if (host !== undefined) updates.host = host;
      if (port !== undefined) updates.port = Number(port);
      if (secret !== undefined) updates.secret = secret;
      if (minPort !== undefined) updates.minPort = Number(minPort);
      if (maxPort !== undefined) updates.maxPort = Number(maxPort);

      await server.update(updates);
      res.json({ data: server, message: 'Tunnel server updated' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 删除隧道服务器
  app.delete('/api/tunnel-servers/:id', authMiddleware, async (req, res) => {
    try {
      const server = await TunnelServer.findByPk(req.params.id);
      if (!server) return res.status(404).json({ error: 'Server not found' });
      if (server.userId !== req.user.id) return res.status(403).json({ error: 'Access denied' });

      boreServer.stopServer(server.id);
      await server.destroy();
      res.json({ message: 'Tunnel server deleted' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 启动隧道服务器
  app.post('/api/tunnel-servers/:id/start', authMiddleware, async (req, res) => {
    try {
      const server = await TunnelServer.findByPk(req.params.id);
      if (!server) return res.status(404).json({ error: 'Server not found' });
      if (server.userId !== req.user.id) return res.status(403).json({ error: 'Access denied' });

      const result = boreServer.startServer(server);
      if (!result.success) return res.status(400).json({ error: result.error });

      await server.update({ status: 'running' });
      res.json({ message: result.message });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 停止隧道服务器
  app.post('/api/tunnel-servers/:id/stop', authMiddleware, async (req, res) => {
    try {
      const server = await TunnelServer.findByPk(req.params.id);
      if (!server) return res.status(404).json({ error: 'Server not found' });
      if (server.userId !== req.user.id) return res.status(403).json({ error: 'Access denied' });

      const result = boreServer.stopServer(server.id);
      if (!result.success) return res.status(400).json({ error: result.error });

      await server.update({ status: 'stopped' });
      res.json({ message: result.message });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 兼容路径
  app.get('/api/tunnel-server/list', authMiddleware, async (req, res) => {
    try {
      const servers = await TunnelServer.findAll({ where: { userId: req.user.id } });
      const data = servers.map(s => {
        const plain = s.get({ plain: true });
        plain.running = boreServer.getServerStatus(s.id).running;
        return plain;
      });
      res.json({ data, total: data.length });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/tunnel-server/create', authMiddleware, async (req, res) => {
    try {
      const { name, host, port, secret, minPort, maxPort } = req.body;
      if (!name) return res.status(400).json({ error: 'name is required' });
      const server = await TunnelServer.create({
        name, host: host || '0.0.0.0', port: Number(port) || 7835,
        secret: secret || null, minPort: Number(minPort) || 1024,
        maxPort: Number(maxPort) || 65535, status: 'stopped', userId: req.user.id,
      });
      res.json({ id: String(server.id), message: 'Tunnel server created' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/tunnel-server/delete', authMiddleware, async (req, res) => {
    try {
      const { id } = req.query;
      const server = await TunnelServer.findByPk(id);
      if (!server) return res.status(404).json({ error: 'Not found' });
      if (server.userId !== req.user.id) return res.status(403).json({ error: 'Access denied' });
      boreServer.stopServer(server.id);
      await server.destroy();
      res.json({ message: 'Tunnel server deleted' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/tunnel-server/start', authMiddleware, async (req, res) => {
    try {
      const { id } = req.body;
      const server = await TunnelServer.findByPk(id);
      if (!server) return res.status(404).json({ error: 'Not found' });
      if (server.userId !== req.user.id) return res.status(403).json({ error: 'Access denied' });
      const result = boreServer.startServer(server);
      if (!result.success) return res.status(400).json({ error: result.error });
      await server.update({ status: 'running' });
      res.json({ message: result.message });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/tunnel-server/stop', authMiddleware, async (req, res) => {
    try {
      const { id } = req.body;
      const server = await TunnelServer.findByPk(id);
      if (!server) return res.status(404).json({ error: 'Not found' });
      if (server.userId !== req.user.id) return res.status(403).json({ error: 'Access denied' });
      const result = boreServer.stopServer(server.id);
      if (!result.success) return res.status(400).json({ error: result.error });
      await server.update({ status: 'stopped' });
      res.json({ message: result.message });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}

module.exports = { registerTunnelServerRoutes };
