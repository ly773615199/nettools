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

registerAuthRoutes(app, models);
registerUserRoutes(app, models);
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
