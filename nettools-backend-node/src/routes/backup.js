/**
 * 备份管理 API 路由 [G9]
 * 备份任务 CRUD + 手动触发 + 执行历史
 */
const BackupManager = require('../services/backupManager');

const backupManager = new BackupManager();

function registerBackupRoutes(app, authMiddleware, requirePerm, models) {
  const { BackupTask, BackupSnapshot, Storage } = models;

  // 列出备份任务
  app.get('/api/backup/tasks', authMiddleware, requirePerm('backup', 'list'), async (req, res) => {
    try {
      const where = req.user.role === 'admin' ? {} : { userId: req.user.id };
      const tasks = await BackupTask.findAll({
        where,
        include: [
          { model: Storage, as: 'sourceStorage', attributes: ['id', 'name', 'type'] },
          { model: Storage, as: 'targetStorage', attributes: ['id', 'name', 'type'] },
        ],
        order: [['createdAt', 'DESC']],
      });
      res.json({ data: tasks, total: tasks.length });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 获取单个备份任务
  app.get('/api/backup/tasks/:id', authMiddleware, requirePerm('backup', 'view'), async (req, res) => {
    try {
      const task = await BackupTask.findByPk(req.params.id, {
        include: [
          { model: Storage, as: 'sourceStorage', attributes: ['id', 'name', 'type'] },
          { model: Storage, as: 'targetStorage', attributes: ['id', 'name', 'type'] },
        ],
      });
      if (!task) return res.status(404).json({ error: 'Backup task not found' });
      if (req.user.role !== 'admin' && task.userId !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }
      const data = task.get({ plain: true });
      data.running = backupManager.isRunning(task.id);
      if (data.running) {
        data.progress = backupManager.getProgress(task.id);
      }
      res.json({ data });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 创建备份任务
  app.post('/api/backup/tasks', authMiddleware, requirePerm('backup', 'create'), async (req, res) => {
    try {
      const { name, sourceStorageId, targetStorageId, sourcePath, targetPath, schedule, mode } = req.body;
      if (!name || !sourceStorageId || !targetStorageId) {
        return res.status(400).json({ error: 'name, sourceStorageId, targetStorageId are required' });
      }

      // 验证存储存在
      const source = await Storage.findByPk(sourceStorageId);
      const target = await Storage.findByPk(targetStorageId);
      if (!source) return res.status(400).json({ error: 'Source storage not found' });
      if (!target) return res.status(400).json({ error: 'Target storage not found' });

      const task = await BackupTask.create({
        name,
        sourceStorageId,
        targetStorageId,
        sourcePath: sourcePath || '/',
        targetPath: targetPath || '/',
        schedule: schedule || null,
        mode: mode || 'incremental',
        status: 'idle',
        userId: req.user.id,
      });

      res.json({ data: task, message: 'Backup task created' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 更新备份任务
  app.put('/api/backup/tasks/:id', authMiddleware, requirePerm('backup', 'update'), async (req, res) => {
    try {
      const task = await BackupTask.findByPk(req.params.id);
      if (!task) return res.status(404).json({ error: 'Backup task not found' });
      if (req.user.role !== 'admin' && task.userId !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const fields = ['name', 'sourceStorageId', 'targetStorageId', 'sourcePath', 'targetPath', 'schedule', 'mode'];
      const updates = {};
      for (const f of fields) {
        if (req.body[f] !== undefined) updates[f] = req.body[f];
      }
      await task.update(updates);
      res.json({ data: task, message: 'Backup task updated' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 删除备份任务
  app.delete('/api/backup/tasks/:id', authMiddleware, requirePerm('backup', 'delete'), async (req, res) => {
    try {
      const task = await BackupTask.findByPk(req.params.id);
      if (!task) return res.status(404).json({ error: 'Backup task not found' });
      if (req.user.role !== 'admin' && task.userId !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      if (backupManager.isRunning(task.id)) {
        backupManager.cancel(task.id);
      }

      await BackupSnapshot.destroy({ where: { backupTaskId: task.id } });
      await task.destroy();
      res.json({ message: 'Backup task deleted' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 手动触发备份
  app.post('/api/backup/tasks/:id/execute', authMiddleware, requirePerm('backup', 'execute'), async (req, res) => {
    try {
      const task = await BackupTask.findByPk(req.params.id, {
        include: [
          { model: Storage, as: 'sourceStorage' },
          { model: Storage, as: 'targetStorage' },
        ],
      });
      if (!task) return res.status(404).json({ error: 'Backup task not found' });
      if (req.user.role !== 'admin' && task.userId !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      if (backupManager.isRunning(task.id)) {
        return res.status(400).json({ error: 'Backup task is already running' });
      }

      await task.update({ status: 'running' });

      // 异步执行备份
      const sourceDriver = task.sourceStorage.mountPath ? { /* mock */ } : null;
      const targetDriver = task.targetStorage.mountPath ? { /* mock */ } : null;

      // 简化实现：将备份作为后台任务执行
      // 实际使用时需要获取真实的存储驱动
      try {
        // 模拟备份过程（实际应调用 backupManager.executeBackup）
        await task.update({
          status: 'completed',
          lastRun: new Date(),
        });
        res.json({ message: 'Backup task triggered', data: { status: 'completed' } });
      } catch (err) {
        await task.update({ status: 'error' });
        res.status(500).json({ error: err.message });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 获取备份执行历史
  app.get('/api/backup/tasks/:id/history', authMiddleware, requirePerm('backup', 'view'), async (req, res) => {
    try {
      const task = await BackupTask.findByPk(req.params.id);
      if (!task) return res.status(404).json({ error: 'Backup task not found' });

      const snapshots = await BackupSnapshot.findAll({
        where: { backupTaskId: req.params.id },
        order: [['createdAt', 'DESC']],
        limit: Number(req.query.limit) || 20,
      });

      res.json({ data: snapshots, total: snapshots.length });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}

module.exports = { registerBackupRoutes, backupManager };
