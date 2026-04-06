/**
 * 网络监控路由
 */
const { authMiddleware } = require('../core/auth');
const netMonitor = require('../networkMonitor');

function registerNetworkRoutes(app) {
  app.get('/api/network/status', authMiddleware, (req, res) => {
    res.json({ data: netMonitor.getNetworkStatus() });
  });

  app.get('/api/network/interfaces', authMiddleware, (req, res) => {
    res.json({ data: netMonitor.getNetworkInterfaces() });
  });

  app.get('/api/network/traffic', authMiddleware, (req, res) => {
    res.json(netMonitor.getTrafficStats());
  });

  app.get('/api/network/connections', authMiddleware, (req, res) => {
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
}

module.exports = { registerNetworkRoutes };
