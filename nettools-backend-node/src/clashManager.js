/**
 * Clash 进程管理器
 * 负责生成配置文件、启动/停止 Clash 进程、查询状态
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Clash 二进制路径 — 依次查找 mihomo / clash-meta / clash
function findClashBin() {
  const candidates = [
    path.join(__dirname, '..', '..', 'bin', 'mihomo'),
    path.join(__dirname, '..', '..', 'bin', 'clash'),
    '/usr/local/bin/mihomo',
    '/usr/bin/mihomo',
    '/usr/local/bin/clash',
    '/usr/bin/clash',
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  // 尝试 which
  try {
    return execSync('which mihomo 2>/dev/null || which clash 2>/dev/null', { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

const CLASH_BIN = findClashBin();
const CLASH_CONFIG_DIR = path.join(__dirname, '..', '..', 'clash-data');
const CLASH_CONFIG_FILE = path.join(CLASH_CONFIG_DIR, 'config.yaml');

// 确保配置目录存在
if (!fs.existsSync(CLASH_CONFIG_DIR)) {
  fs.mkdirSync(CLASH_CONFIG_DIR, { recursive: true });
}

let clashProcess = null;     // 当前 Clash 子进程
let clashStartTime = null;   // 启动时间
let clashConfig = null;      // 当前配置对象

/**
 * 默认 Clash 配置
 */
function defaultConfig() {
  return {
    port: 7890,
    'socks-port': 7891,
    'redir-port': 7892,
    'allow-lan': true,
    'bind-address': '*',
    mode: 'Rule',
    'log-level': 'info',
    'external-controller': '0.0.0.0:9090',
    secret: '',
    dns: {
      enable: true,
      listen: '0.0.0.0:5353',
      'enhanced-mode': 'fake-ip',
      nameserver: ['114.114.114.114', '8.8.8.8'],
      fallback: ['8.8.4.4'],
    },
    proxies: [],
    'proxy-groups': [],
    rules: [],
  };
}

/**
 * 将配置对象转为 YAML 字符串（简化版，覆盖项目所需字段）
 */
function configToYaml(config) {
  const lines = [];

  function emit(obj, indent = 0) {
    const prefix = '  '.repeat(indent);
    if (Array.isArray(obj)) {
      for (const item of obj) {
        if (typeof item === 'object' && item !== null) {
          lines.push(`${prefix}- `);
          emit(item, indent + 1);
        } else {
          lines.push(`${prefix}- ${formatValue(item)}`);
        }
      }
    } else if (typeof obj === 'object' && obj !== null) {
      for (const [key, value] of Object.entries(obj)) {
        if (Array.isArray(value)) {
          lines.push(`${prefix}${key}:`);
          emit(value, indent + 1);
        } else if (typeof value === 'object' && value !== null) {
          lines.push(`${prefix}${key}:`);
          emit(value, indent + 1);
        } else {
          lines.push(`${prefix}${key}: ${formatValue(value)}`);
        }
      }
    }
  }

  function formatValue(v) {
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    if (typeof v === 'number') return String(v);
    if (typeof v === 'string') {
      if (v === '' || /[:{}\[\],&*?|>!%@`#]/.test(v) || /^(true|false|null)$/i.test(v)) {
        return `"${v.replace(/"/g, '\\"')}"`;
      }
      return v;
    }
    return String(v);
  }

  emit(config);
  return lines.join('\n') + '\n';
}

/**
 * 从数据库 Proxy 记录生成 Clash proxies 和 proxy-groups
 */
function buildClashConfigFromDb(proxies) {
  const config = defaultConfig();

  for (const p of proxies) {
    let parsedConfig = {};
    try { parsedConfig = JSON.parse(p.config || '{}'); } catch {}

    const proxyDef = {
      name: p.name,
      server: p.server,
      port: parseInt(p.port, 10) || 0,
    };

    // 根据类型设置协议字段
    switch ((p.type || '').toLowerCase()) {
      case 'shadowsocks':
      case 'ss':
        proxyDef.type = 'ss';
        if (parsedConfig.cipher) proxyDef.cipher = parsedConfig.cipher;
        if (parsedConfig.password) proxyDef.password = parsedConfig.password;
        break;
      case 'vmess':
        proxyDef.type = 'vmess';
        proxyDef.uuid = parsedConfig.uuid || '';
        proxyDef.alterId = parsedConfig.alterId || 0;
        proxyDef.cipher = parsedConfig.cipher || 'auto';
        if (parsedConfig.network) proxyDef.network = parsedConfig.network;
        if (parsedConfig.wsPath) proxyDef['ws-path'] = parsedConfig.wsPath;
        if (parsedConfig.tls) proxyDef.tls = parsedConfig.tls;
        break;
      case 'trojan':
        proxyDef.type = 'trojan';
        if (parsedConfig.password) proxyDef.password = parsedConfig.password;
        if (parsedConfig.sni) proxyDef.sni = parsedConfig.sni;
        break;
      case 'socks5':
      case 'socks':
        proxyDef.type = 'socks5';
        if (parsedConfig.username) proxyDef.username = parsedConfig.username;
        if (parsedConfig.password) proxyDef.password = parsedConfig.password;
        break;
      case 'http':
      case 'https':
        proxyDef.type = 'http';
        if (parsedConfig.username) proxyDef.username = parsedConfig.username;
        if (parsedConfig.password) proxyDef.password = parsedConfig.password;
        if (parsedConfig.tls) proxyDef.tls = parsedConfig.tls;
        break;
      default:
        proxyDef.type = 'ss';
        if (parsedConfig.cipher) proxyDef.cipher = parsedConfig.cipher;
        if (parsedConfig.password) proxyDef.password = parsedConfig.password;
    }

    config.proxies.push(proxyDef);
  }

  // 如果有代理，创建一个默认代理组
  if (config.proxies.length > 0) {
    config['proxy-groups'] = [
      {
        name: 'Proxy',
        type: 'select',
        proxies: config.proxies.map(p => p.name),
      },
    ];
  }

  // 默认规则
  config.rules = [
    'DOMAIN-SUFFIX,google.com,Proxy',
    'DOMAIN-SUFFIX,github.com,Proxy',
    'DOMAIN-SUFFIX,youtube.com,Proxy',
    'GEOIP,CN,DIRECT',
    'MATCH,DIRECT',
  ];

  return config;
}

/**
 * 启动 Clash 进程
 */
function startClash(proxies = []) {
  if (clashProcess) {
    return { success: false, error: 'Clash is already running' };
  }
  if (!CLASH_BIN) {
    return { success: false, error: 'Clash binary not found. Install mihomo or clash.' };
  }

  // 生成配置
  clashConfig = buildClashConfigFromDb(proxies);
  const yamlStr = configToYaml(clashConfig);
  fs.writeFileSync(CLASH_CONFIG_FILE, yamlStr, 'utf8');

  try {
    clashProcess = spawn(CLASH_BIN, ['-d', CLASH_CONFIG_DIR, '-f', CLASH_CONFIG_FILE], {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
    });

    clashStartTime = Date.now();

    clashProcess.stdout.on('data', (data) => {
      console.log(`[clash] ${data.toString().trim()}`);
    });
    clashProcess.stderr.on('data', (data) => {
      console.error(`[clash] ${data.toString().trim()}`);
    });
    clashProcess.on('exit', (code, signal) => {
      console.log(`[clash] process exited (code=${code}, signal=${signal})`);
      clashProcess = null;
      clashStartTime = null;
    });
    clashProcess.on('error', (err) => {
      console.error(`[clash] spawn error: ${err.message}`);
      clashProcess = null;
      clashStartTime = null;
    });

    return { success: true, message: 'Clash started', configPath: CLASH_CONFIG_FILE };
  } catch (err) {
    clashProcess = null;
    return { success: false, error: err.message };
  }
}

/**
 * 停止 Clash 进程
 */
function stopClash() {
  if (!clashProcess) {
    return { success: false, error: 'Clash is not running' };
  }
  try {
    clashProcess.kill('SIGTERM');
    clashProcess = null;
    clashStartTime = null;
    return { success: true, message: 'Clash stopped' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * 重启 Clash
 */
function restartClash(proxies = []) {
  stopClash();
  // 等一小段时间确保进程退出
  return startClash(proxies);
}

/**
 * 获取 Clash 状态
 */
function getClashStatus() {
  const running = clashProcess !== null && clashProcess.exitCode === null;
  let uptime = '0s';
  if (running && clashStartTime) {
    const elapsed = Math.floor((Date.now() - clashStartTime) / 1000);
    const h = Math.floor(elapsed / 3600);
    const m = Math.floor((elapsed % 3600) / 60);
    const s = elapsed % 60;
    uptime = h > 0 ? `${h}h ${m}m ${s}s` : m > 0 ? `${m}m ${s}s` : `${s}s`;
  }

  return {
    running,
    hasBinary: CLASH_BIN !== null,
    binaryPath: CLASH_BIN,
    uptime,
    configFile: CLASH_CONFIG_FILE,
    httpPort: clashConfig?.port || 7890,
    socksPort: clashConfig?.['socks-port'] || 7891,
    mode: clashConfig?.mode || 'Rule',
  };
}

/**
 * 获取当前配置
 */
function getCurrentConfig() {
  return clashConfig || defaultConfig();
}

/**
 * 更新配置并重启
 */
function updateConfig(proxies, mode, rules) {
  if (mode) {
    if (!clashConfig) clashConfig = defaultConfig();
    clashConfig.mode = mode;
  }
  if (rules && Array.isArray(rules)) {
    if (!clashConfig) clashConfig = defaultConfig();
    clashConfig.rules = rules;
  }
  if (clashProcess) {
    return restartClash(proxies);
  }
  return { success: true, message: 'Config updated (Clash not running)' };
}

module.exports = {
  startClash,
  stopClash,
  restartClash,
  getClashStatus,
  getCurrentConfig,
  updateConfig,
  buildClashConfigFromDb,
};
