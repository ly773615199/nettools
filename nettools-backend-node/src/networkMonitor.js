/**
 * 网络监控模块
 * 提供真实网络接口信息、连接状态、流量统计
 */
const os = require('os');
const { execSync } = require('child_process');
const http = require('http');
const https = require('https');

/**
 * 获取所有网络接口信息
 */
function getNetworkInterfaces() {
  const ifaces = os.networkInterfaces();
  const result = [];

  for (const [name, addrs] of Object.entries(ifaces)) {
    for (const addr of addrs || []) {
      // 跳过内部回环
      if (addr.internal) continue;
      result.push({
        name,
        family: addr.family === 'IPv4' ? 'IPv4' : 'IPv6',
        address: addr.address,
        netmask: addr.netmask,
        mac: addr.mac,
        internal: addr.internal,
        cidr: addr.cidr,
      });
    }
  }

  return result;
}

/**
 * 获取系统网络状态摘要
 */
function getNetworkStatus() {
  const ifaces = getNetworkInterfaces();
  const primary = ifaces.find(i => i.family === 'IPv4') || ifaces[0] || {};

  // 获取系统负载
  const loadAvg = os.loadavg();

  // 获取内存信息
  const totalMem = os.totalmem();
  const freeMem = os.freemem();

  // 获取运行时间
  const uptime = os.uptime();

  // 网络连接数（通过 /proc/net/tcp 或 ss）
  let connections = 0;
  try {
    const tcpData = require('fs').readFileSync('/proc/net/tcp', 'utf8');
    connections = tcpData.split('\n').length - 2; // 减去标题行和空行
  } catch {
    // 非Linux系统或权限不足
  }

  return {
    isOnline: true,
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    primaryInterface: primary.name || 'unknown',
    primaryAddress: primary.address || 'unknown',
    primaryMac: primary.mac || 'unknown',
    interfaces: ifaces,
    connections,
    loadAvg: {
      '1min': loadAvg[0],
      '5min': loadAvg[1],
      '15min': loadAvg[2],
    },
    memory: {
      total: totalMem,
      free: freeMem,
      used: totalMem - freeMem,
      usagePercent: ((totalMem - freeMem) / totalMem * 100).toFixed(1),
    },
    uptime,
    timestamp: Date.now(),
  };
}

/**
 * 获取网络流量统计（从 /proc/net/dev 读取）
 */
function getTrafficStats() {
  try {
    const data = require('fs').readFileSync('/proc/net/dev', 'utf8');
    const lines = data.trim().split('\n').slice(2); // 跳过标题行
    const stats = {};

    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      const iface = parts[0].replace(':', '');
      if (iface === 'lo') continue; // 跳过回环

      stats[iface] = {
        rxBytes: parseInt(parts[1], 10),
        rxPackets: parseInt(parts[2], 10),
        rxErrors: parseInt(parts[3], 10),
        rxDropped: parseInt(parts[4], 10),
        txBytes: parseInt(parts[9], 10),
        txPackets: parseInt(parts[10], 10),
        txErrors: parseInt(parts[11], 10),
        txDropped: parseInt(parts[12], 10),
      };
    }

    return { data: stats };
  } catch (err) {
    return { data: {}, error: err.message };
  }
}

/**
 * Ping 测试
 */
function pingTest(host = '8.8.8.8', count = 4) {
  try {
    const start = Date.now();
    const output = execSync(`ping -c ${count} -W 2 ${host}`, {
      encoding: 'utf8',
      timeout: 10000,
    });
    const elapsed = Date.now() - start;

    // 解析丢包率
    const lossMatch = output.match(/(\d+)% packet loss/);
    const loss = lossMatch ? parseInt(lossMatch[1], 10) : -1;

    // 解析平均延迟
    const rttMatch = output.match(/rtt min\/avg\/max\/mdev = ([\d.]+)\/([\d.]+)\/([\d.]+)\/([\d.]+) ms/);
    const rtt = rttMatch ? {
      min: parseFloat(rttMatch[1]),
      avg: parseFloat(rttMatch[2]),
      max: parseFloat(rttMatch[3]),
      mdev: parseFloat(rttMatch[4]),
    } : null;

    return {
      host,
      count,
      loss,
      rtt,
      raw: output,
      elapsed,
    };
  } catch (err) {
    return {
      host,
      count,
      loss: 100,
      rtt: null,
      error: err.message,
    };
  }
}

/**
 * HTTP 连接测试
 */
function httpTest(url = 'https://www.baidu.com') {
  return new Promise((resolve) => {
    const start = Date.now();
    const mod = url.startsWith('https') ? https : http;

    const req = mod.get(url, { timeout: 5000 }, (res) => {
      const elapsed = Date.now() - start;
      res.resume(); // 消费响应体
      resolve({
        url,
        status: res.statusCode,
        latency: elapsed,
        success: res.statusCode >= 200 && res.statusCode < 400,
      });
    });

    req.on('error', (err) => {
      resolve({
        url,
        status: 0,
        latency: Date.now() - start,
        success: false,
        error: err.message,
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        url,
        status: 0,
        latency: Date.now() - start,
        success: false,
        error: 'Timeout',
      });
    });
  });
}

/**
 * 获取当前 TCP/UDP 连接列表（简化版）
 */
function getConnections() {
  try {
    const tcp = require('fs').readFileSync('/proc/net/tcp', 'utf8');
    const tcp6 = require('fs').readFileSync('/proc/net/tcp6', 'utf8');
    const udp = require('fs').readFileSync('/proc/net/udp', 'utf8');

    const tcpCount = tcp.trim().split('\n').length - 1;
    const tcp6Count = tcp6.trim().split('\n').length - 1;
    const udpCount = udp.trim().split('\n').length - 1;

    return {
      data: {
        tcp: tcpCount,
        tcp6: tcp6Count,
        udp: udpCount,
        total: tcpCount + tcp6Count + udpCount,
      },
    };
  } catch (err) {
    return { data: { tcp: 0, tcp6: 0, udp: 0, total: 0 }, error: err.message };
  }
}

module.exports = {
  getNetworkInterfaces,
  getNetworkStatus,
  getTrafficStats,
  pingTest,
  httpTest,
  getConnections,
};
