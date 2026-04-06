/**
 * VPN 进程管理器 [G5]
 * 管理 WireGuard / OpenVPN 服务端进程生命周期 + 配置自动生成
 */
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const VPN_CONFIG_DIR = path.join(__dirname, '..', '..', 'vpn-data');
if (!fs.existsSync(VPN_CONFIG_DIR)) {
  fs.mkdirSync(VPN_CONFIG_DIR, { recursive: true });
}

const runningVpns = new Map(); // vpnId -> { process, startTime }

/** 检测 VPN 工具 */
function detectTools() {
  const tools = {};
  try { execSync('which wg-quick 2>/dev/null', { encoding: 'utf8' }).trim(); tools.wireguard = true; } catch { tools.wireguard = false; }
  try { execSync('which openvpn 2>/dev/null', { encoding: 'utf8' }).trim(); tools.openvpn = true; } catch { tools.openvpn = false; }
  return tools;
}

/** 生成 WireGuard 密钥对 */
function generateWireguardKeys() {
  try {
    const privateKey = execSync('wg genkey', { encoding: 'utf8' }).trim();
    const publicKey = execSync(`echo "${privateKey}" | wg pubkey`, { encoding: 'utf8' }).trim();
    return { privateKey, publicKey };
  } catch {
    // fallback: generate random keys (not real wg keys, but placeholder)
    return {
      privateKey: crypto.randomBytes(32).toString('base64'),
      publicKey: crypto.randomBytes(32).toString('base64'),
    };
  }
}

/**
 * 生成 WireGuard 服务端配置
 */
function generateServerConfig(server) {
  const config = server.config || {};
  const keys = config.serverPrivateKey ? config : generateWireguardKeys();

  // 自动分配客户端 IP
  const subnet = server.subnet || '10.8.0.0/24';
  const baseIp = subnet.split('.').slice(0, 3).join('.');
  const serverIp = `${baseIp}.1`;
  const clientIp = `${baseIp}.2`;

  const wgConf = `[Interface]
PrivateKey = ${keys.privateKey}
Address = ${serverIp}/24
ListenPort = ${server.port || 51820}
PostUp = iptables -A FORWARD -i %i -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
PostDown = iptables -D FORWARD -i %i -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE
DNS = ${server.dns || '8.8.8.8'}

[Peer]
PublicKey = ${keys.clientPublicKey || '<CLIENT_PUBLIC_KEY>'}
AllowedIPs = ${clientIp}/32
`;

  const clientConf = `[Interface]
PrivateKey = ${keys.clientPrivateKey || '<CLIENT_PRIVATE_KEY>'}
Address = ${clientIp}/24
DNS = ${server.dns || '8.8.8.8'}

[Peer]
PublicKey = ${keys.publicKey || keys.serverPublicKey || '<SERVER_PUBLIC_KEY>'}
Endpoint = ${server.host || '<YOUR_SERVER_IP>'}:${server.port || 51820}
AllowedIPs = 0.0.0.0/0
PersistentKeepalive = 25
`;

  return {
    serverConfig: wgConf,
    clientConfig: clientConf,
    keys: {
      serverPrivateKey: keys.privateKey,
      serverPublicKey: keys.publicKey || keys.serverPublicKey,
      clientPrivateKey: keys.clientPrivateKey,
      clientPublicKey: keys.clientPublicKey,
    },
    ip: { server: serverIp, client: clientIp },
  };
}

/**
 * 生成 OpenVPN 服务端配置
 */
function generateOpenvpnServerConfig(server) {
  const config = server.config || {};
  const subnet = server.subnet || '10.8.0.0/24';
  const parts = subnet.split('.');
  const serverIp = `${parts[0]}.${parts[1]}.${parts[2]}.1`;

  return `port ${server.port || 1194}
proto ${server.protocol || 'udp'}
dev tun
ca ${VPN_CONFIG_DIR}/ca.crt
cert ${VPN_CONFIG_DIR}/server.crt
key ${VPN_CONFIG_DIR}/server.key
dh ${VPN_CONFIG_DIR}/dh.pem
server ${subnet}
ifconfig-pool-persist ${VPN_CONFIG_DIR}/ipp.txt
push "redirect-gateway def1 bypass-dhcp"
push "dhcp-option DNS ${server.dns || '8.8.8.8'}"
keepalive 10 120
cipher ${config.cipher || 'AES-256-CBC'}
auth ${config.auth || 'SHA256'}
persist-key
persist-tun
status ${VPN_CONFIG_DIR}/openvpn-status.log
verb 3
`;
}

/**
 * 启动 VPN 服务
 */
function startVpn(server) {
  const id = server.id;
  if (runningVpns.has(id)) {
    throw new Error(`VPN ${server.name} is already running`);
  }

  const tools = detectTools();

  if (server.type === 'wireguard') {
    if (!tools.wireguard) {
      throw new Error('WireGuard (wg-quick) not found. Please install wireguard-tools.');
    }

    const confPath = path.join(VPN_CONFIG_DIR, `wg-${id}.conf`);
    const result = generateServerConfig(server);
    fs.writeFileSync(confPath, result.serverConfig, { mode: 0o600 });

    try {
      const proc = spawn('wg-quick', ['up', confPath], { stdio: ['ignore', 'pipe', 'pipe'] });
      proc.stdout.on('data', d => console.log(`[vpn:${id}] ${d.toString().trim()}`));
      proc.stderr.on('data', d => console.error(`[vpn:${id}] ${d.toString().trim()}`));
      proc.on('exit', (code) => {
        runningVpns.delete(id);
        console.log(`[vpn:${id}] WireGuard exited with code ${code}`);
      });

      runningVpns.set(id, { process: proc, startTime: Date.now(), configResult: result });
      return { configResult: result };
    } catch (err) {
      throw new Error(`Failed to start WireGuard: ${err.message}`);
    }
  }

  if (server.type === 'openvpn') {
    if (!tools.openvpn) {
      throw new Error('OpenVPN not found. Please install openvpn.');
    }

    const confPath = path.join(VPN_CONFIG_DIR, `ovpn-server-${id}.conf`);
    fs.writeFileSync(confPath, generateOpenvpnServerConfig(server), { mode: 0o600 });

    try {
      const proc = spawn('openvpn', ['--config', confPath], { stdio: ['ignore', 'pipe', 'pipe'] });
      proc.stdout.on('data', d => console.log(`[vpn:${id}] ${d.toString().trim()}`));
      proc.stderr.on('data', d => console.error(`[vpn:${id}] ${d.toString().trim()}`));
      proc.on('exit', (code) => {
        runningVpns.delete(id);
        console.log(`[vpn:${id}] OpenVPN exited with code ${code}`);
      });

      runningVpns.set(id, { process: proc, startTime: Date.now() });
      return {};
    } catch (err) {
      throw new Error(`Failed to start OpenVPN: ${err.message}`);
    }
  }

  throw new Error(`Unknown VPN type: ${server.type}`);
}

/**
 * 停止 VPN 服务
 */
function stopVpn(server) {
  const id = server.id;
  const entry = runningVpns.get(id);
  if (!entry) throw new Error(`VPN ${server.name} is not running`);

  if (server.type === 'wireguard') {
    try {
      const confPath = path.join(VPN_CONFIG_DIR, `wg-${id}.conf`);
      execSync(`wg-quick down ${confPath} 2>/dev/null`, { encoding: 'utf8' });
    } catch {
      if (entry.process) try { entry.process.kill('SIGTERM'); } catch {}
    }
  } else {
    if (entry.process) try { entry.process.kill('SIGTERM'); } catch {}
  }

  runningVpns.delete(id);
}

/**
 * 检查 VPN 健康状态
 */
function checkHealth(id) {
  const entry = runningVpns.get(id);
  if (!entry) return { running: false };

  try {
    if (entry.process && entry.process.killed) return { running: false };
    // 对于 WireGuard，可以用 wg show 检查
    return { running: true, uptime: Date.now() - entry.startTime };
  } catch {
    return { running: false };
  }
}

function getRunning() {
  return runningVpns;
}

module.exports = {
  detectTools,
  generateWireguardKeys,
  generateServerConfig,
  generateOpenvpnServerConfig,
  startVpn,
  stopVpn,
  checkHealth,
  getRunning,
  runningVpns,
};
