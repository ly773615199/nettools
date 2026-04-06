/**
 * WebSocket 管理器
 * 提供隧道/代理/下载/网络状态的实时推送
 */
const WebSocket = require('ws');

let wss = null;
const clients = new Set();

/**
 * 初始化 WebSocket 服务器
 */
function init(server) {
  wss = new WebSocket.Server({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    clients.add(ws);
    console.log(`[WS] Client connected (total: ${clients.size})`);

    ws.on('message', (msg) => {
      try {
        const data = JSON.parse(msg);
        handleClientMessage(ws, data);
      } catch {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
      console.log(`[WS] Client disconnected (total: ${clients.size})`);
    });

    ws.on('error', () => {
      clients.delete(ws);
    });

    // 发送欢迎消息
    ws.send(JSON.stringify({ type: 'connected', message: 'WebSocket connected' }));
  });

  console.log('[WS] WebSocket server initialized on /ws');
}

/**
 * 处理客户端消息
 */
function handleClientMessage(ws, data) {
  switch (data.type) {
    case 'ping':
      ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
      break;
    case 'subscribe':
      ws._subscriptions = data.channels || ['all'];
      ws.send(JSON.stringify({ type: 'subscribed', channels: ws._subscriptions }));
      break;
    default:
      ws.send(JSON.stringify({ type: 'error', message: `Unknown message type: ${data.type}` }));
  }
}

/**
 * 广播消息给所有客户端
 */
function broadcast(type, data, channel) {
  if (!wss) return;
  const msg = JSON.stringify({ type, data, channel, timestamp: Date.now() });

  for (const ws of clients) {
    if (ws.readyState !== WebSocket.OPEN) continue;
    // 检查订阅过滤
    if (channel && ws._subscriptions && !ws._subscriptions.includes('all') && !ws._subscriptions.includes(channel)) {
      continue;
    }
    try {
      ws.send(msg);
    } catch {
      clients.delete(ws);
    }
  }
}

/**
 * 获取连接统计
 */
function getStats() {
  return {
    totalClients: clients.size,
    active: wss !== null,
  };
}

/**
 * 连接下载管理器事件到 WebSocket 广播
 * 在 init() 之后调用
 */
function wireDownloadEvents() {
  try {
    const dlManager = require('./downloadManager');
    const emitter = dlManager.getEventEmitter();

    emitter.on('taskUpdate', (task) => {
      // 清理内部字段
      const { _req, _speedSamples, _lastBytes, _lastTime, ...clean } = task;
      broadcast('download:progress', clean, 'downloads');
    });

    console.log('[WS] Download events wired to WebSocket');
  } catch (err) {
    console.error('[WS] Failed to wire download events:', err.message);
  }
}

/**
 * 连接网络监控事件到 WebSocket 广播
 */
function wireNetworkEvents() {
  try {
    const netMonitor = require('./networkMonitor');
    // 每 10 秒广播一次网络状态
    setInterval(() => {
      if (clients.size === 0) return; // 没有客户端时跳过
      broadcast('network:status', netMonitor.getNetworkStatus(), 'network');
    }, 10000);
    console.log('[WS] Network monitoring events wired');
  } catch (err) {
    console.error('[WS] Failed to wire network events:', err.message);
  }
}

module.exports = {
  init,
  broadcast,
  getStats,
  wireDownloadEvents,
  wireNetworkEvents,
};
