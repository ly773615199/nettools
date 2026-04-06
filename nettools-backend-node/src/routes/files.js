/**
 * 文件管理路由 — 上传/列表/下载/删除
 */
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { authMiddleware } = require('../core/auth');

// 确保上传目录存在
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

function registerFileRoutes(app, models) {
  const { File } = models;

  app.post('/api/files/upload', authMiddleware, upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const file = await File.create({
        name: req.file.originalname,
        path: req.file.path,
        size: req.file.size,
        type: req.file.mimetype,
        userId: req.user.id
      });

      res.json({ message: 'File uploaded successfully', file });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/files', authMiddleware, async (req, res) => {
    try {
      const files = await File.findAll({ where: { userId: req.user.id } });
      res.json({ data: files, total: files.length });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/files/:id', authMiddleware, async (req, res) => {
    try {
      const file = await File.findByPk(req.params.id);
      if (!file) return res.status(404).json({ error: 'File not found' });
      if (file.userId !== req.user.id) return res.status(403).json({ error: 'Access denied' });
      res.sendFile(file.path);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.delete('/api/files/:id', authMiddleware, async (req, res) => {
    try {
      const file = await File.findByPk(req.params.id);
      if (!file) return res.status(404).json({ error: 'File not found' });
      if (file.userId !== req.user.id) return res.status(403).json({ error: 'Access denied' });

      if (file.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      await file.destroy();

      res.json({ message: 'File deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // 兼容旧路径：/api/storage/*
  app.get('/api/storage/list', authMiddleware, async (req, res) => {
    try {
      const files = await File.findAll({ where: { userId: req.user.id } });
      res.json({ data: files, total: files.length });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/storage/create', authMiddleware, upload.single('file'), async (req, res) => {
    try {
      const { name, type, config } = req.body;
      if (req.file) {
        const file = await File.create({
          name: req.file.originalname, path: req.file.path,
          size: req.file.size, type: req.file.mimetype, userId: req.user.id
        });
        return res.json({ id: String(file.id), message: 'Storage created successfully' });
      }
      const file = await File.create({
        name: name || 'untitled', path: config || '/',
        size: 0, type: type || 'folder', userId: req.user.id
      });
      res.json({ id: String(file.id), message: 'Storage created successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.put('/api/storage/update', authMiddleware, async (req, res) => {
    try {
      const { id, config } = req.body;
      const file = await File.findByPk(id);
      if (!file) return res.status(404).json({ error: 'Not found' });
      if (file.userId !== req.user.id) return res.status(403).json({ error: 'Access denied' });
      if (config) await file.update({ path: typeof config === 'string' ? config : JSON.stringify(config) });
      res.json({ message: 'Storage updated successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.delete('/api/storage/delete', authMiddleware, async (req, res) => {
    try {
      const { id } = req.query;
      const file = await File.findByPk(id);
      if (!file) return res.status(404).json({ error: 'Not found' });
      if (file.userId !== req.user.id) return res.status(403).json({ error: 'Access denied' });
      if (file.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
      await file.destroy();
      res.json({ message: 'Storage deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/storage/enable', authMiddleware, (req, res) => {
    res.json({ message: 'Storage enabled successfully' });
  });

  app.post('/api/storage/disable', authMiddleware, (req, res) => {
    res.json({ message: 'Storage disabled successfully' });
  });
}

module.exports = { registerFileRoutes };
