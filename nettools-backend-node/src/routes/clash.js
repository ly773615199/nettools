/**
 * Clash 管理路由
 */
const { authMiddleware } = require('../core/auth');
const { startClash, stopClash, restartClash, getClashStatus, getCurrentConfig, updateConfig, setTunMode, getTunStatus } = require('../clashManager');

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

  // ==================== TUN 模式 API ====================

  // 获取 TUN 状态
  app.get('/api/clash/tun', authMiddleware, (req, res) => {
    res.json({ data: getTunStatus() });
  });

  // 启用/禁用 TUN 模式
  app.put('/api/clash/tun', authMiddleware, async (req, res) => {
    try {
      const { enable, stack, dnsHijack, autoRoute, autoDetect, device } = req.body;
      const result = setTunMode(enable !== false, { stack, dnsHijack, autoRoute, autoDetect, device });
      res.json({ message: enable !== false ? 'TUN enabled' : 'TUN disabled', data: result });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 启动 TUN 模式的 Clash (快捷接口)
  app.post('/api/clash/start-tun', authMiddleware, async (req, res) => {
    try {
      const { stack, dnsHijack } = req.body;
      const proxies = await Proxy.findAll({ where: { userId: req.user.id } });

      // 先生成基础配置
      const result = startClash(proxies);
      if (!result.success) return res.status(500).json({ error: result.error });

      // 然后启用 TUN
      setTunMode(true, { stack, dnsHijack });

      // 重启以应用 TUN 配置
      restartClash(proxies);

      res.json({ message: 'Clash started with TUN mode', data: { tun: true, stack: stack || 'mixed' } });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });
}

module.exports = { registerClashRoutes };
