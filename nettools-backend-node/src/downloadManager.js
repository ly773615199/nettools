/**
 * 离线下载管理器 - 多线程加速版 [G3]
 * 支持 HTTP/HTTPS 多线程分片下载、断点续传、进度聚合
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

// 全局并发控制
const MAX_CONCURRENT_TASKS = 3;
let activeTaskCount = 0;
const pendingQueue = []; // 等待执行的任务队列

let taskIdCounter = 0;

function generateId() {
  taskIdCounter++;
  return `dl_${Date.now()}_${taskIdCounter}`;
}

/**
 * 创建下载任务
 * @param {string} url - 下载地址
 * @param {string} targetPath - 目标路径
 * @param {string} filename - 文件名
 * @param {object} options - { threads: 4 } 线程数 1-16
 */
function createTask(url, targetPath, filename, options = {}) {
  const id = generateId();
  const threads = Math.max(1, Math.min(16, options.threads || 4));
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
    threads,
    supportsRange: false,
    chunks: [], // 分片状态
    startTime: new Date().toISOString(),
    endTime: null,
    error: null,
    _speedSamples: [],
    _lastBytes: 0,
    _lastTime: 0,
    _chunksDir: '',
    _aborted: false,
  };
  tasks.set(id, task);
  return task;
}

/**
 * 执行下载 - 支持多线程
 */
function startDownload(taskId) {
  const task = tasks.get(taskId);
  if (!task) return { success: false, error: 'Task not found' };
  if (task.status === 'downloading') return { success: false, error: 'Already downloading' };

  // 并发控制检查
  if (activeTaskCount >= MAX_CONCURRENT_TASKS) {
    task.status = 'queued';
    pendingQueue.push(taskId);
    events.emit('taskUpdate', task);
    return { success: true, message: 'Task queued' };
  }

  activeTaskCount++;
  task.status = 'downloading';
  task.startTime = new Date().toISOString();
  task._lastBytes = 0;
  task._lastTime = Date.now();
  task._aborted = false;

  const destPath = path.join(DOWNLOAD_DIR, task.fileName);
  task.filePath = destPath;

  // 先发 HEAD 请求检测 Range 支持
  _checkRangeSupport(task.url, (err, info) => {
    if (task._aborted) {
      activeTaskCount--;
      _processQueue();
      return;
    }

    if (err) {
      // HEAD 失败，降级为单线程
      console.log(`[download] HEAD request failed, fallback to single thread: ${err.message}`);
      _singleThreadDownload(task);
      return;
    }

    task.size = info.contentLength;
    task.supportsRange = info.supportsRange;

    if (info.supportsRange && info.contentLength > 0 && task.threads > 1) {
      _multiThreadDownload(task);
    } else {
      _singleThreadDownload(task);
    }
  });

  return { success: true, message: 'Download starting' };
}

/**
 * 检测 Range 支持
 */
function _checkRangeSupport(url, callback) {
  const urlObj = new URL(url);
  const client = urlObj.protocol === 'https:' ? https : http;

  const req = client.request(url, { method: 'HEAD', timeout: 15000 }, (res) => {
    // 处理重定向
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      return _checkRangeSupport(res.headers.location, callback);
    }

    if (res.statusCode !== 200) {
      return callback(new Error(`HTTP ${res.statusCode}`));
    }

    const contentLength = parseInt(res.headers['content-length'], 10) || 0;
    const acceptRanges = (res.headers['accept-ranges'] || '').toLowerCase();
    const supportsRange = acceptRanges === 'bytes' && contentLength > 0;

    callback(null, { contentLength, supportsRange });
  });

  req.on('error', (err) => callback(err));
  req.on('timeout', () => { req.destroy(); callback(new Error('HEAD timeout')); });
  req.end();
}

/**
 * 单线程下载（降级方案）
 */
function _singleThreadDownload(task) {
  const chunksDir = path.join(DOWNLOAD_DIR, `_chunks_${task.id}`);
  task._chunksDir = chunksDir;
  task.chunks = [{ index: 0, start: 0, end: task.size - 1, downloaded: 0, status: 'downloading' }];

  const file = fs.createWriteStream(task.filePath);
  const urlObj = new URL(task.url);
  const client = urlObj.protocol === 'https:' ? https : http;

  const req = client.get(task.url, { timeout: 30000 }, (res) => {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      file.close();
      if (fs.existsSync(task.filePath)) fs.unlinkSync(task.filePath);
      task.url = res.headers.location;
      _singleThreadDownload(task);
      return;
    }

    if (res.statusCode !== 200) {
      file.close();
      if (fs.existsSync(task.filePath)) fs.unlinkSync(task.filePath);
      _finishTask(task, 'failed', `HTTP ${res.statusCode}`);
      return;
    }

    if (!task.size) {
      task.size = parseInt(res.headers['content-length'], 10) || 0;
    }

    res.on('data', (chunk) => {
      task.downloaded += chunk.length;
      if (task.chunks[0]) task.chunks[0].downloaded = task.downloaded;
      _updateProgress(task);
    });

    res.pipe(file);

    file.on('finish', () => {
      file.close();
      if (task.chunks[0]) task.chunks[0].status = 'completed';
      if (task.status === 'downloading') {
        _finishTask(task, 'completed');
      }
    });
  });

  req.on('error', (err) => {
    file.close();
    if (fs.existsSync(task.filePath)) fs.unlinkSync(task.filePath);
    if (task.chunks[0]) task.chunks[0].status = 'error';
    _finishTask(task, 'failed', err.message);
  });

  req.on('timeout', () => {
    req.destroy();
    file.close();
    if (fs.existsSync(task.filePath)) fs.unlinkSync(task.filePath);
    _finishTask(task, 'failed', 'Connection timeout');
  });

  task._req = req;
}

/**
 * 多线程分片下载
 */
function _multiThreadDownload(task) {
  const chunksDir = path.join(DOWNLOAD_DIR, `_chunks_${task.id}`);
  task._chunksDir = chunksDir;
  if (!fs.existsSync(chunksDir)) {
    fs.mkdirSync(chunksDir, { recursive: true });
  }

  // 计算分片
  const totalSize = task.size;
  const threadCount = task.threads;
  const chunkSize = Math.ceil(totalSize / threadCount);

  task.chunks = [];
  for (let i = 0; i < threadCount; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize - 1, totalSize - 1);
    const chunkFile = path.join(chunksDir, `chunk_${i}`);

    // 检查是否已有部分下载（断点续传）
    let downloaded = 0;
    if (fs.existsSync(chunkFile)) {
      downloaded = fs.statSync(chunkFile).size;
    }

    task.chunks.push({
      index: i,
      start,
      end,
      chunkFile,
      downloaded,
      total: end - start + 1,
      status: downloaded >= (end - start + 1) ? 'completed' : 'pending',
    });
  }

  // 更新总已下载量
  task.downloaded = task.chunks.reduce((sum, c) => sum + c.downloaded, 0);

  // 启动所有分片下载
  let completedChunks = 0;
  const totalChunks = task.chunks.length;

  for (const chunk of task.chunks) {
    if (chunk.status === 'completed') {
      completedChunks++;
      if (completedChunks === totalChunks) {
        _mergeChunks(task);
      }
      continue;
    }

    _downloadChunk(task, chunk, () => {
      completedChunks++;
      if (completedChunks === totalChunks) {
        _mergeChunks(task);
      }
    });
  }

  events.emit('taskUpdate', task);
}

/**
 * 下载单个分片
 */
function _downloadChunk(task, chunk, onComplete) {
  if (task._aborted) return;

  chunk.status = 'downloading';
  const chunkFile = chunk.chunkFile;
  const existingSize = chunk.downloaded;

  // 计算实际请求范围（支持断点续传）
  const reqStart = chunk.start + existingSize;
  if (reqStart > chunk.end) {
    chunk.status = 'completed';
    onComplete();
    return;
  }

  const urlObj = new URL(task.url);
  const client = urlObj.protocol === 'https:' ? https : http;

  const headers = {
    'Range': `bytes=${reqStart}-${chunk.end}`,
  };

  const req = client.get(task.url, { headers, timeout: 60000 }, (res) => {
    // 206 = Partial Content，200 = 不支持 Range 但返回了完整内容
    if (res.statusCode !== 206 && res.statusCode !== 200) {
      chunk.status = 'error';
      console.error(`[download] Chunk ${chunk.index} failed: HTTP ${res.statusCode}`);
      // 降级：如果所有分片都失败，尝试单线程
      onComplete();
      return;
    }

    const mode = existingSize > 0 ? 'a' : 'w';
    const file = fs.createWriteStream(chunkFile, { flags: mode });

    res.on('data', (data) => {
      chunk.downloaded += data.length;
      task.downloaded += data.length;
      _updateProgress(task);
    });

    res.pipe(file);

    file.on('finish', () => {
      file.close();
      chunk.status = 'completed';
      onComplete();
    });
  });

  req.on('error', (err) => {
    chunk.status = 'error';
    console.error(`[download] Chunk ${chunk.index} error: ${err.message}`);
    // 重试一次
    if (!chunk._retried) {
      chunk._retried = true;
      setTimeout(() => _downloadChunk(task, chunk, onComplete), 2000);
    } else {
      onComplete();
    }
  });

  req.on('timeout', () => {
    req.destroy();
    chunk.status = 'error';
    if (!chunk._retried) {
      chunk._retried = true;
      setTimeout(() => _downloadChunk(task, chunk, onComplete), 2000);
    } else {
      onComplete();
    }
  });
}

/**
 * 合并所有分片
 */
function _mergeChunks(task) {
  if (task._aborted) return;

  console.log(`[download] Merging ${task.chunks.length} chunks for ${task.fileName}`);

  try {
    const ws = fs.createWriteStream(task.filePath);

    for (const chunk of task.chunks) {
      const chunkFile = chunk.chunkFile;
      if (fs.existsSync(chunkFile)) {
        const data = fs.readFileSync(chunkFile);
        ws.write(data);
      } else {
        console.error(`[download] Chunk file missing: ${chunkFile}`);
      }
    }

    ws.end();
    ws.on('finish', () => {
      // 清理分片目录
      _cleanupChunks(task);
      _finishTask(task, 'completed');
    });
    ws.on('error', (err) => {
      _finishTask(task, 'failed', `Merge error: ${err.message}`);
    });
  } catch (err) {
    _finishTask(task, 'failed', `Merge error: ${err.message}`);
  }
}

/**
 * 清理分片临时文件
 */
function _cleanupChunks(task) {
  if (task._chunksDir && fs.existsSync(task._chunksDir)) {
    try {
      fs.rmSync(task._chunksDir, { recursive: true, force: true });
    } catch (err) {
      console.error(`[download] Cleanup error: ${err.message}`);
    }
  }
}

/**
 * 更新进度
 */
function _updateProgress(task) {
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
}

/**
 * 完成任务
 */
function _finishTask(task, status, error = null) {
  task.status = status;
  task.endTime = new Date().toISOString();
  if (status === 'completed') task.progress = 100;
  if (error) task.error = error;

  activeTaskCount = Math.max(0, activeTaskCount - 1);
  events.emit('taskUpdate', task);

  // 处理排队任务
  _processQueue();
}

/**
 * 处理排队任务
 */
function _processQueue() {
  while (pendingQueue.length > 0 && activeTaskCount < MAX_CONCURRENT_TASKS) {
    const nextId = pendingQueue.shift();
    if (tasks.has(nextId)) {
      startDownload(nextId);
    }
  }
}

/**
 * 暂停/取消下载
 */
function cancelTask(taskId) {
  const task = tasks.get(taskId);
  if (!task) return { success: false, error: 'Task not found' };

  task._aborted = true;

  if (task._req) {
    task._req.destroy();
  }
  if (task.filePath && fs.existsSync(task.filePath)) {
    fs.unlinkSync(task.filePath);
  }

  // 清理分片
  _cleanupChunks(task);

  // 从队列中移除
  const queueIdx = pendingQueue.indexOf(taskId);
  if (queueIdx !== -1) pendingQueue.splice(queueIdx, 1);

  if (task.status === 'downloading') {
    activeTaskCount = Math.max(0, activeTaskCount - 1);
    _processQueue();
  }

  task.status = 'cancelled';
  task.endTime = new Date().toISOString();
  tasks.delete(taskId);
  events.emit('taskUpdate', task);
  return { success: true, message: 'Task cancelled' };
}

/**
 * 暂停下载（保留分片，支持续传）
 */
function pauseTask(taskId) {
  const task = tasks.get(taskId);
  if (!task) return { success: false, error: 'Task not found' };
  if (task.status !== 'downloading') return { success: false, error: 'Not downloading' };

  task._aborted = true;
  if (task._req) task._req.destroy();

  // 分片文件保留，支持续传
  task.status = 'paused';
  task.endTime = new Date().toISOString();

  activeTaskCount = Math.max(0, activeTaskCount - 1);
  _processQueue();

  events.emit('taskUpdate', task);
  return { success: true, message: 'Task paused' };
}

/**
 * 恢复暂停的下载
 */
function resumeTask(taskId) {
  const task = tasks.get(taskId);
  if (!task) return { success: false, error: 'Task not found' };
  if (task.status !== 'paused') return { success: false, error: 'Task is not paused' };

  task._aborted = false;
  return startDownload(taskId);
}

/**
 * 获取任务列表
 */
function getTasks() {
  return Array.from(tasks.values()).map(t => {
    const { _req, _speedSamples, _lastBytes, _lastTime, _chunksDir, ...clean } = t;
    return clean;
  });
}

/**
 * 获取单个任务
 */
function getTask(taskId) {
  const t = tasks.get(taskId);
  if (!t) return null;
  const { _req, _speedSamples, _lastBytes, _lastTime, _chunksDir, ...clean } = t;
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
  pauseTask,
  resumeTask,
  getTasks,
  getTask,
  deleteTask,
  getEventEmitter,
  DOWNLOAD_DIR,
};
