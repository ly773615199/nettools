/**
 * Clash 配置生成引擎
 * 从数据库 Proxy + ProxyGroup + ProxyRule 生成完整 YAML 配置
 */

const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');

const CONFIG_DIR = path.join(__dirname, '..', '..', 'clash');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.yaml');

/**
 * 生成 Clash 配置
 * @param {Object} options
 * @param {Array} options.proxies - Proxy 模型记录
 * @param {Array} options.proxyGroups - ProxyGroup 模型记录
 * @param {Array} options.proxyRules - ProxyRule 模型记录
 * @param {string} options.mode - 代理模式 (Rule/Global/Direct)
 * @returns {Object} YAML 配置对象
 */
function generateConfig({ proxies = [], proxyGroups = [], proxyRules = [], mode = 'Rule' }) {
  // 构建 proxies 列表
  const proxyList = proxies.map(p => {
    const config = typeof p.config === 'string' ? JSON.parse(p.config) : (p.config || {});
    const base = {
      name: p.name,
      type: p.type,
      server: p.server,
      port: Number(p.port),
    };
    // 合并额外配置（密码、加密方式、UUID 等）
    Object.assign(base, config);
    return base;
  });

  // 如果没有自定义代理组，创建默认组
  const groups = [];
  if (proxyGroups.length > 0) {
    for (const g of proxyGroups) {
      const proxiesList = typeof g.proxies === 'string' ? JSON.parse(g.proxies) : (g.proxies || []);
      const group = {
        name: g.name,
        type: g.type,
        proxies: proxiesList.length > 0 ? proxiesList : ['DIRECT'],
      };
      if (g.type === 'url-test' || g.type === 'fallback' || g.type === 'load-balance') {
        group.url = g.url || 'http://www.gstatic.com/generate_204';
        group.interval = g.interval || 300;
      }
      groups.push(group);
    }
  } else {
    // 默认代理组
    const proxyNames = proxyList.map(p => p.name);
    if (proxyNames.length > 0) {
      groups.push({
        name: 'Proxy',
        type: 'select',
        proxies: ['DIRECT', 'REJECT', ...proxyNames],
      });
      groups.push({
        name: 'Auto',
        type: 'url-test',
        proxies: proxyNames,
        url: 'http://www.gstatic.com/generate_204',
        interval: 300,
      });
    }
  }

  // 构建 rules 列表
  const rules = [];
  if (proxyRules.length > 0) {
    // 按 priority 排序
    const sorted = [...proxyRules].filter(r => r.enabled).sort((a, b) => b.priority - a.priority);
    for (const r of sorted) {
      rules.push(`${r.type},${r.value},${r.proxy}`);
    }
  }
  // 默认规则兜底
  if (rules.length > 0) {
    rules.push('MATCH,DIRECT');
  }

  // 完整配置
  const config = {
    'mixed-port': 7890,
    'allow-lan': true,
    mode: mode || 'Rule',
    'log-level': 'info',
    'external-controller': '127.0.0.1:9090',
    dns: {
      enable: true,
      listen: '0.0.0.0:5353',
      'default-nameserver': ['223.5.5.5', '8.8.8.8'],
      nameserver: ['https://dns.alidns.com/dns-query', 'https://doh.pub/dns-query'],
      'fallback-filter': {
        geoip: true,
        'geoip-code': 'CN',
      },
      fallback: ['https://1.1.1.1/dns-query', 'https://dns.google/dns-query'],
    },
  };

  if (proxyList.length > 0) {
    config.proxies = proxyList;
  }
  if (groups.length > 0) {
    config['proxy-groups'] = groups;
  }
  if (rules.length > 0) {
    config.rules = rules;
  }

  return config;
}

/**
 * 生成 TUN 模式配置
 */
function generateTunConfig(options = {}) {
  return {
    tun: {
      enable: true,
      stack: options.stack || 'mixed', // system/gvisor/mixed
      'dns-hijack': options.dnsHijack || 'any:53',
      'auto-route': options.autoRoute !== false,
      'auto-detect-interface': options.autoDetect !== false,
      ...(options.device ? { device: options.device } : {}),
    },
  };
}

/**
 * 生成链式代理配置
 * @param {Array} chains - 代理链 [{name, type, server, port, config}]
 */
function generateChainConfig(chains) {
  if (!chains || chains.length === 0) return {};
  // 链式代理通过 listeners 实现
  return {
    listeners: chains.map((chain, i) => ({
      name: `chain-${i}`,
      type: 'mixed',
      port: 7890 + i + 1,
      chain: chain.name,
    })),
  };
}

/**
 * 合并完整配置 (基础 + TUN + 链式 + 自定义)
 */
function generateFullConfig({ proxies, proxyGroups, proxyRules, mode, tun, chain, customConfig }) {
  const base = generateConfig({ proxies, proxyGroups, proxyRules, mode });

  if (tun?.enable) {
    Object.assign(base, generateTunConfig(tun));
  }

  if (chain?.length) {
    Object.assign(base, generateChainConfig(chain));
  }

  if (customConfig && typeof customConfig === 'object') {
    // 深度合并自定义配置
    for (const [key, val] of Object.entries(customConfig)) {
      if (typeof val === 'object' && !Array.isArray(val) && base[key] && typeof base[key] === 'object') {
        base[key] = { ...base[key], ...val };
      } else {
        base[key] = val;
      }
    }
  }

  return base;
}

/**
 * 写入 Clash 配置文件
 * @param {Object} configObj
 * @returns {{ success: boolean, path: string }}
 */
function writeConfigFile(configObj) {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  const content = yaml.dump(configObj, { lineWidth: -1, noRefs: true });
  fs.writeFileSync(CONFIG_FILE, content, 'utf8');
  return { success: true, path: CONFIG_FILE };
}

/**
 * 读取当前配置文件
 * @returns {Object|null}
 */
function readConfigFile() {
  if (!fs.existsSync(CONFIG_FILE)) return null;
  try {
    const content = fs.readFileSync(CONFIG_FILE, 'utf8');
    return yaml.load(content);
  } catch {
    return null;
  }
}

module.exports = {
  generateConfig,
  generateTunConfig,
  generateChainConfig,
  generateFullConfig,
  writeConfigFile,
  readConfigFile,
  CONFIG_FILE,
};
