/**
 * Clash 管理路由
 */
const { authMiddleware } = require('../core/auth');
const { startClash, stopClash, restartClash, getClashStatus, getCurrentConfig, updateConfig } = require('../clashManager');

function registerClashRoutes(app, models) {
  const { Proxy } = models;

  app.get('/api/clash/status', authMiddleware, (req, res) => {
    res.json({ data: getClashStatus() });
  });

  app.get('/api/clash/config', authMiddleware, (req, res) => {
    res.json({ data: getCurrentConfig() });
  });

  app.post('/api/clash/start', authMiddleware, async (req, res) => {
    try {
      const proxies = await Proxy.findAll({ where: { userId: req.user.id } });
      const result = startClash(proxies);
      if (!result.success) return res.status(500).json({ error: result.error });
      res.json({ message: result.message, data: result });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/clash/stop', authMiddleware, (req, res) => {
    const result = stopClash();
    if (!result.success) return res.status(400).json({ error: result.error });
    res.json({ message: result.message });
  });

  app.post('/api/clash/restart', authMiddleware, async (req, res) => {
    try {
      const proxies = await Proxy.findAll({ where: { userId: req.user.id } });
      const result = restartClash(proxies);
      if (!result.success) return res.status(500).json({ error: result.error });
      res.json({ message: 'Clash restarted', data: result });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.put('/api/clash/mode', authMiddleware, async (req, res) => {
    try {
      const { mode } = req.body;
      if (!['Rule', 'Global', 'Direct'].includes(mode)) {
        return res.status(400).json({ error: 'Invalid mode. Must be Rule, Global, or Direct' });
      }
      const proxies = await Proxy.findAll({ where: { userId: req.user.id } });
      const result = updateConfig(proxies, mode);
      res.json({ message: `Proxy mode set to ${mode}`, data: result });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.put('/api/clash/rules', authMiddleware, async (req, res) => {
    try {
      const { rules } = req.body;
      if (!Array.isArray(rules)) return res.status(400).json({ error: 'rules must be an array' });
      const proxies = await Proxy.findAll({ where: { userId: req.user.id } });
      const result = updateConfig(proxies, null, rules);
      res.json({ message: 'Rules updated', data: result });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });
}

module.exports = { registerClashRoutes };
