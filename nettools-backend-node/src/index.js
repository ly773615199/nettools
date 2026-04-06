/**
 * NetTools 后端主入口
 *
 * 职责：Express 应用创建 → 中间件 → 路由注册 → 启动服务
 * 业务逻辑全部拆分到 src/routes/ 和 src/services/
 */
require('dotenv').config();
const { logger } = require('./utils/logger');

// ---- 全局错误处理 ----
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception', { error: err.message, stack: err.stack });
  // 不立即退出，给日志时间写入
  setTimeout(() => process.exit(1), 1000);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
});

const express = require('express');
const { registerMiddleware, registerErrorHandlers } = require('./core/middleware');

// ---- 数据库模型 ----
const models = require('./models');

// ---- 注册所有存储驱动 ----
require('./drivers/index');

// ---- 初始化 Express ----
const app = express();
const port = process.env.PORT || 8000;

// ---- 全局中间件 ----
registerMiddleware(app);

logger.info('NetTools backend initializing...');

// ========================================
// 路由注册
// ========================================

// 核心路由
const { registerAuthRoutes } = require('./routes/auth');
const { registerUserRoutes } = require('./routes/users');
const { registerFileRoutes } = require('./routes/files');
const { registerTunnelRoutes } = require('./routes/tunnels');
const { registerProxyRoutes } = require('./routes/proxies');
const { registerSystemRoutes } = require('./routes/system');
const { registerClashRoutes } = require('./routes/clash');
const { registerDownloadRoutes } = require('./routes/downloads');
const { registerNetworkRoutes } = require('./routes/network');
const { registerPreviewRoutes } = require('./routes/preview');

// G10: 缓存中间件
const { cacheMiddleware, getCacheStats } = require('./services/cache');
app.use('/api/storages', cacheMiddleware('storages', 15000));
app.use('/api/network', cacheMiddleware('network', 10000));
app.use('/api/system', cacheMiddleware('system', 10000));
app.use('/api/clash', cacheMiddleware('clash', 8000));
app.use('/api/proxies', cacheMiddleware('proxies', 8000));

// 缓存统计 API
app.get('/api/cache/stats', require('./core/auth').authMiddleware, (req, res) => {
  res.json({ data: getCacheStats() });
});

registerAuthRoutes(app, models);
registerUserRoutes(app, models, require('./core/permission').requirePermission);
registerFileRoutes(app, models);
registerTunnelRoutes(app, models);
registerProxyRoutes(app, models);
registerSystemRoutes(app, models);
registerClashRoutes(app, models);
registerDownloadRoutes(app);
registerNetworkRoutes(app);
registerPreviewRoutes(app);

// 扩展路由（已有独立文件）
const { registerStorageManagerRoutes } = require('./routes/storageManager');
registerStorageManagerRoutes(app, require('./core/auth').authMiddleware);

const { registerTunnelServerRoutes } = require('./routes/tunnelServer');
registerTunnelServerRoutes(app, require('./core/auth').authMiddleware);

const { registerClashEnhancedRoutes } = require('./routes/clashEnhanced');
registerClashEnhancedRoutes(app, require('./core/auth').authMiddleware);

const { registerSubscriptionRoutes } = require('./services/subscriptionManager');
registerSubscriptionRoutes(app, require('./core/auth').authMiddleware, models.Proxy, models.ProxyGroup, models.ProxyRule);

const { registerMihomoRoutes } = require('./services/mihomoApi');
registerMihomoRoutes(app, require('./core/auth').authMiddleware);

const { registerVpnRoutes } = require('./routes/vpn');
registerVpnRoutes(app, require('./core/auth').authMiddleware, models.VpnServer);

const { registerPenetrationRoutes } = require('./routes/penetration');
registerPenetrationRoutes(app, require('./core/auth').authMiddleware, models);

const { registerServicesRoutes } = require('./routes/services');
const { runningTunnels } = require('./routes/tunnels');
registerServicesRoutes(app, require('./core/auth').authMiddleware, { TunnelServer: models.TunnelServer, Tunnel: models.Tunnel, Proxy: models.Proxy }, runningTunnels);

const { registerDeploymentRoutes } = require('./routes/deployments');
registerDeploymentRoutes(app, require('./core/auth').authMiddleware);

// 存储驱动 API (旧版兼容)
const { registerStorageRoutes } = require('./drivers/storageApi');
registerStorageRoutes(app, require('./core/auth').authMiddleware);

// ---- Phase 7: 高级功能路由 ----
const { requirePermission } = require('./core/permission');

// G1: 多协议文件访问服务
const { registerFileServerRoutes } = require('./routes/fileServer');
registerFileServerRoutes(app, require('./core/auth').authMiddleware, requirePermission);

// G5: VPN 服务器管理（已在上方注册）

// G8: 用户管理（已在上方注册）

// G9: 备份管理
const { registerBackupRoutes } = require('./routes/backup');
registerBackupRoutes(app, require('./core/auth').authMiddleware, requirePermission, models);

// G6: 服务自动重启守护进程
const ServiceWatchdog = require('./services/serviceWatchdog');
const watchdog = new ServiceWatchdog({ checkInterval: 30000, maxRetries: 5 });

// 注册 Clash 到 watchdog
watchdog.register('clash', {
  name: 'clash',
  checkFn: async () => {
    try {
      const clashManager = require('./clashManager');
      return clashManager.isRunning && clashManager.isRunning();
    } catch { return false; }
  },
  restartFn: async () => {
    const clashManager = require('./clashManager');
    if (clashManager.restart) await clashManager.restart();
  },
});

// 注册 Bore 到 watchdog
watchdog.register('bore', {
  name: 'bore',
  checkFn: async () => {
    try {
      const boreManager = require('./services/boreServerManager');
      return boreManager.isRunning && boreManager.isRunning();
    } catch { return false; }
  },
  restartFn: async () => {
    const boreManager = require('./services/boreServerManager');
    if (boreManager.restart) await boreManager.restart();
  },
});

// watchdog 在 5 秒后启动（等其他服务就绪）
setTimeout(() => {
  try { watchdog.start(); } catch (err) {
    logger.error('Failed to start watchdog', { error: err.message });
  }
}, 5000);

// 导出 watchdog 实例供其他模块使用
app.set('watchdog', watchdog);

// Watchdog 事件日志
watchdog.on('crash', (key, reason) => {
  logger.error(`[watchdog] Service ${key} crashed: ${reason}`);
  wsManager.broadcast && wsManager.broadcast('service-event', {
    serviceType: key, eventType: 'crash', message: reason, timestamp: new Date(),
  });
});
watchdog.on('restarted', (key) => {
  logger.info(`[watchdog] Service ${key} restarted successfully`);
});

// ---- 错误处理 ----
registerErrorHandlers(app);

// ========================================
// 启动服务
// ========================================
const wsManager = require('./wsManager');

const server = app.listen(port, () => {
  console.log(`Server starting on port ${port}`);

  // 初始化 WebSocket
  wsManager.init(server);
  wsManager.wireDownloadEvents();
  wsManager.wireNetworkEvents();

  // 延迟初始化默认数据
  setTimeout(() => {
    require('./init');
  }, 1000);
});
