/**
 * Mihomo (Clash Meta) 运行时 API 客户端
 * 对接 mihomo 外部控制器 REST API
 * 文档: https://wiki.metacubex.one/api/
 */
const http = require('http');
const https = require('https');

class MihomoAPI {
  constructor(host = '127.0.0.1', port = 9090, secret = '') {
    this.host = host;
    this.port = port;
    this.secret = secret;
    this.baseUrl = `http://${host}:${port}`;
  }

  /** 发送请求到 mihomo API */
  _request(method, path, body) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.baseUrl);
      const lib = url.protocol === 'https:' ? https : http;
      const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(this.secret && { 'Authorization': `Bearer ${this.secret}` }),
        },
      };

      const req = lib.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (res.statusCode >= 400) {
              resolve({ error: json.message || json.error || `HTTP ${res.statusCode}`, data: null });
            } else {
              resolve({ data: json, error: null });
            }
          } catch {
            resolve({ data: data, error: null });
          }
        });
      });

      req.on('error', (err) => resolve({ data: null, error: err.message }));
      req.setTimeout(10000, () => { req.destroy(); resolve({ data: null, error: 'Timeout' }); });

      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }

  // ========== 基础信息 ==========

  /** 获取版本信息 */
  async getVersion() {
    return this._request('GET', '/version');
  }

  /** 获取配置 */
  async getConfigs() {
    return this._request('GET', '/configs');
  }

  /** 更新配置 (部分) */
  async patchConfigs(config) {
    return this._request('PATCH', '/configs', config);
  }

  /** 重载配置文件 */
  async reloadConfig() {
    return this._request('PUT', '/configs', { path: '' });
  }

  // ========== 代理 ==========

  /** 获取所有代理 */
  async getProxies() {
    return this._request('GET', '/proxies');
  }

  /** 获取单个代理 */
  async getProxy(name) {
    return this._request('GET', `/proxies/${encodeURIComponent(name)}`);
  }

  /** 选择代理组中的节点 */
  async selectProxy(groupName, proxyName) {
    return this._request('PUT', `/proxies/${encodeURIComponent(groupName)}`, { name: proxyName });
  }

  /** 获取代理延迟测试 */
  async testProxy(name, url, timeout) {
    return this._request('GET', `/proxies/${encodeURIComponent(name)}/delay?url=${encodeURIComponent(url || 'http://www.gstatic.com/generate_204')}&timeout=${timeout || 5000}`);
  }

  /** 测试代理组所有节点 */
  async testGroup(name, url, timeout) {
    return this._request('GET', `/group/${encodeURIComponent(name)}/delay?url=${encodeURIComponent(url || 'http://www.gstatic.com/generate_204')}&timeout=${timeout || 5000}`);
  }

  // ========== 代理提供者 ==========

  /** 获取代理提供者列表 */
  async getProxyProviders() {
    return this._request('GET', '/providers/proxies');
  }

  /** 获取单个代理提供者 */
  async getProxyProvider(name) {
    return this._request('GET', `/providers/proxies/${encodeURIComponent(name)}`);
  }

  /** 更新代理提供者 */
  async updateProxyProvider(name) {
    return this._request('PUT', `/providers/proxies/${encodeURIComponent(name)}`);
  }

  // ========== 规则 ==========

  /** 获取规则列表 */
  async getRules() {
    return this._request('GET', '/rules');
  }

  // ========== 规则提供者 ==========

  /** 获取规则提供者列表 */
  async getRuleProviders() {
    return this._request('GET', '/providers/rules');
  }

  /** 更新规则提供者 */
  async updateRuleProvider(name) {
    return this._request('PUT', `/providers/rules/${encodeURIComponent(name)}`);
  }

  // ========== 连接 ==========

  /** 获取所有连接 */
  async getConnections() {
    return this._request('GET', '/connections');
  }

  /** 关闭单个连接 */
  async closeConnection(id) {
    return this._request('DELETE', `/connections/${id}`);
  }

  /** 关闭所有连接 */
  async closeAllConnections() {
    return this._request('DELETE', '/connections');
  }

  // ========== 流量 & 元数据 ==========

  /** 获取实时流量 (需要 WebSocket，这里用 snapshots 替代) */
  async getTraffic() {
    return this._request('GET', '/traffic');
  }

  /** 获取内存使用 */
  async getMemory() {
    return this._request('GET', '/memory');
  }

  // ========== 日志 ==========

  /** 获取日志级别 */
  async getLogLevel() {
    return this._request('GET', '/logs');
  }

  // ========== DNS ==========

  /** 查询 DNS */
  async queryDNS(name, type) {
    return this._request('GET', `/dns/query?name=${name}&type=${type || 'A'}`);
  }

  // ========== 综合状态 ==========

  /** 获取完整运行状态 */
  async getFullStatus() {
    const [version, configs, proxies, rules, connections] = await Promise.all([
      this.getVersion().catch(() => ({ data: null })),
      this.getConfigs().catch(() => ({ data: null })),
      this.getProxies().catch(() => ({ data: null })),
      this.getRules().catch(() => ({ data: null })),
      this.getConnections().catch(() => ({ data: { connections: [] } })),
    ]);

    return {
      data: {
        version: version.data?.version || 'unknown',
        mode: configs.data?.mode || 'rule',
        port: configs.data?.port,
        socksPort: configs.data?.['socks-port'],
        mixedPort: configs.data?.['mixed-port'],
        redirPort: configs.data?.['redir-port'],
        tproxyPort: configs.data?.['tproxy-port'],
        proxyCount: Object.keys(proxies.data?.proxies || {}).length,
        ruleCount: (rules.data?.rules || []).length,
        connectionCount: (connections.data?.connections || []).length,
        host: this.host,
        port_api: this.port,
      },
      error: version.error,
    };
  }
}

// ========== Express 路由 ==========

function registerMihomoRoutes(app, authMiddleware) {
  const api = new MihomoAPI('127.0.0.1', 9090, '');

  // 获取运行状态
  app.get('/api/mihomo/status', authMiddleware, async (req, res) => {
    const result = await api.getFullStatus();
    res.json(result);
  });

  // 获取所有代理
  app.get('/api/mihomo/proxies', authMiddleware, async (req, res) => {
    const result = await api.getProxies();
    res.json(result);
  });

  // 获取单个代理组
  app.get('/api/mihomo/proxies/:name', authMiddleware, async (req, res) => {
    const result = await api.getProxy(req.params.name);
    res.json(result);
  });

  // 切换代理组中的节点
  app.put('/api/mihomo/proxies/:group', authMiddleware, async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'proxy name required' });
    const result = await api.selectProxy(req.params.group, name);
    res.json(result);
  });

  // 测试代理延迟
  app.get('/api/mihomo/proxies/:name/delay', authMiddleware, async (req, res) => {
    const result = await api.testProxy(req.params.name, req.query.url, Number(req.query.timeout));
    res.json(result);
  });

  // 测试代理组延迟
  app.get('/api/mihomo/group/:name/delay', authMiddleware, async (req, res) => {
    const result = await api.testGroup(req.params.name, req.query.url, Number(req.query.timeout));
    res.json(result);
  });

  // 获取规则
  app.get('/api/mihomo/rules', authMiddleware, async (req, res) => {
    const result = await api.getRules();
    res.json(result);
  });

  // 获取连接
  app.get('/api/mihomo/connections', authMiddleware, async (req, res) => {
    const result = await api.getConnections();
    res.json(result);
  });

  // 关闭连接
  app.delete('/api/mihomo/connections/:id', authMiddleware, async (req, res) => {
    const result = await api.closeConnection(req.params.id);
    res.json(result);
  });

  // 关闭所有连接
  app.delete('/api/mihomo/connections', authMiddleware, async (req, res) => {
    const result = await api.closeAllConnections();
    res.json(result);
  });

  // 获取代理提供者
  app.get('/api/mihomo/providers', authMiddleware, async (req, res) => {
    const result = await api.getProxyProviders();
    res.json(result);
  });

  // 更新代理提供者
  app.put('/api/mihomo/providers/:name', authMiddleware, async (req, res) => {
    const result = await api.updateProxyProvider(req.params.name);
    res.json(result);
  });

  // 获取规则提供者
  app.get('/api/mihomo/rule-providers', authMiddleware, async (req, res) => {
    const result = await api.getRuleProviders();
    res.json(result);
  });

  // 获取版本信息
  app.get('/api/mihomo/version', authMiddleware, async (req, res) => {
    const result = await api.getVersion();
    res.json(result);
  });

  // 获取配置
  app.get('/api/mihomo/config', authMiddleware, async (req, res) => {
    const result = await api.getConfigs();
    res.json(result);
  });

  // 更新配置
  app.patch('/api/mihomo/config', authMiddleware, async (req, res) => {
    const result = await api.patchConfigs(req.body);
    res.json(result);
  });

  // 获取内存使用
  app.get('/api/mihomo/memory', authMiddleware, async (req, res) => {
    const result = await api.getMemory();
    res.json(result);
  });
}

module.exports = { MihomoAPI, registerMihomoRoutes };
