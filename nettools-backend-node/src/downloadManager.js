/**
 * 离线下载管理器
 * 支持 HTTP/HTTPS 文件下载，任务队列，进度跟踪
 */
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

const DOWNLOAD_DIR = path.join(__dirname, '..', '..', 'downloads');
if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

const events = new EventEmitter();
const tasks = new Map(); // id -> task

let taskIdCounter = 0;

function generateId() {
  taskIdCounter++;
  return `dl_${Date.now()}_${taskIdCounter}`;
}

function getMimeType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const map = {
    '.txt': 'text/plain', '.html': 'text/html', '.css': 'text/css',
    '.js': 'application/javascript', '.json': 'application/json',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp',
    '.pdf': 'application/pdf', '.zip': 'application/zip',
    '.mp4': 'video/mp4', '.mp3': 'audio/mpeg',
  };
  return map[ext] || 'application/octet-stream';
}

/**
 * 创建下载任务
 */
function createTask(url, targetPath, filename) {
  const id = generateId();
  const task = {
    id,
    url,
    targetPath: targetPath || '/',
    fileName: filename || path.basename(new URL(url).pathname) || 'download',
    filePath: '',
    size: 0,
    downloaded: 0,
    status: 'pending',
    progress: 0,
    speed: 0,
    startTime: new Date().toISOString(),
    endTime: null,
    error: null,
    _speedSamples: [],
    _lastBytes: 0,
    _lastTime: 0,
  };
  tasks.set(id, task);
  return task;
}

/**
 * 执行下载
 */
function startDownload(taskId) {
  const task = tasks.get(taskId);
  if (!task) return { success: false, error: 'Task not found' };
  if (task.status === 'downloading') return { success: false, error: 'Already downloading' };

  task.status = 'downloading';
  task.startTime = new Date().toISOString();
  task._lastBytes = 0;
  task._lastTime = Date.now();

  const destPath = path.join(DOWNLOAD_DIR, task.fileName);
  task.filePath = destPath;
  const file = fs.createWriteStream(destPath);

  const urlObj = new URL(task.url);
  const client = urlObj.protocol === 'https:' ? https : http;

  const req = client.get(task.url, { timeout: 30000 }, (res) => {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      // 重定向
      file.close();
      fs.unlinkSync(destPath);
      task.url = res.headers.location;
      startDownload(taskId);
      return;
    }

    if (res.statusCode !== 200) {
      file.close();
      fs.unlinkSync(destPath);
      task.status = 'failed';
      task.error = `HTTP ${res.statusCode}`;
      task.endTime = new Date().toISOString();
      events.emit('taskUpdate', task);
      return;
    }

    task.size = parseInt(res.headers['content-length'], 10) || 0;

    res.on('data', (chunk) => {
      task.downloaded += chunk.length;
      if (task.size > 0) {
        task.progress = Math.min((task.downloaded / task.size) * 100, 100).toFixed(2);
      }

      // 计算速度
      const now = Date.now();
      const elapsed = (now - task._lastTime) / 1000;
      if (elapsed >= 1) {
        const bytesPerSec = (task.downloaded - task._lastBytes) / elapsed;
        task._speedSamples.push(bytesPerSec);
        if (task._speedSamples.length > 5) task._speedSamples.shift();
        task.speed = task._speedSamples.reduce((a, b) => a + b, 0) / task._speedSamples.length;
        task._lastBytes = task.downloaded;
        task._lastTime = now;
      }

      events.emit('taskUpdate', task);
    });

    res.pipe(file);

    file.on('finish', () => {
      file.close();
      if (task.status === 'downloading') {
        task.status = 'completed';
        task.progress = 100;
        task.endTime = new Date().toISOString();
        events.emit('taskUpdate', task);
      }
    });
  });

  req.on('error', (err) => {
    file.close();
    if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
    if (task.status === 'downloading') {
      task.status = 'failed';
      task.error = err.message;
      task.endTime = new Date().toISOString();
      events.emit('taskUpdate', task);
    }
  });

  req.on('timeout', () => {
    req.destroy();
    file.close();
    if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
    task.status = 'failed';
    task.error = 'Connection timeout';
    task.endTime = new Date().toISOString();
    events.emit('taskUpdate', task);
  });

  task._req = req;
  return { success: true, message: 'Download started' };
}

/**
 * 暂停/取消下载
 */
function cancelTask(taskId) {
  const task = tasks.get(taskId);
  if (!task) return { success: false, error: 'Task not found' };

  if (task._req) {
    task._req.destroy();
  }
  if (task.filePath && fs.existsSync(task.filePath)) {
    fs.unlinkSync(task.filePath);
  }
  task.status = 'cancelled';
  task.endTime = new Date().toISOString();
  tasks.delete(taskId);
  events.emit('taskUpdate', task);
  return { success: true, message: 'Task cancelled' };
}

/**
 * 获取任务列表
 */
function getTasks() {
  return Array.from(tasks.values()).map(t => {
    const { _req, _speedSamples, _lastBytes, _lastTime, ...clean } = t;
    return clean;
  });
}

/**
 * 获取单个任务
 */
function getTask(taskId) {
  const t = tasks.get(taskId);
  if (!t) return null;
  const { _req, _speedSamples, _lastBytes, _lastTime, ...clean } = t;
  return clean;
}

/**
 * 删除任务记录
 */
function deleteTask(taskId) {
  const task = tasks.get(taskId);
  if (task && task.status === 'downloading') {
    cancelTask(taskId);
  }
  tasks.delete(taskId);
  return { success: true, message: 'Task deleted' };
}

/**
 * 获取事件发射器（用于 WebSocket 推送）
 */
function getEventEmitter() {
  return events;
}

module.exports = {
  createTask,
  startDownload,
  cancelTask,
  getTasks,
  getTask,
  deleteTask,
  getEventEmitter,
  DOWNLOAD_DIR,
};
