/**
 * 系统路由 — 设置/信息/日志/健康检查
 */
const os = require('os');
const { authMiddleware } = require('../core/auth');
const { getRecentLogs } = require('../utils/logger');
const { getClashStatus } = require('../clashManager');
const wsManager = require('../wsManager');

function registerSystemRoutes(app, models) {
  const { SystemSetting } = models;

  // 健康检查
  app.get('/health', (req, res) => {
    const memUsage = process.memoryUsage();
    const clashStatus = getClashStatus();
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0',
      system: {
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version,
        hostname: os.hostname(),
        cpuCount: os.cpus().length,
        totalMemory: os.totalmem(),
        freeMemory: os.freemem(),
        loadAvg: os.loadavg(),
      },
      process: {
        pid: process.pid,
        memory: { rss: memUsage.rss, heapUsed: memUsage.heapUsed, heapTotal: memUsage.heapTotal },
      },
      services: {
        clash: { running: clashStatus.running, hasBinary: clashStatus.hasBinary },
        websocket: wsManager.getStats(),
      },
    });
  });

  // 根路径
  app.get('/', (req, res) => {
    res.json({
      message: 'Welcome to NetTools API',
      version: '1.0.0',
      endpoints: {
        health: '/health',
        auth: '/api/auth/*',
        users: '/api/users/*',
        files: '/api/files/*',
        tunnels: '/api/tunnels/*',
        proxies: '/api/proxies/*',
        storage: '/api/storage/*',
        clash: '/api/clash/*',
        network: '/api/network/*',
        downloads: '/api/downloads/*',
        system: '/api/system/*',
      }
    });
  });

  // 系统设置
  app.get('/api/system/settings', authMiddleware, async (req, res) => {
    try {
      const settings = await SystemSetting.findAll();
      const settingsMap = {};
      settings.forEach(s => { settingsMap[s.key] = s.value; });
      res.json({ data: settingsMap });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.put('/api/system/settings', authMiddleware, async (req, res) => {
    try {
      const settings = req.body;
      for (const [key, value] of Object.entries(settings)) {
        await SystemSetting.upsert({ key, value, description: '' });
      }
      res.json({ message: 'System settings updated successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // 系统信息（兼容旧路径）
  app.get('/api/system/info', authMiddleware, async (req, res) => {
    try {
      const settings = await SystemSetting.findAll();
      const map = {};
      settings.forEach(s => { map[s.key] = s.value; });
      res.json({
        data: {
          platform: process.platform,
          nodeVersion: process.version,
          uptime: process.uptime(),
          settings: map
        }
      });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // 日志
  app.get('/api/system/logs', authMiddleware, (req, res) => {
    const lines = Number(req.query.lines) || 100;
    const logs = getRecentLogs(lines);
    res.json({ data: logs, total: logs.length });
  });
}

module.exports = { registerSystemRoutes };
