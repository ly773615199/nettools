/**
 * 离线下载管理路由
 */
const fs = require('fs');
const path = require('path');
const { authMiddleware } = require('../core/auth');
const dlManager = require('../downloadManager');

function registerDownloadRoutes(app) {
  app.get('/api/downloads', authMiddleware, (req, res) => {
    res.json({ data: dlManager.getTasks() });
  });

  app.get('/api/downloads/:id', authMiddleware, (req, res) => {
    const task = dlManager.getTask(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json({ data: task });
  });

  app.post('/api/downloads', authMiddleware, (req, res) => {
    const { url, targetPath, filename } = req.body;
    if (!url) return res.status(400).json({ error: 'url is required' });
    const task = dlManager.createTask(url, targetPath, filename);
    const result = dlManager.startDownload(task.id);
    res.json({ data: task, message: result.message, error: result.error });
  });

  app.delete('/api/downloads/:id', authMiddleware, (req, res) => {
    const result = dlManager.deleteTask(req.params.id);
    if (!result.success) return res.status(400).json({ error: result.error });
    res.json({ message: result.message });
  });

  app.post('/api/downloads/:id/cancel', authMiddleware, (req, res) => {
    const result = dlManager.cancelTask(req.params.id);
    if (!result.success) return res.status(400).json({ error: result.error });
    res.json({ message: result.message });
  });

  // 已下载文件列表
  app.get('/api/downloads-files', authMiddleware, (req, res) => {
    try {
      const dir = dlManager.DOWNLOAD_DIR;
      if (!fs.existsSync(dir)) return res.json({ data: [], total: 0 });
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const files = entries.filter(e => e.isFile()).map(e => {
        const stats = fs.statSync(path.join(dir, e.name));
        return {
          name: e.name,
          size: stats.size,
          modified: stats.mtime.toISOString(),
          downloadUrl: `/api/downloads-files/${encodeURIComponent(e.name)}`,
        };
      });
      res.json({ data: files, total: files.length });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 下载已存储的文件
  app.get('/api/downloads-files/:filename', authMiddleware, (req, res) => {
    const filePath = path.join(dlManager.DOWNLOAD_DIR, req.params.filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
    res.sendFile(filePath);
  });
}

module.exports = { registerDownloadRoutes };
