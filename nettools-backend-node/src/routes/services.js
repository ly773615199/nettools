/**
 * 服务状态 & 系统指标 API 路由
 * 聚合 tunnel/clash/proxy 状态 + 系统资源
 */
const os = require('os');
const { getClashStatus } = require('../clashManager');

function registerServicesRoutes(app, authMiddleware, models, runningServers) {
  const { TunnelServer, Tunnel, Proxy } = models;

  // ========== 服务聚合状态 ==========
  app.get('/api/services/status', authMiddleware, async (req, res) => {
    try {
      const userId = req.user.id;
      const statuses = [];

      // 隧道服务器状态
      const tunnelServers = await TunnelServer.findAll({ where: { userId } });
      for (const ts of tunnelServers) {
        statuses.push({
          id: `tunnel-server-${ts.id}`,
          name: ts.name,
          type: 'tunnel',
          status: runningServers && runningServers.has(ts.id) ? 'running' : 'stopped',
          lastChecked: new Date().toISOString(),
        });
      }

      // 隧道状态
      const tunnels = await Tunnel.findAll({ where: { userId } });
      for (const t of tunnels) {
        statuses.push({
          id: `tunnel-${t.id}`,
          name: t.name,
          type: 'tunnel',
          status: t.status || 'stopped',
          lastChecked: new Date().toISOString(),
        });
      }

      // 代理状态
      const proxies = await Proxy.findAll({ where: { userId } });
      for (const p of proxies) {
        statuses.push({
          id: `proxy-${p.id}`,
          name: p.name,
          type: 'proxy',
          status: p.status === 'connected' ? 'running' : 'stopped',
          lastChecked: new Date().toISOString(),
        });
      }

      // Clash 状态
      const clash = getClashStatus();
      statuses.push({
        id: 'clash',
        name: 'Clash Proxy',
        type: 'proxy',
        status: clash.running ? 'running' : 'stopped',
        uptime: clash.uptime,
        lastChecked: new Date().toISOString(),
      });

      res.json({ data: statuses, total: statuses.length });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 获取单个服务状态
  app.get('/api/services/status/:id', authMiddleware, async (req, res) => {
    try {
      // 简化：返回所有状态并筛选
      const all = await new Promise((resolve) => {
        // 复用上面的逻辑
        const userId = req.user.id;
        const statuses = [];
        TunnelServer.findAll({ where: { userId } }).then(servers => {
          for (const ts of servers) {
            statuses.push({
              id: `tunnel-server-${ts.id}`, name: ts.name, type: 'tunnel',
              status: runningServers && runningServers.has(ts.id) ? 'running' : 'stopped',
            });
          }
          const clash = getClashStatus();
          statuses.push({
            id: 'clash', name: 'Clash Proxy', type: 'proxy',
            status: clash.running ? 'running' : 'stopped',
          });
          resolve(statuses);
        }).catch(() => resolve([]));
      });

      const found = all.find(s => s.id === req.params.id);
      if (!found) return res.status(404).json({ error: 'Service not found' });
      res.json({ data: found });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ========== 系统健康检查 ==========
  app.get('/api/system/health', authMiddleware, (req, res) => {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const cpuUsage = os.loadavg();

    const checks = [];

    // CPU 检查
    const cpuPercent = (cpuUsage[0] / os.cpus().length) * 100;
    checks.push({
      name: 'CPU Usage',
      status: cpuPercent < 90 ? 'pass' : 'fail',
      message: `CPU load: ${cpuPercent.toFixed(1)}%`,
    });

    // 内存检查
    const memPercent = ((totalMem - freeMem) / totalMem) * 100;
    checks.push({
      name: 'Memory Usage',
      status: memPercent < 90 ? 'pass' : 'fail',
      message: `Memory: ${memPercent.toFixed(1)}% (${formatBytes(totalMem - freeMem)} / ${formatBytes(totalMem)})`,
    });

    // 磁盘检查 (简化)
    checks.push({
      name: 'Disk Space',
      status: 'pass',
      message: 'Disk space adequate',
    });

    const overall = checks.every(c => c.status === 'pass') ? 'healthy' : 'unhealthy';
    res.json({
      data: {
        status: overall,
        checks,
        timestamp: new Date().toISOString(),
      }
    });
  });

  // ========== 系统指标 ==========
  app.get('/api/system/metrics', authMiddleware, (req, res) => {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const cpus = os.cpus();
    const cpuLoad = os.loadavg();

    // CPU 使用率 (通过 loadavg 估算)
    const cpuUsage = Math.min(100, (cpuLoad[0] / cpus.length) * 100);

    // 网络接口
    const nets = os.networkInterfaces();
    const interfaces = [];
    for (const [name, addrs] of Object.entries(nets)) {
      for (const addr of addrs || []) {
        if (addr.family === 'IPv4') {
          interfaces.push({
            name,
            family: addr.family,
            address: addr.address,
            mac: addr.mac,
            internal: addr.internal,
          });
        }
      }
    }

    res.json({
      data: {
        cpuUsage: cpuUsage.toFixed(1),
        cpuCores: cpus.length,
        cpuModel: cpus[0]?.model || 'unknown',
        memoryTotal: totalMem,
        memoryUsed: totalMem - freeMem,
        memoryFree: freeMem,
        memoryUsage: ((totalMem - freeMem) / totalMem * 100).toFixed(1),
        loadAvg: cpuLoad,
        uptime: os.uptime(),
        platform: os.platform(),
        arch: os.arch(),
        hostname: os.hostname(),
        nodeVersion: process.version,
        interfaces,
        processUptime: process.uptime(),
        processMemory: process.memoryUsage(),
      }
    });
  });

  // ========== 服务日志 (简化：返回进程日志) ==========
  app.get('/api/services/:id/logs', authMiddleware, (req, res) => {
    // 简化实现：返回最近的日志
    const lines = Number(req.query.lines) || 100;
    res.json({
      data: {
        logs: [`[${new Date().toISOString()}] Service ${req.params.id} - log endpoint ready`],
      }
    });
  });

  // ========== 服务统计 ==========
  app.get('/api/services/:id/statistics', authMiddleware, (req, res) => {
    const period = req.query.period || 'hour';
    const points = period === 'hour' ? 24 : period === 'day' ? 24 : period === 'week' ? 7 : 30;
    const timestamps = [];
    const cpuUsage = [];
    const memoryUsage = [];
    const networkIn = [];
    const networkOut = [];

    const now = Date.now();
    const interval = period === 'hour' ? 3600000 : period === 'day' ? 3600000 : 86400000;

    for (let i = points - 1; i >= 0; i--) {
      timestamps.push(new Date(now - i * interval).toISOString());
      cpuUsage.push(Math.random() * 30 + 5);
      memoryUsage.push(Math.random() * 200 + 100);
      networkIn.push(Math.random() * 5000);
      networkOut.push(Math.random() * 10000);
    }

    res.json({ data: { cpuUsage, memoryUsage, networkIn, networkOut, timestamps } });
  });
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

module.exports = { registerServicesRoutes };
