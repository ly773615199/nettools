/**
 * 订阅管理服务
 * 下载、解析、导入 Clash 订阅，支持自动更新
 */
const https = require('https');
const http = require('http');
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');

// 订阅数据存储 (后续可迁移到数据库)
let subscriptions = [];
let nextSubId = 1;
let updateTimers = new Map(); // subId -> timer

const SUB_CACHE_DIR = path.join(__dirname, '..', '..', 'clash-data', 'subscriptions');
if (!fs.existsSync(SUB_CACHE_DIR)) {
  fs.mkdirSync(SUB_CACHE_DIR, { recursive: true });
}

/**
 * 下载订阅内容
 */
function fetchSubscription(url, userAgent) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const options = {
      headers: {
        'User-Agent': userAgent || 'Clash Meta',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      timeout: 15000,
    };

    lib.get(url, options, (res) => {
      // 处理重定向
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchSubscription(res.headers.location, userAgent).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject).on('timeout', () => reject(new Error('Timeout')));
  });
}

/**
 * 解析订阅内容为代理列表
 * 支持 Clash YAML 格式 (proxies 字段) 和 Base64 编码格式
 */
function parseSubscription(content) {
  const result = { proxies: [], proxyGroups: [], raw: content };

  // 尝试 Clash YAML 解析
  try {
    const config = yaml.load(content);
    if (config && Array.isArray(config.proxies)) {
      result.proxies = config.proxies.map(normalizeProxy);
    }
    // 解析 proxy-groups
    if (config && Array.isArray(config['proxy-groups'])) {
      result.proxyGroups = config['proxy-groups'].map(normalizeGroup);
    }
    // 解析 rules
    if (config && Array.isArray(config.rules)) {
      result.rules = config.rules;
    }
    if (result.proxies.length > 0) return result;
  } catch {}

  // 尝试 Base64 解码 (SS/VMess/Trojan 链接格式)
  try {
    const decoded = Buffer.from(content.trim(), 'base64').toString('utf8');
    const lines = decoded.split('\n').filter(l => l.trim());
    for (const line of lines) {
      const proxy = parseProxyLink(line.trim());
      if (proxy) result.proxies.push(proxy);
    }
    if (result.proxies.length > 0) return result;
  } catch {}

  return result;
}

/**
 * 标准化代理配置
 */
function normalizeProxy(p) {
  const proxy = {
    name: p.name || 'unnamed',
    type: p.type || 'unknown',
    server: p.server || '',
    port: Number(p.port) || 0,
  };
  // 保留所有额外字段
  const extra = { ...p };
  delete extra.name;
  delete extra.type;
  delete extra.server;
  delete extra.port;
  proxy.config = extra;
  return proxy;
}

/**
 * 标准化代理组
 */
function normalizeGroup(g) {
  return {
    name: g.name || 'unnamed',
    type: g.type || 'select',
    proxies: g.proxies || [],
    url: g.url || null,
    interval: g.interval || 300,
  };
}

/**
 * 解析单个代理链接 (ss://, vmess://, trojan://, socks5://, http://, https://)
 */
function parseProxyLink(link) {
  link = link.trim();
  if (!link) return null;

  try {
    // SS 链接
    if (link.startsWith('ss://')) {
      return parseSS(link);
    }
    // VMess 链接
    if (link.startsWith('vmess://')) {
      return parseVMess(link);
    }
    // Trojan 链接
    if (link.startsWith('trojan://')) {
      return parseTrojan(link);
    }
    // SOCKS5
    if (link.startsWith('socks5://')) {
      return parseSocks(link);
    }
  } catch {}
  return null;
}

function parseSS(link) {
  // ss://base64(method:password@server:port)#name
  const hashIdx = link.indexOf('#');
  const name = hashIdx >= 0 ? decodeURIComponent(link.slice(hashIdx + 1)) : 'SS Node';
  const body = link.slice(5, hashIdx >= 0 ? hashIdx : undefined);

  let method, password, server, port;
  if (body.includes('@')) {
    const decoded = Buffer.from(body, 'base64').toString('utf8');
    const [mp, sp] = decoded.split('@');
    [method, password] = mp.split(':');
    [server, port] = sp.split(':');
  } else {
    const decoded = Buffer.from(body, 'base64').toString('utf8');
    const atIdx = decoded.lastIndexOf('@');
    const [mp] = [decoded.slice(0, atIdx)];
    const sp = decoded.slice(atIdx + 1);
    [method, password] = mp.split(':');
    [server, port] = sp.split(':');
  }

  return {
    name,
    type: 'ss',
    server: server || '',
    port: Number(port) || 0,
    config: { cipher: method || 'aes-256-gcm', password: password || '' },
  };
}

function parseVMess(link) {
  const decoded = JSON.parse(Buffer.from(link.slice(8), 'base64').toString('utf8'));
  return {
    name: decoded.ps || decoded.add || 'VMess Node',
    type: 'vmess',
    server: decoded.add || '',
    port: Number(decoded.port) || 443,
    config: {
      uuid: decoded.id || '',
      alterId: Number(decoded.aid) || 0,
      cipher: decoded.scy || 'auto',
      network: decoded.net || 'tcp',
      tls: decoded.tls === 'tls',
      sni: decoded.sni || decoded.host || '',
      wsPath: decoded.path || '',
      wsHost: decoded.host || '',
    },
  };
}

function parseTrojan(link) {
  const url = new URL(link);
  return {
    name: decodeURIComponent(url.hash?.slice(1) || url.hostname),
    type: 'trojan',
    server: url.hostname,
    port: Number(url.port) || 443,
    config: {
      password: url.searchParams.get('password') || url.username || '',
      sni: url.searchParams.get('sni') || url.hostname,
      network: url.searchParams.get('type') || 'tcp',
      allowInsecure: url.searchParams.get('allowInsecure') === '1',
    },
  };
}

function parseSocks(link) {
  const url = new URL(link);
  return {
    name: decodeURIComponent(url.hash?.slice(1) || url.hostname),
    type: 'socks5',
    server: url.hostname,
    port: Number(url.port) || 1080,
    config: {
      username: url.username || '',
      password: url.password || '',
    },
  };
}

/**
 * 注册订阅路由
 */
function registerSubscriptionRoutes(app, authMiddleware, Proxy, ProxyGroup, ProxyRule) {

  // 获取订阅列表
  app.get('/api/clash/subscriptions', authMiddleware, (req, res) => {
    const data = subscriptions.filter(s => s.userId === req.user.id);
    res.json({ data, total: data.length });
  });

  // 创建订阅
  app.post('/api/clash/subscriptions', authMiddleware, async (req, res) => {
    try {
      const { name, url, userAgent, autoUpdate, updateInterval } = req.body;
      if (!name || !url) return res.status(400).json({ error: 'name and url are required' });

      const sub = {
        id: nextSubId++,
        name,
        url,
        userAgent: userAgent || 'Clash Meta',
        autoUpdate: autoUpdate !== false,
        updateInterval: Number(updateInterval) || 86400, // 默认24小时
        status: 'pending',
        proxyCount: 0,
        lastUpdate: null,
        lastError: null,
        userId: req.user.id,
        createdAt: new Date().toISOString(),
      };
      subscriptions.push(sub);

      // 立即执行一次导入
      const result = await updateSubscription(sub, Proxy, ProxyGroup);
      sub.status = result.success ? 'active' : 'error';
      sub.proxyCount = result.proxyCount || 0;
      sub.lastUpdate = new Date().toISOString();
      sub.lastError = result.error || null;

      // 设置自动更新
      if (sub.autoUpdate) {
        scheduleUpdate(sub.id, sub.updateInterval, Proxy, ProxyGroup);
      }

      res.json({ data: sub, message: result.message });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 删除订阅
  app.delete('/api/clash/subscriptions/:id', authMiddleware, (req, res) => {
    const id = Number(req.params.id);
    const idx = subscriptions.findIndex(s => s.id === id && s.userId === req.user.id);
    if (idx === -1) return res.status(404).json({ error: 'Subscription not found' });

    // 清除定时器
    if (updateTimers.has(id)) {
      clearInterval(updateTimers.get(id));
      updateTimers.delete(id);
    }
    subscriptions.splice(idx, 1);
    res.json({ message: 'Subscription deleted' });
  });

  // 手动更新订阅
  app.post('/api/clash/subscriptions/:id/update', authMiddleware, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const sub = subscriptions.find(s => s.id === id && s.userId === req.user.id);
      if (!sub) return res.status(404).json({ error: 'Subscription not found' });

      const result = await updateSubscription(sub, Proxy, ProxyGroup);
      sub.status = result.success ? 'active' : 'error';
      sub.proxyCount = result.proxyCount || 0;
      sub.lastUpdate = new Date().toISOString();
      sub.lastError = result.error || null;

      res.json({ data: sub, message: result.message });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 更新订阅配置
  app.put('/api/clash/subscriptions/:id', authMiddleware, (req, res) => {
    const id = Number(req.params.id);
    const sub = subscriptions.find(s => s.id === id && s.userId === req.user.id);
    if (!sub) return res.status(404).json({ error: 'Subscription not found' });

    const fields = ['name', 'url', 'userAgent', 'autoUpdate', 'updateInterval'];
    for (const f of fields) {
      if (req.body[f] !== undefined) sub[f] = req.body[f];
    }

    // 重新调度
    if (updateTimers.has(id)) {
      clearInterval(updateTimers.get(id));
      updateTimers.delete(id);
    }
    if (sub.autoUpdate) {
      scheduleUpdate(id, sub.updateInterval, Proxy, ProxyGroup);
    }

    res.json({ data: sub, message: 'Subscription updated' });
  });

  // 获取订阅预览 (不导入)
  app.post('/api/clash/subscriptions/preview', authMiddleware, async (req, res) => {
    try {
      const { url, userAgent } = req.body;
      if (!url) return res.status(400).json({ error: 'url is required' });

      const content = await fetchSubscription(url, userAgent);
      const parsed = parseSubscription(content);

      res.json({
        data: {
          proxyCount: parsed.proxies.length,
          groupCount: parsed.proxyGroups.length,
          proxies: parsed.proxies.slice(0, 50), // 最多返回50个预览
          groups: parsed.proxyGroups,
        },
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}

/**
 * 执行订阅更新
 */
async function updateSubscription(sub, Proxy, ProxyGroup) {
  try {
    const content = await fetchSubscription(sub.url, sub.userAgent);
    const parsed = parseSubscription(content);

    // 缓存订阅内容
    fs.writeFileSync(
      path.join(SUB_CACHE_DIR, `sub-${sub.id}.yaml`),
      content,
      'utf8'
    );

    if (parsed.proxies.length === 0) {
      return { success: false, error: 'No proxies found in subscription', proxyCount: 0 };
    }

    // 导入代理节点到数据库
    // 先删除该订阅来源的旧节点
    await Proxy.destroy({
      where: {
        userId: sub.userId,
        config: { source: `subscription:${sub.id}` },
      },
    }).catch(() => {}); // 忽略错误，可能没有旧节点

    // 创建新节点
    for (const p of parsed.proxies) {
      await Proxy.create({
        name: `[${sub.name}] ${p.name}`,
        type: p.type,
        server: p.server,
        port: p.port,
        config: { ...p.config, source: `subscription:${sub.id}` },
        status: 'disconnected',
        userId: sub.userId,
      }).catch(err => console.error(`Failed to create proxy: ${err.message}`));
    }

    // 导入代理组 (如果有)
    if (parsed.proxyGroups.length > 0) {
      for (const g of parsed.proxyGroups) {
        await ProxyGroup.create({
          name: `[${sub.name}] ${g.name}`,
          type: g.type,
          proxies: g.proxies,
          url: g.url,
          interval: g.interval,
          enabled: true,
          userId: sub.userId,
        }).catch(() => {});
      }
    }

    return {
      success: true,
      proxyCount: parsed.proxies.length,
      message: `Imported ${parsed.proxies.length} proxies from ${sub.name}`,
    };
  } catch (error) {
    return { success: false, error: error.message, proxyCount: 0 };
  }
}

/**
 * 设置定时更新
 */
function scheduleUpdate(subId, intervalSeconds, Proxy, ProxyGroup) {
  const ms = Math.max(intervalSeconds, 300) * 1000; // 最少5分钟
  const timer = setInterval(async () => {
    const sub = subscriptions.find(s => s.id === subId);
    if (!sub) {
      clearInterval(timer);
      updateTimers.delete(subId);
      return;
    }
    const result = await updateSubscription(sub, Proxy, ProxyGroup);
    sub.status = result.success ? 'active' : 'error';
    sub.proxyCount = result.proxyCount || 0;
    sub.lastUpdate = new Date().toISOString();
    sub.lastError = result.error || null;
    console.log(`[Subscription:${subId}] Auto-update: ${result.message || result.error}`);
  }, ms);
  updateTimers.set(subId, timer);
}

module.exports = { registerSubscriptionRoutes, fetchSubscription, parseSubscription };
