/**
 * 代理管理路由 — CRUD + 连接/断开 (含兼容旧路径)
 */
const { authMiddleware } = require('../core/auth');
const { startClash, stopClash } = require('../clashManager');

function registerProxyRoutes(app, models) {
  const { Proxy } = models;

  // ---- RESTful 路由 ----

  app.get('/api/proxies', authMiddleware, async (req, res) => {
    try {
      const proxies = await Proxy.findAll({ where: { userId: req.user.id } });
      res.json({ data: proxies, total: proxies.length });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/proxies', authMiddleware, async (req, res) => {
    try {
      const { name, type, server, port, config } = req.body;
      const proxy = await Proxy.create({
        name, type, server, port,
        config: JSON.stringify(config || {}),
        status: 'disconnected', userId: req.user.id
      });
      res.json({ message: 'Proxy created successfully', proxy });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.put('/api/proxies/:id', authMiddleware, async (req, res) => {
    try {
      const proxy = await Proxy.findByPk(req.params.id);
      if (!proxy) return res.status(404).json({ error: 'Proxy not found' });
      if (proxy.userId !== req.user.id) return res.status(403).json({ error: 'Access denied' });

      const { name, type, server, port, config } = req.body;
      await proxy.update({
        name: name || proxy.name,
        type: type || proxy.type,
        server: server || proxy.server,
        port: port || proxy.port,
        config: config ? JSON.stringify(config) : proxy.config
      });
      res.json({ message: 'Proxy updated successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.delete('/api/proxies/:id', authMiddleware, async (req, res) => {
    try {
      const proxy = await Proxy.findByPk(req.params.id);
      if (!proxy) return res.status(404).json({ error: 'Proxy not found' });
      if (proxy.userId !== req.user.id) return res.status(403).json({ error: 'Access denied' });
      await proxy.destroy();
      res.json({ message: 'Proxy deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/proxies/:id/connect', authMiddleware, async (req, res) => {
    try {
      const proxy = await Proxy.findByPk(req.params.id);
      if (!proxy) return res.status(404).json({ error: 'Proxy not found' });
      if (proxy.userId !== req.user.id) return res.status(403).json({ error: 'Access denied' });

      await Proxy.update({ status: 'disconnected' }, { where: { userId: req.user.id, status: 'connected' } });
      const allProxies = await Proxy.findAll({ where: { userId: req.user.id } });
      const result = startClash(allProxies);
      if (!result.success && result.error !== 'Clash is already running') {
        return res.status(500).json({ error: result.error });
      }

      await proxy.update({ status: 'connected' });
      res.json({ message: 'Proxy connected successfully', clash: result });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/proxies/:id/disconnect', authMiddleware, async (req, res) => {
    try {
      const proxy = await Proxy.findByPk(req.params.id);
      if (!proxy) return res.status(404).json({ error: 'Proxy not found' });
      if (proxy.userId !== req.user.id) return res.status(403).json({ error: 'Access denied' });

      await proxy.update({ status: 'disconnected' });
      const connectedCount = await Proxy.count({ where: { userId: req.user.id, status: 'connected' } });
      if (connectedCount === 0) stopClash();

      res.json({ message: 'Proxy disconnected successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ---- 兼容旧路径 (/api/proxy/*) ----

  app.get('/api/proxy/list', authMiddleware, async (req, res) => {
    try {
      const proxies = await Proxy.findAll({ where: { userId: req.user.id } });
      res.json({ data: proxies, total: proxies.length });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/proxy/create', authMiddleware, async (req, res) => {
    try {
      const { name, type, server, port, config } = req.body;
      const proxy = await Proxy.create({
        name, type, server, port,
        config: config ? JSON.stringify(config) : '{}',
        status: 'disconnected', userId: req.user.id
      });
      res.json({ id: String(proxy.id), message: 'Proxy created successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.delete('/api/proxy/delete', authMiddleware, async (req, res) => {
    try {
      const proxy = await Proxy.findByPk(req.query.id);
      if (!proxy) return res.status(404).json({ error: 'Not found' });
      if (proxy.userId !== req.user.id) return res.status(403).json({ error: 'Access denied' });
      await proxy.destroy();
      res.json({ message: 'Proxy deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/proxy/connect', authMiddleware, async (req, res) => {
    try {
      const proxy = await Proxy.findByPk(req.body.id);
      if (!proxy) return res.status(404).json({ error: 'Not found' });
      if (proxy.userId !== req.user.id) return res.status(403).json({ error: 'Access denied' });

      await Proxy.update({ status: 'disconnected' }, { where: { userId: req.user.id, status: 'connected' } });
      const allProxies = await Proxy.findAll({ where: { userId: req.user.id } });
      const result = startClash(allProxies);
      if (!result.success && result.error !== 'Clash is already running') {
        return res.status(500).json({ error: result.error });
      }

      await proxy.update({ status: 'connected' });
      res.json({ message: 'Proxy connected successfully', clash: result });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/proxy/disconnect', authMiddleware, async (req, res) => {
    try {
      const proxy = await Proxy.findByPk(req.body.id);
      if (!proxy) return res.status(404).json({ error: 'Not found' });
      if (proxy.userId !== req.user.id) return res.status(403).json({ error: 'Access denied' });

      await proxy.update({ status: 'disconnected' });
      const connectedCount = await Proxy.count({ where: { userId: req.user.id, status: 'connected' } });
      if (connectedCount === 0) stopClash();

      res.json({ message: 'Proxy disconnected successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });
}

module.exports = { registerProxyRoutes };
