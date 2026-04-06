/**
 * 存储管理 API — 增强版路由
 * 支持多驱动、存储实例管理（CRUD + enable/disable）+ 完整文件操作
 *
 * 注意：与原有 storageApi.js 共存，此文件提供增强功能
 */
const { Storage } = require('../models');
const registry = require('../drivers/registry');
const storageManager = require('../services/storageManager');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 上传临时目录
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    },
  }),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
});

function registerStorageManagerRoutes(app, authMiddleware) {

  // ========================================
  // 驱动类型查询
  // ========================================

  app.get('/api/driver-types', authMiddleware, (req, res) => {
    const types = registry.listTypes();
    res.json({ data: types, total: types.length });
  });

  app.get('/api/driver-types/:type', authMiddleware, (req, res) => {
    const entry = registry.getType(req.params.type);
    if (!entry) return res.status(404).json({ error: 'Driver type not found' });
    res.json({
      data: {
        type: entry.type,
        name: entry.name,
        description: entry.description,
        configFields: entry.configFields,
      },
    });
  });

  // ========================================
  // 存储实例 CRUD
  // ========================================

  app.get('/api/storages', authMiddleware, async (req, res) => {
    try {
      const storages = await Storage.findAll({
        where: { userId: req.user.id },
        order: [['order', 'ASC'], ['id', 'ASC']],
      });
      res.json({ data: storages, total: storages.length });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/storages/:id', authMiddleware, async (req, res) => {
    try {
      const storage = await Storage.findByPk(req.params.id);
      if (!storage) return res.status(404).json({ error: 'Storage not found' });
      if (storage.userId !== req.user.id) return res.status(403).json({ error: 'Access denied' });
      res.json({ data: storage });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/storages', authMiddleware, async (req, res) => {
    try {
      const { name, type, mountPath, rootFolder, config, order } = req.body;
      if (!name || !type) return res.status(400).json({ error: 'name and type are required' });

      if (!registry.has(type)) {
        return res.status(400).json({ error: `Unknown driver type: ${type}` });
      }

      const storage = await Storage.create({
        name,
        type,
        mountPath: mountPath || '/',
        rootFolder: rootFolder || '/',
        config: config || {},
        order: order || 0,
        status: 'offline',
        userId: req.user.id,
      });

      res.json({ data: storage, message: 'Storage created successfully' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/storages/:id', authMiddleware, async (req, res) => {
    try {
      const storage = await Storage.findByPk(req.params.id);
      if (!storage) return res.status(404).json({ error: 'Storage not found' });
      if (storage.userId !== req.user.id) return res.status(403).json({ error: 'Access denied' });

      const { name, mountPath, rootFolder, config, order } = req.body;
      const updates = {};
      if (name !== undefined) updates.name = name;
      if (mountPath !== undefined) updates.mountPath = mountPath;
      if (rootFolder !== undefined) updates.rootFolder = rootFolder;
      if (config !== undefined) updates.config = config;
      if (order !== undefined) updates.order = order;

      await storage.update(updates);

      if (config !== undefined && storage.status === 'online') {
        await storageManager.enable(storage);
      }

      res.json({ data: storage, message: 'Storage updated successfully' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/storages/:id', authMiddleware, async (req, res) => {
    try {
      const storage = await Storage.findByPk(req.params.id);
      if (!storage) return res.status(404).json({ error: 'Storage not found' });
      if (storage.userId !== req.user.id) return res.status(403).json({ error: 'Access denied' });

      await storageManager.removeDriver(storage.id);
      await storage.destroy();

      res.json({ message: 'Storage deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ========================================
  // 启用 / 禁用
  // ========================================

  app.post('/api/storages/:id/enable', authMiddleware, async (req, res) => {
    try {
      const storage = await Storage.findByPk(req.params.id);
      if (!storage) return res.status(404).json({ error: 'Storage not found' });
      if (storage.userId !== req.user.id) return res.status(403).json({ error: 'Access denied' });

      try {
        await storageManager.enable(storage);
        await storage.update({ status: 'online' });
        res.json({ message: 'Storage enabled', data: { id: storage.id, status: 'online' } });
      } catch (err) {
        await storage.update({ status: 'offline' });
        res.status(500).json({ error: `Failed to enable storage: ${err.message}` });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/storages/:id/disable', authMiddleware, async (req, res) => {
    try {
      const storage = await Storage.findByPk(req.params.id);
      if (!storage) return res.status(404).json({ error: 'Storage not found' });
      if (storage.userId !== req.user.id) return res.status(403).json({ error: 'Access denied' });

      await storageManager.disable(storage.id);
      await storage.update({ status: 'offline' });

      res.json({ message: 'Storage disabled', data: { id: storage.id, status: 'offline' } });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/storages-active', authMiddleware, (req, res) => {
    const active = storageManager.listActive();
    res.json({ data: active, total: active.length });
  });

  // ========================================
  // 多驱动文件操作（通过 storage ID）
  // ========================================

  /** 获取驱动实例的辅助函数 */
  function getDriverForStorage(storageId) {
    return storageManager.getDriver(storageId);
  }

  // 浏览目录
  app.get('/api/storages/:id/browse', authMiddleware, async (req, res) => {
    try {
      const storage = await Storage.findByPk(req.params.id);
      if (!storage) return res.status(404).json({ error: 'Storage not found' });
      if (storage.userId !== req.user.id) return res.status(403).json({ error: 'Access denied' });

      const driver = getDriverForStorage(storage.id);
      if (!driver) return res.status(400).json({ error: 'Storage is not enabled' });

      const dirPath = req.query.path || '/';
      const result = await driver.list(dirPath);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 获取文件/目录信息
  app.get('/api/storages/:id/info', authMiddleware, async (req, res) => {
    try {
      const storage = await Storage.findByPk(req.params.id);
      if (!storage) return res.status(404).json({ error: 'Storage not found' });
      if (storage.userId !== req.user.id) return res.status(403).json({ error: 'Access denied' });

      const driver = getDriverForStorage(storage.id);
      if (!driver) return res.status(400).json({ error: 'Storage is not enabled' });

      const targetPath = req.query.path;
      if (!targetPath) return res.status(400).json({ error: 'path is required' });

      const result = await driver.info(targetPath);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 读取文件内容（文本）
  app.get('/api/storages/:id/read', authMiddleware, async (req, res) => {
    try {
      const storage = await Storage.findByPk(req.params.id);
      if (!storage) return res.status(404).json({ error: 'Storage not found' });
      if (storage.userId !== req.user.id) return res.status(403).json({ error: 'Access denied' });

      const driver = getDriverForStorage(storage.id);
      if (!driver) return res.status(400).json({ error: 'Storage is not enabled' });

      const filePath = req.query.path;
      if (!filePath) return res.status(400).json({ error: 'path is required' });

      const result = await driver.readFile(filePath);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 写入文件内容
  app.post('/api/storages/:id/write', authMiddleware, async (req, res) => {
    try {
      const storage = await Storage.findByPk(req.params.id);
      if (!storage) return res.status(404).json({ error: 'Storage not found' });
      if (storage.userId !== req.user.id) return res.status(403).json({ error: 'Access denied' });

      const driver = getDriverForStorage(storage.id);
      if (!driver) return res.status(400).json({ error: 'Storage is not enabled' });

      const { path: filePath, content, encoding } = req.body;
      if (!filePath) return res.status(400).json({ error: 'path is required' });

      const result = await driver.writeFile(filePath, content || '', encoding);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 上传文件到存储
  app.post('/api/storages/:id/upload', authMiddleware, upload.single('file'), async (req, res) => {
    try {
      const storage = await Storage.findByPk(req.params.id);
      if (!storage) return res.status(404).json({ error: 'Storage not found' });
      if (storage.userId !== req.user.id) return res.status(403).json({ error: 'Access denied' });

      const driver = getDriverForStorage(storage.id);
      if (!driver) return res.status(400).json({ error: 'Storage is not enabled' });

      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

      const targetDir = req.body.path || '/';
      const targetPath = path.posix.join(targetDir === '/' ? '' : targetDir, req.file.originalname);

      // 读取上传的临时文件并写入驱动
      const content = fs.readFileSync(req.file.path);
      await driver.writeFile(targetPath, content);

      // 清理临时文件
      fs.unlinkSync(req.file.path);

      res.json({
        message: 'File uploaded successfully',
        data: { path: targetPath, name: req.file.originalname, size: req.file.size },
      });
    } catch (error) {
      // 清理临时文件
      if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ error: error.message });
    }
  });

  // 下载文件（本地驱动直接流式传输，远程驱动重定向到签名 URL）
  app.get('/api/storages/:id/download', authMiddleware, async (req, res) => {
    try {
      const storage = await Storage.findByPk(req.params.id);
      if (!storage) return res.status(404).json({ error: 'Storage not found' });
      if (storage.userId !== req.user.id) return res.status(403).json({ error: 'Access denied' });

      const driver = getDriverForStorage(storage.id);
      if (!driver) return res.status(400).json({ error: 'Storage is not enabled' });

      const filePath = req.query.path;
      if (!filePath) return res.status(400).json({ error: 'path is required' });

      // 本地驱动：直接读文件流
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
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(path.basename(fullPath))}"`);
        fs.createReadStream(fullPath).pipe(res);
      } else {
        // 远程驱动：获取签名 URL 并重定向
        const linkResult = await driver.link(filePath);
        res.redirect(linkResult.data.url);
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 创建文件夹
  app.post('/api/storages/:id/mkdir', authMiddleware, async (req, res) => {
    try {
      const storage = await Storage.findByPk(req.params.id);
      if (!storage) return res.status(404).json({ error: 'Storage not found' });
      if (storage.userId !== req.user.id) return res.status(403).json({ error: 'Access denied' });

      const driver = getDriverForStorage(storage.id);
      if (!driver) return res.status(400).json({ error: 'Storage is not enabled' });

      const { path: folderPath } = req.body;
      if (!folderPath) return res.status(400).json({ error: 'path is required' });

      const result = await driver.mkdir(folderPath);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 删除文件/目录
  app.delete('/api/storages/:id/remove', authMiddleware, async (req, res) => {
    try {
      const storage = await Storage.findByPk(req.params.id);
      if (!storage) return res.status(404).json({ error: 'Storage not found' });
      if (storage.userId !== req.user.id) return res.status(403).json({ error: 'Access denied' });

      const driver = getDriverForStorage(storage.id);
      if (!driver) return res.status(400).json({ error: 'Storage is not enabled' });

      const targetPath = req.query.path || req.body.path;
      if (!targetPath) return res.status(400).json({ error: 'path is required' });

      const result = await driver.remove(targetPath);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 重命名/移动
  app.post('/api/storages/:id/rename', authMiddleware, async (req, res) => {
    try {
      const storage = await Storage.findByPk(req.params.id);
      if (!storage) return res.status(404).json({ error: 'Storage not found' });
      if (storage.userId !== req.user.id) return res.status(403).json({ error: 'Access denied' });

      const driver = getDriverForStorage(storage.id);
      if (!driver) return res.status(400).json({ error: 'Storage is not enabled' });

      const from = req.body.from || req.body.oldPath;
      const to = req.body.to || req.body.newPath;
      if (!from || !to) return res.status(400).json({ error: 'from/to (or oldPath/newPath) are required' });

      const result = await driver.rename(from, to);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 复制
  app.post('/api/storages/:id/copy', authMiddleware, async (req, res) => {
    try {
      const storage = await Storage.findByPk(req.params.id);
      if (!storage) return res.status(404).json({ error: 'Storage not found' });
      if (storage.userId !== req.user.id) return res.status(403).json({ error: 'Access denied' });

      const driver = getDriverForStorage(storage.id);
      if (!driver) return res.status(400).json({ error: 'Storage is not enabled' });

      const from = req.body.from || req.body.srcPath;
      const to = req.body.to || req.body.dstPath;
      if (!from || !to) return res.status(400).json({ error: 'from/to (or srcPath/dstPath) are required' });

      const result = await driver.copy(from, to);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 移动（rename 别名）
  app.post('/api/storages/:id/move', authMiddleware, async (req, res) => {
    try {
      const storage = await Storage.findByPk(req.params.id);
      if (!storage) return res.status(404).json({ error: 'Storage not found' });
      if (storage.userId !== req.user.id) return res.status(403).json({ error: 'Access denied' });

      const driver = getDriverForStorage(storage.id);
      if (!driver) return res.status(400).json({ error: 'Storage is not enabled' });

      const from = req.body.from || req.body.oldPath || req.body.srcPath;
      const to = req.body.to || req.body.newPath || req.body.dstPath;
      if (!from || !to) return res.status(400).json({ error: 'from/to are required' });

      const result = await driver.rename(from, to);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 搜索文件
  app.get('/api/storages/:id/search', authMiddleware, async (req, res) => {
    try {
      const storage = await Storage.findByPk(req.params.id);
      if (!storage) return res.status(404).json({ error: 'Storage not found' });
      if (storage.userId !== req.user.id) return res.status(403).json({ error: 'Access denied' });

      const driver = getDriverForStorage(storage.id);
      if (!driver) return res.status(400).json({ error: 'Storage is not enabled' });

      const q = req.query.q || req.query.keyword;
      if (!q) return res.status(400).json({ error: 'q (search keyword) is required' });

      const dirPath = req.query.path || '/';
      const result = await driver.search(dirPath, q);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 检查文件是否存在
  app.get('/api/storages/:id/exists', authMiddleware, async (req, res) => {
    try {
      const storage = await Storage.findByPk(req.params.id);
      if (!storage) return res.status(404).json({ error: 'Storage not found' });
      if (storage.userId !== req.user.id) return res.status(403).json({ error: 'Access denied' });

      const driver = getDriverForStorage(storage.id);
      if (!driver) return res.status(400).json({ error: 'Storage is not enabled' });

      const targetPath = req.query.path;
      if (!targetPath) return res.status(400).json({ error: 'path is required' });

      const result = await driver.exists(targetPath);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}

module.exports = { registerStorageManagerRoutes };
