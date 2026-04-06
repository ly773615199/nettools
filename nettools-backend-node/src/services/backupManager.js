/**
 * 备份管理器 [G9]
 * 支持定时调度 + 增量/全量备份 + 快照对比
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class BackupManager {
  constructor() {
    this.runningTasks = new Map(); // taskId -> { startTime, status, progress }
  }

  /**
   * 执行备份任务
   * @param {object} task - BackupTask 模型实例
   * @param {object} sourceDriver - 源存储驱动
   * @param {object} targetDriver - 目标存储驱动
   * @param {object} SnapshotModel - BackupSnapshot 模型
   * @returns {object} { success, fileCount, totalSize, duration, snapshot }
   */
  async executeBackup(task, sourceDriver, targetDriver, SnapshotModel) {
    const taskId = task.id;
    if (this.runningTasks.has(taskId)) {
      throw new Error(`Backup task ${taskId} is already running`);
    }

    const startTime = Date.now();
    this.runningTasks.set(taskId, { startTime, status: 'running', progress: 0 });

    try {
      // 1. 获取上一次快照（增量备份时使用）
      let lastSnapshot = {};
      if (task.mode === 'incremental') {
        const lastRecord = await SnapshotModel.findOne({
          where: { backupTaskId: taskId },
          order: [['createdAt', 'DESC']],
        });
        if (lastRecord) {
          lastSnapshot = lastRecord.snapshot || {};
        }
      }

      // 2. 遍历源存储目录
      const sourceFiles = await this._listAllFiles(sourceDriver, task.sourcePath);
      console.log(`[backup] Found ${sourceFiles.length} files in source`);

      // 3. 对比差异，找出需要复制的文件
      const toCopy = [];
      const currentSnapshot = {};
      let totalSize = 0;

      for (const file of sourceFiles) {
        const fileHash = this._computeFileInfo(file);
        currentSnapshot[file.path] = fileHash;

        if (task.mode === 'full' || !lastSnapshot[file.path] || lastSnapshot[file.path].hash !== fileHash.hash) {
          toCopy.push(file);
          totalSize += file.size || 0;
        }
      }

      // 4. 复制文件到目标存储
      let copiedCount = 0;
      for (const file of toCopy) {
        try {
          const targetPath = path.join(task.targetPath, file.path);
          await this._copyFile(sourceDriver, targetDriver, file.path, targetPath);
          copiedCount++;
          this.runningTasks.get(taskId).progress = Math.round((copiedCount / toCopy.length) * 100);
        } catch (err) {
          console.error(`[backup] Failed to copy ${file.path}: ${err.message}`);
        }
      }

      // 5. 保存快照
      const duration = Date.now() - startTime;
      const snapshot = await SnapshotModel.create({
        backupTaskId: taskId,
        snapshot: currentSnapshot,
        fileCount: sourceFiles.length,
        totalSize,
        duration,
      });

      this.runningTasks.delete(taskId);

      return {
        success: true,
        fileCount: sourceFiles.length,
        copiedCount,
        totalSize,
        duration,
        snapshot,
      };
    } catch (err) {
      this.runningTasks.delete(taskId);
      throw err;
    }
  }

  /**
   * 列出所有文件（递归）
   */
  async _listAllFiles(driver, dirPath) {
    const files = [];
    try {
      const items = await driver.list(dirPath);
      for (const item of items) {
        if (item.isDir) {
          const subFiles = await this._listAllFiles(driver, path.join(dirPath, item.name));
          files.push(...subFiles);
        } else {
          files.push({
            name: item.name,
            path: path.join(dirPath, item.name),
            size: item.size || 0,
            mtime: item.mtime || item.modified || null,
          });
        }
      }
    } catch (err) {
      console.error(`[backup] Error listing ${dirPath}: ${err.message}`);
    }
    return files;
  }

  /**
   * 计算文件信息（用于增量对比）
   */
  _computeFileInfo(file) {
    return {
      hash: `${file.path}:${file.size}:${file.mtime}`,
      size: file.size,
      mtime: file.mtime,
    };
  }

  /**
   * 跨存储复制文件
   */
  async _copyFile(sourceDriver, targetDriver, sourcePath, targetPath) {
    // 获取文件内容
    const content = await sourceDriver.get(sourcePath);

    // 确保目标目录存在
    const targetDir = path.dirname(targetPath);
    try {
      await targetDriver.mkdir(targetDir);
    } catch {
      // 目录可能已存在
    }

    // 写入目标
    if (content && typeof content.pipe === 'function') {
      // 流式
      const chunks = [];
      for await (const chunk of content) {
        chunks.push(chunk);
      }
      await targetDriver.put(targetPath, Buffer.concat(chunks));
    } else {
      await targetDriver.put(targetPath, content);
    }
  }

  /**
   * 检查任务是否正在运行
   */
  isRunning(taskId) {
    return this.runningTasks.has(taskId);
  }

  /**
   * 获取任务运行状态
   */
  getProgress(taskId) {
    return this.runningTasks.get(taskId) || null;
  }

  /**
   * 取消运行中的备份
   */
  cancel(taskId) {
    if (!this.runningTasks.has(taskId)) {
      throw new Error(`Backup task ${taskId} is not running`);
    }
    this.runningTasks.delete(taskId);
  }
}

module.exports = BackupManager;
