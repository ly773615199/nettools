/**
 * 存储驱动 API 路由
 * 支持本地文件系统和内存存储两种驱动
 */
const { LocalStorageDriver } = require('./localStorageDriver');
const { MemoryStorageDriver } = require('./memoryStorageDriver');
const path = require('path');
const fs = require('fs');

// 驱动实例注册表
const drivers = new Map();

// 默认加载本地存储（以 /data 目录为根目录，或用户 HOME）
const DEFAULT_STORAGE_ROOT = path.join(__dirname, '..', '..', 'storage-data');
if (!fs.existsSync(DEFAULT_STORAGE_ROOT)) {
  fs.mkdirSync(DEFAULT_STORAGE_ROOT, { recursive: true });
}
const defaultLocal = new LocalStorageDriver(DEFAULT_STORAGE_ROOT);
drivers.set('local', defaultLocal);

// 默认加载内存存储
const defaultMemory = new MemoryStorageDriver();
drivers.set('memory', defaultMemory);

/**
 * 注册存储 API 路由到 Express app
 */
function registerStorageRoutes(app, authMiddleware) {

  // 获取所有驱动列表
  app.get('/api/drivers', authMiddleware, (req, res) => {
    const list = [];
    for (const [id, driver] of drivers) {
      list.push({ id, name: driver.name, type: driver.type });
    }
    res.json({ data: list, total: list.length });
  });

  // 列出目录
  app.get('/api/storage/browse', authMiddleware, async (req, res) => {
    try {
      const { driver: driverId = 'local', path: dirPath = '/' } = req.query;
      const driver = drivers.get(driverId);
      if (!driver) return res.status(400).json({ error: 'Unknown driver: ' + driverId });
      const result = await driver.list(dirPath);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 获取文件/目录信息
  app.get('/api/storage/info', authMiddleware, async (req, res) => {
    try {
      const { driver: driverId = 'local', path: targetPath } = req.query;
      if (!targetPath) return res.status(400).json({ error: 'path is required' });
      const driver = drivers.get(driverId);
      if (!driver) return res.status(400).json({ error: 'Unknown driver' });
      const result = await driver.info(targetPath);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 读取文件内容
  app.get('/api/storage/read', authMiddleware, async (req, res) => {
    try {
      const { driver: driverId = 'local', path: filePath } = req.query;
      if (!filePath) return res.status(400).json({ error: 'path is required' });
      const driver = drivers.get(driverId);
      if (!driver) return res.status(400).json({ error: 'Unknown driver' });
      const result = await driver.readFile(filePath);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 写入/上传文件
  app.post('/api/storage/write', authMiddleware, async (req, res) => {
    try {
      const { driver: driverId = 'local', path: filePath, content, encoding } = req.body;
      if (!filePath) return res.status(400).json({ error: 'path is required' });
      const driver = drivers.get(driverId);
      if (!driver) return res.status(400).json({ error: 'Unknown driver' });
      const result = await driver.writeFile(filePath, content || '', encoding);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 创建文件夹
  app.post('/api/storage/mkdir', authMiddleware, async (req, res) => {
    try {
      const { driver: driverId = 'local', path: folderPath } = req.body;
      if (!folderPath) return res.status(400).json({ error: 'path is required' });
      const driver = drivers.get(driverId);
      if (!driver) return res.status(400).json({ error: 'Unknown driver' });
      const result = await driver.createFolder(folderPath);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 删除
  app.delete('/api/storage/remove', authMiddleware, async (req, res) => {
    try {
      const { driver: driverId = 'local', path: targetPath } = req.query;
      if (!targetPath) return res.status(400).json({ error: 'path is required' });
      const driver = drivers.get(driverId);
      if (!driver) return res.status(400).json({ error: 'Unknown driver' });
      const result = await driver.delete(targetPath);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 重命名
  app.post('/api/storage/rename', authMiddleware, async (req, res) => {
    try {
      const { driver: driverId = 'local', from, to } = req.body;
      if (!from || !to) return res.status(400).json({ error: 'from and to are required' });
      const driver = drivers.get(driverId);
      if (!driver) return res.status(400).json({ error: 'Unknown driver' });
      const result = await driver.rename(from, to);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 复制
  app.post('/api/storage/copy', authMiddleware, async (req, res) => {
    try {
      const { driver: driverId = 'local', from, to } = req.body;
      if (!from || !to) return res.status(400).json({ error: 'from and to are required' });
      const driver = drivers.get(driverId);
      if (!driver) return res.status(400).json({ error: 'Unknown driver' });
      const result = await driver.copy(from, to);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 移动（rename 别名）
  app.post('/api/storage/move', authMiddleware, async (req, res) => {
    try {
      const { driver: driverId = 'local', from, to } = req.body;
      if (!from || !to) return res.status(400).json({ error: 'from and to are required' });
      const driver = drivers.get(driverId);
      if (!driver) return res.status(400).json({ error: 'Unknown driver' });
      const result = await driver.rename(from, to);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 检查是否存在
  app.get('/api/storage/exists', authMiddleware, async (req, res) => {
    try {
      const { driver: driverId = 'local', path: targetPath } = req.query;
      if (!targetPath) return res.status(400).json({ error: 'path is required' });
      const driver = drivers.get(driverId);
      if (!driver) return res.status(400).json({ error: 'Unknown driver' });
      const result = await driver.exists(targetPath);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 搜索文件（仅本地驱动）
  app.get('/api/storage/search', authMiddleware, async (req, res) => {
    try {
      const { driver: driverId = 'local', path: dirPath = '/', q } = req.query;
      if (!q) return res.status(400).json({ error: 'q (search keyword) is required' });
      const driver = drivers.get(driverId);
      if (!driver) return res.status(400).json({ error: 'Unknown driver' });
      if (driver.search) {
        const result = await driver.search(dirPath, q);
        res.json(result);
      } else {
        res.status(400).json({ error: 'Search not supported for this driver' });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}

module.exports = { registerStorageRoutes, drivers };
