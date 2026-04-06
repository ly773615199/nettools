/**
 * 网络监控路由
 */
const { authMiddleware } = require('../core/auth');
const netMonitor = require('../networkMonitor');
const { cacheMiddleware } = require('../services/cache');
const networkAdapter = require('../services/networkAdapter');

function registerNetworkRoutes(app) {
  app.get('/api/network/status', authMiddleware, cacheMiddleware('network:status', 5000), (req, res) => {
    res.json({ data: netMonitor.getNetworkStatus() });
  });

  app.get('/api/network/interfaces', authMiddleware, cacheMiddleware('network:ifaces', 30000), (req, res) => {
    res.json({ data: netMonitor.getNetworkInterfaces() });
  });

  app.get('/api/network/traffic', authMiddleware, cacheMiddleware('network:traffic', 3000), (req, res) => {
    res.json(netMonitor.getTrafficStats());
  });

  app.get('/api/network/connections', authMiddleware, cacheMiddleware('network:conns', 3000), (req, res) => {
    res.json(netMonitor.getConnections());
  });

  app.post('/api/network/ping', authMiddleware, (req, res) => {
    const { host, count } = req.body;
    const result = netMonitor.pingTest(host || '8.8.8.8', count || 4);
    res.json({ data: result });
  });

  app.post('/api/network/http-test', authMiddleware, async (req, res) => {
    const { url } = req.body;
    const result = await netMonitor.httpTest(url || 'https://www.baidu.com');
    res.json({ data: result });
  });

  // 网络环境适配报告
  app.get('/api/network/adapter-report', authMiddleware, (req, res) => {
    const report = networkAdapter.generateReport();
    res.json({ data: report });
  });

  // 获取网络快照
  app.get('/api/network/snapshot', authMiddleware, (req, res) => {
    res.json({ data: networkAdapter.getNetworkSnapshot() });
  });
}

module.exports = { registerNetworkRoutes };
