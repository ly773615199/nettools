/**
 * 文件预览路由 — 文本/图片/PDF 预览 + 原始文件下载
 */
const fs = require('fs');
const path = require('path');
const { authMiddleware } = require('../core/auth');

function registerPreviewRoutes(app) {
  // 统一驱动查找
  function findDriver(driverOrStorageId) {
    const storageManager = require('../services/storageManager');
    const smDriver = storageManager.getDriver(driverOrStorageId);
    if (smDriver) return smDriver;
    const legacyDrivers = require('../drivers/storageApi').drivers;
    return legacyDrivers.get(driverOrStorageId) || null;
  }

  // 文本预览
  app.get('/api/preview', authMiddleware, async (req, res) => {
    try {
      const { driver: driverId = 'local', path: filePath } = req.query;
      if (!filePath) return res.status(400).json({ error: 'path is required' });

      const driver = findDriver(driverId);
      if (!driver) return res.status(400).json({ error: 'Unknown driver or storage not enabled' });

      const ext = path.extname(filePath).toLowerCase();
      const textExts = ['.txt', '.js', '.ts', '.json', '.css', '.html', '.xml', '.yaml', '.yml', '.md', '.sh', '.py', '.go', '.rs', '.java', '.c', '.cpp', '.h', '.log', '.conf', '.cfg', '.ini', '.env'];
      const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.ico'];

      if (textExts.includes(ext)) {
        const result = await driver.readFile(filePath);
        return res.json({ data: { type: 'text', content: result.data, meta: result.meta } });
      }

      if (imageExts.includes(ext)) {
        return res.json({
          data: { type: 'image', previewUrl: `/api/storage/raw?driver=${encodeURIComponent(driverId)}&path=${encodeURIComponent(filePath)}` },
        });
      }

      if (ext === '.pdf') {
        return res.json({
          data: { type: 'pdf', previewUrl: `/api/storage/raw?driver=${encodeURIComponent(driverId)}&path=${encodeURIComponent(filePath)}` },
        });
      }

      const info = await driver.info(filePath);
      res.json({
        data: {
          type: 'binary',
          name: info.data.name,
          size: info.data.size,
          downloadUrl: `/api/storage/raw?driver=${encodeURIComponent(driverId)}&path=${encodeURIComponent(filePath)}`,
        },
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 原始文件下载（支持 Range）
  app.get('/api/storage/raw', authMiddleware, async (req, res) => {
    try {
      const { driver: driverId = 'local', path: filePath } = req.query;
      if (!filePath) return res.status(400).json({ error: 'path is required' });

      const driver = findDriver(driverId);
      if (!driver) return res.status(400).json({ error: 'Unknown driver or storage not enabled' });

      if (driver._safePath) {
        const fullPath = driver._safePath(filePath);
        if (!fs.existsSync(fullPath)) return res.status(404).json({ error: 'File not found' });
        const stats = fs.statSync(fullPath);
        const ext = path.extname(fullPath).toLowerCase();
        const mimeMap = {
          '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
          '.json': 'application/json', '.xml': 'application/xml',
          '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
          '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp',
          '.pdf': 'application/pdf', '.zip': 'application/zip',
          '.mp4': 'video/mp4', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
          '.txt': 'text/plain', '.md': 'text/markdown',
        };
        res.setHeader('Content-Type', mimeMap[ext] || 'application/octet-stream');
        res.setHeader('Content-Length', stats.size);
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(path.basename(fullPath))}"`);
        fs.createReadStream(fullPath).pipe(res);
      } else {
        const linkResult = await driver.link(filePath);
        res.redirect(linkResult.data.url);
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}

module.exports = { registerPreviewRoutes };
