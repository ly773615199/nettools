/**
 * LRU 缓存模块
 * 用于文件列表、存储驱动 link 结果、代理/规则查询等的缓存
 * 减少重复的磁盘/网络/数据库操作
 */
const { LRUCache } = require('lru-cache');

/**
 * 文件列表缓存 — 存储驱动 list() 结果
 * TTL: 30s，最大 200 个条目
 */
const fileListCache = new LRUCache({
  max: 200,
  ttl: 30 * 1000, // 30 秒
});

/**
 * 存储驱动 link 缓存 — 按 URL 过期时间
 * TTL: 动态设置，最大 500 个条目
 */
const linkCache = new LRUCache({
  max: 500,
  ttl: 5 * 60 * 1000, // 默认 5 分钟（会被 set 时的 ttl 覆盖）
});

/**
 * 通用 API 响应缓存
 * TTL: 10s，最大 100 个条目
 */
const apiCache = new LRUCache({
  max: 100,
  ttl: 10 * 1000, // 10 秒
});

/**
 * 缓存中间件工厂 — 为 Express 路由添加缓存
 * @param {string} prefix 缓存 key 前缀
 * @param {number} ttlMs 缓存 TTL（毫秒）
 */
function cacheMiddleware(prefix, ttlMs = 10000) {
  return (req, res, next) => {
    // 仅缓存 GET 请求
    if (req.method !== 'GET') return next();

    const key = `${prefix}:${req.originalUrl}`;
    const cached = apiCache.get(key);

    if (cached) {
      res.set('X-Cache', 'HIT');
      return res.json(cached);
    }

    // 拦截 res.json 以缓存响应
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      res.set('X-Cache', 'MISS');
      apiCache.set(key, body, { ttl: ttlMs });
      return originalJson(body);
    };

    next();
  };
}

/**
 * 获取缓存统计
 */
function getCacheStats() {
  return {
    fileList: { size: fileListCache.size, max: fileListCache.max },
    link: { size: linkCache.size, max: linkCache.max },
    api: { size: apiCache.size, max: apiCache.max },
  };
}

/**
 * 清除所有缓存
 */
function clearAll() {
  fileListCache.clear();
  linkCache.clear();
  apiCache.clear();
}

module.exports = {
  fileListCache,
  linkCache,
  apiCache,
  cacheMiddleware,
  getCacheStats,
  clearAll,
};
