/**
 * 网络环境适配服务
 * 检测网络变化 → 自动调整 Clash/Bore/VPN 配置
 */
const os = require('os');
const { execSync } = require('child_process');
const { logger } = require('../utils/logger');
const netMonitor = require('../networkMonitor');

// 上次检测的网络状态快照
let lastSnapshot = null;
let monitoringInterval = null;

/**
 * 获取当前网络环境快照
 */
function getNetworkSnapshot() {
  const interfaces = netMonitor.getNetworkInterfaces();
  const primary = interfaces.find(i => i.family === 'IPv4') || interfaces[0] || {};

  // 检测 DNS 配置
  let dnsServers = [];
  try {
    const resolvConf = require('fs').readFileSync('/etc/resolv.conf', 'utf8');
    dnsServers = resolvConf.split('\n')
      .filter(line => line.startsWith('nameserver'))
      .map(line => line.split(/\s+/)[1])
      .filter(Boolean);
  } catch { /* ignore */ }

  // 检测默认网关
  let gateway = '';
  try {
    const routeOutput = execSync('ip route show default 2>/dev/null', { encoding: 'utf8' });
    const gwMatch = routeOutput.match(/default via (\S+)/);
    if (gwMatch) gateway = gwMatch[1];
  } catch { /* ignore */ }

  // 检测 NAT 类型（简化：检查是否在常见私有网段）
  const isPrivate = /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(primary.address || '');

  return {
    hostname: os.hostname(),
    primaryInterface: primary.name || 'unknown',
    primaryAddress: primary.address || 'unknown',
    gateway,
    dnsServers,
    isPrivateNetwork: isPrivate,
    interfaceCount: interfaces.length,
    interfaces: interfaces.map(i => ({ name: i.name, address: i.address, family: i.family })),
    timestamp: Date.now(),
  };
}

/**
 * 检测网络是否发生了实质变化
 */
function hasNetworkChanged(prev, curr) {
  if (!prev) return true;
  if (prev.primaryAddress !== curr.primaryAddress) return true;
  if (prev.gateway !== curr.gateway) return true;
  if (prev.primaryInterface !== curr.primaryInterface) return true;
  if (JSON.stringify(prev.dnsServers) !== JSON.stringify(curr.dnsServers)) return true;
  return false;
}

/**
 * 生成网络环境报告
 */
function generateReport() {
  const snapshot = getNetworkSnapshot();
  const recommendations = [];

  // DNS 建议
  if (snapshot.dnsServers.length === 0) {
    recommendations.push({ type: 'warning', category: 'dns', message: 'No DNS servers configured. Consider adding DNS servers.' });
  }

  // 私有网络建议
  if (snapshot.isPrivateNetwork) {
    recommendations.push({
      type: 'info',
      category: 'nat',
      message: 'Detected private network (NAT). Bore tunnel recommended for external access.',
    });
  }

  // 接口数量建议
  if (snapshot.interfaceCount > 2) {
    recommendations.push({
      type: 'info',
      category: 'interface',
      message: `Multiple network interfaces detected (${snapshot.interfaceCount}). Check routing if connectivity issues occur.`,
    });
  }

  return {
    snapshot,
    changed: lastSnapshot ? hasNetworkChanged(lastSnapshot, snapshot) : false,
    previousSnapshot: lastSnapshot,
    recommendations,
  };
}

/**
 * 启动网络监控（定期检测变化）
 */
function startMonitoring(intervalMs = 30000) {
  stopMonitoring();
  lastSnapshot = getNetworkSnapshot();

  monitoringInterval = setInterval(() => {
    const current = getNetworkSnapshot();
    if (hasNetworkChanged(lastSnapshot, current)) {
      logger.info('Network environment changed', {
        from: lastSnapshot?.primaryAddress,
        to: current.primaryAddress,
        gateway: current.gateway,
      });
      lastSnapshot = current;
    }
  }, intervalMs);

  logger.info('Network adapter monitoring started', { intervalMs });
}

/**
 * 停止网络监控
 */
function stopMonitoring() {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
  }
}

module.exports = {
  getNetworkSnapshot,
  generateReport,
  startMonitoring,
  stopMonitoring,
};
