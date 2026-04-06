/**
 * Clash 增强 API 路由
 * 包括：代理规则 CRUD、代理组 CRUD、系统代理、配置生成
 */
const { Proxy, ProxyRule, ProxyGroup } = require('../models');
const { startClash, stopClash, restartClash, getClashStatus } = require('../clashManager');
const clashConfig = require('../services/clashConfig');
const systemProxy = require('../services/systemProxy');

function registerClashEnhancedRoutes(app, authMiddleware) {

  // ========================================
  // 代理规则 CRUD
  // ========================================

  app.get('/api/clash/rules', authMiddleware, async (req, res) => {
    try {
      const rules = await ProxyRule.findAll({
        where: { userId: req.user.id },
        order: [['priority', 'DESC'], ['id', 'ASC']],
      });
      res.json({ data: rules, total: rules.length });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/clash/rules', authMiddleware, async (req, res) => {
    try {
      const { type, value, proxy, priority, enabled } = req.body;
      if (!type || !value) return res.status(400).json({ error: 'type and value are required' });

      const rule = await ProxyRule.create({
        type,
        value,
        proxy: proxy || 'DIRECT',
        priority: priority || 0,
        enabled: enabled !== false,
        userId: req.user.id,
      });
      res.json({ data: rule, message: 'Rule created' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/clash/rules/:id', authMiddleware, async (req, res) => {
    try {
      const rule = await ProxyRule.findByPk(req.params.id);
      if (!rule) return res.status(404).json({ error: 'Rule not found' });
      if (rule.userId !== req.user.id) return res.status(403).json({ error: 'Access denied' });

      const { type, value, proxy, priority, enabled } = req.body;
      const updates = {};
      if (type !== undefined) updates.type = type;
      if (value !== undefined) updates.value = value;
      if (proxy !== undefined) updates.proxy = proxy;
      if (priority !== undefined) updates.priority = priority;
      if (enabled !== undefined) updates.enabled = enabled;

      await rule.update(updates);
      res.json({ data: rule, message: 'Rule updated' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/clash/rules/:id', authMiddleware, async (req, res) => {
    try {
      const rule = await ProxyRule.findByPk(req.params.id);
      if (!rule) return res.status(404).json({ error: 'Rule not found' });
      if (rule.userId !== req.user.id) return res.status(403).json({ error: 'Access denied' });
      await rule.destroy();
      res.json({ message: 'Rule deleted' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 批量操作
  app.post('/api/clash/rules/batch', authMiddleware, async (req, res) => {
    try {
      const { rules } = req.body;
      if (!Array.isArray(rules)) return res.status(400).json({ error: 'rules must be an array' });

      // 删除旧规则
      await ProxyRule.destroy({ where: { userId: req.user.id } });

      // 创建新规则
      const created = await Promise.all(
        rules.map((r, i) => ProxyRule.create({
          type: r.type,
          value: r.value,
          proxy: r.proxy || 'DIRECT',
          priority: r.priority ?? (rules.length - i),
          enabled: r.enabled !== false,
          userId: req.user.id,
        }))
      );

      res.json({ data: created, total: created.length, message: 'Rules replaced' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ========================================
  // 代理组 CRUD
  // ========================================

  app.get('/api/clash/groups', authMiddleware, async (req, res) => {
    try {
      const groups = await ProxyGroup.findAll({
        where: { userId: req.user.id },
        order: [['id', 'ASC']],
      });
      res.json({ data: groups, total: groups.length });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/clash/groups', authMiddleware, async (req, res) => {
    try {
      const { name, type, proxies, url, interval, enabled } = req.body;
      if (!name) return res.status(400).json({ error: 'name is required' });

      const group = await ProxyGroup.create({
        name,
        type: type || 'select',
        proxies: proxies || [],
        url: url || null,
        interval: interval || 300,
        enabled: enabled !== false,
        userId: req.user.id,
      });
      res.json({ data: group, message: 'Group created' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/clash/groups/:id', authMiddleware, async (req, res) => {
    try {
      const group = await ProxyGroup.findByPk(req.params.id);
      if (!group) return res.status(404).json({ error: 'Group not found' });
      if (group.userId !== req.user.id) return res.status(403).json({ error: 'Access denied' });

      const { name, type, proxies, url, interval, enabled } = req.body;
      const updates = {};
      if (name !== undefined) updates.name = name;
      if (type !== undefined) updates.type = type;
      if (proxies !== undefined) updates.proxies = proxies;
      if (url !== undefined) updates.url = url;
      if (interval !== undefined) updates.interval = interval;
      if (enabled !== undefined) updates.enabled = enabled;

      await group.update(updates);
      res.json({ data: group, message: 'Group updated' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/clash/groups/:id', authMiddleware, async (req, res) => {
    try {
      const group = await ProxyGroup.findByPk(req.params.id);
      if (!group) return res.status(404).json({ error: 'Group not found' });
      if (group.userId !== req.user.id) return res.status(403).json({ error: 'Access denied' });
      await group.destroy();
      res.json({ message: 'Group deleted' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ========================================
  // Clash 配置生成
  // ========================================

  app.post('/api/clash/generate', authMiddleware, async (req, res) => {
    try {
      const { mode } = req.body;
      const proxies = await Proxy.findAll({ where: { userId: req.user.id } });
      const proxyRules = await ProxyRule.findAll({ where: { userId: req.user.id, enabled: true } });
      const proxyGroups = await ProxyGroup.findAll({ where: { userId: req.user.id, enabled: true } });

      const config = clashConfig.generateConfig({
        proxies,
        proxyRules,
        proxyGroups,
        mode: mode || 'Rule',
      });

      const result = clashConfig.writeConfigFile(config);
      res.json({ data: config, file: result.path, message: 'Clash config generated' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 读取当前配置
  app.get('/api/clash/config-file', authMiddleware, (req, res) => {
    const config = clashConfig.readConfigFile();
    if (!config) return res.status(404).json({ error: 'Config file not found' });
    res.json({ data: config });
  });

  // ========================================
  // 系统代理
  // ========================================

  app.get('/api/system-proxy/status', authMiddleware, (req, res) => {
    res.json({ data: systemProxy.getStatus() });
  });

  app.post('/api/system-proxy/enable', authMiddleware, (req, res) => {
    const { host, port } = req.body;
    const result = systemProxy.enable(host || '127.0.0.1', port || 7890);
    if (!result.success) return res.status(500).json({ error: result.error });
    res.json({ message: result.message });
  });

  app.post('/api/system-proxy/disable', authMiddleware, (req, res) => {
    const result = systemProxy.disable();
    if (!result.success) return res.status(500).json({ error: result.error });
    res.json({ message: result.message });
  });

  // ========================================
  // TUN 模式
  // ========================================

  app.get('/api/clash/tun', authMiddleware, (req, res) => {
    const config = clashConfig.readConfigFile();
    const tun = config?.tun || { enable: false };
    res.json({ data: tun });
  });

  app.put('/api/clash/tun', authMiddleware, async (req, res) => {
    try {
      const { enable, stack, dnsHijack, autoRoute, autoDetect, device } = req.body;
      const proxies = await Proxy.findAll({ where: { userId: req.user.id } });
      const proxyRules = await ProxyRule.findAll({ where: { userId: req.user.id, enabled: true } });
      const proxyGroups = await ProxyGroup.findAll({ where: { userId: req.user.id, enabled: true } });

      const tunConfig = enable ? { enable: true, stack, dnsHijack, autoRoute, autoDetect, device } : { enable: false };
      const config = clashConfig.generateFullConfig({
        proxies, proxyRules, proxyGroups, mode: 'Rule', tun: tunConfig,
      });

      clashConfig.writeConfigFile(config);
      res.json({ data: config.tun, message: `TUN mode ${enable ? 'enabled' : 'disabled'}` });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ========================================
  // 链式代理
  // ========================================

  app.get('/api/clash/chain', authMiddleware, (req, res) => {
    const config = clashConfig.readConfigFile();
    res.json({ data: config?.listeners || [] });
  });

  app.put('/api/clash/chain', authMiddleware, async (req, res) => {
    try {
      const { chains } = req.body;
      if (!Array.isArray(chains)) return res.status(400).json({ error: 'chains must be an array' });

      const proxies = await Proxy.findAll({ where: { userId: req.user.id } });
      const proxyRules = await ProxyRule.findAll({ where: { userId: req.user.id, enabled: true } });
      const proxyGroups = await ProxyGroup.findAll({ where: { userId: req.user.id, enabled: true } });

      const config = clashConfig.generateFullConfig({
        proxies, proxyRules, proxyGroups, mode: 'Rule', chain: chains,
      });

      clashConfig.writeConfigFile(config);
      res.json({ data: config.listeners || [], message: 'Chain proxy config updated' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 完整配置生成 (支持 TUN + Chain + 自定义)
  app.post('/api/clash/generate-full', authMiddleware, async (req, res) => {
    try {
      const { mode, tun, chain, customConfig } = req.body;
      const proxies = await Proxy.findAll({ where: { userId: req.user.id } });
      const proxyRules = await ProxyRule.findAll({ where: { userId: req.user.id, enabled: true } });
      const proxyGroups = await ProxyGroup.findAll({ where: { userId: req.user.id, enabled: true } });

      const config = clashConfig.generateFullConfig({
        proxies, proxyRules, proxyGroups, mode: mode || 'Rule', tun, chain, customConfig,
      });

      const result = clashConfig.writeConfigFile(config);
      res.json({ data: config, file: result.path, message: 'Full Clash config generated' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}

module.exports = { registerClashEnhancedRoutes };
