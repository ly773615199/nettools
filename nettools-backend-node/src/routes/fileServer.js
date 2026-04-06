/**
 * 文件服务管理 API 路由 [G1]
 * 多协议文件访问服务 CRUD + 启停
 */
const fileServerManager = require('../services/fileServerManager');

function registerFileServerRoutes(app, authMiddleware, requirePerm) {
  // 获取所有运行中的文件服务
  app.get('/api/fileserver/status', authMiddleware, requirePerm('fileServer', 'list'), (req, res) => {
    try {
      const status = fileServerManager.getServerStatus();
      res.json({ data: status, total: status.length });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 启动 HTTP 文件服务
  app.post('/api/fileserver/http', authMiddleware, requirePerm('fileServer', 'create'), (req, res) => {
    try {
      const { port, storageDir, auth, username, password } = req.body;
      if (!port || !storageDir) {
        return res.status(400).json({ error: 'port and storageDir are required' });
      }
      const result = fileServerManager.startHttpServer({
        port: Number(port),
        storageDir,
        auth: auth || false,
        username: username || null,
        password: password || null,
      });
      res.json({ data: result, message: 'HTTP file server started' });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // 启动 WebDAV 文件服务
  app.post('/api/fileserver/webdav', authMiddleware, requirePerm('fileServer', 'create'), (req, res) => {
    try {
      const { port, storageDir, auth, username, password } = req.body;
      if (!port || !storageDir) {
        return res.status(400).json({ error: 'port and storageDir are required' });
      }
      const result = fileServerManager.startWebdavServer({
        port: Number(port),
        storageDir,
        auth: auth || false,
        username: username || null,
        password: password || null,
      });
      res.json({ data: result, message: 'WebDAV file server started' });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // 停止文件服务
  app.delete('/api/fileserver/:key', authMiddleware, requirePerm('fileServer', 'stop'), (req, res) => {
    try {
      const key = decodeURIComponent(req.params.key);
      fileServerManager.stopServer(key);
      res.json({ message: `Server ${key} stopped` });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // 检查端口可用性
  app.get('/api/fileserver/check-port/:port', authMiddleware, requirePerm('fileServer', 'create'), (req, res) => {
    const net = require('net');
    const port = Number(req.params.port);
    const tester = net.createServer()
      .once('error', () => res.json({ data: { available: false } }))
      .once('listening', () => {
        tester.close();
        res.json({ data: { available: true } });
      })
      .listen(port);
  });
}

module.exports = { registerFileServerRoutes };
