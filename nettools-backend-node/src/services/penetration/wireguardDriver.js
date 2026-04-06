/**
 * WireGuard 穿透驱动
 * TUN 模式虚拟网卡 + 加密 UDP 隧道 + iptables 端口映射
 */
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { BasePenetrationDriver } = require('./baseDriver');
const { KeyGenerator } = require('./keyGenerator');

const WG_CONFIG_DIR = path.join(__dirname, '..', '..', '..', 'wireguard-data');
if (!fs.existsSync(WG_CONFIG_DIR)) fs.mkdirSync(WG_CONFIG_DIR, { recursive: true });

class WireGuardDriver extends BasePenetrationDriver {
  constructor() {
    super('wireguard');
  }

  async detect() {
    try {
      execSync('which wg 2>/dev/null', { encoding: 'utf8' });
      execSync('which wg-quick 2>/dev/null', { encoding: 'utf8' });
      return { available: true };
    } catch {
      return { available: false, reason: 'wireguard-tools not installed. Install: apt install wireguard' };
    }
  }

  /**
   * 生成服务端 WireGuard 配置
   */
  generateServerConfig(instance) {
    const config = instance.config || {};
    const mappings = instance.mappings || [];

    // 生成密钥对（如果没有）
    if (!config.serverPrivateKey) {
      const keys = KeyGenerator.wireguard();
      config.serverPrivateKey = keys.privateKey;
      config.serverPublicKey = keys.publicKey;
    }

    const listenPort = config.listenPort || 51820;
    const subnet = config.subnet || '10.8.0.0/24';
    const serverAddress = config.serverAddress || '10.8.0.1';
    const clientAddress = config.clientAddress || '10.8.0.2';

    // 生成 iptables DNAT 规则
    const postUpRules = [];
    const postDownRules = [];

    for (const m of mappings) {
      const proto = m.protocol || 'tcp';
      postUpRules.push(
        `iptables -t nat -A PREROUTING -p ${proto} --dport ${m.remotePort} -j DNAT --to-destination ${clientAddress}:${m.localPort}`
      );
      postDownRules.push(
        `iptables -t nat -D PREROUTING -p ${proto} --dport ${m.remotePort} -j DNAT --to-destination ${clientAddress}:${m.localPort}`
      );
    }

    // NAT 转发
    postUpRules.push('iptables -A POSTROUTING -s ' + subnet + ' -j MASQUERADE');
    postDownRules.push('iptables -D POSTROUTING -s ' + subnet + ' -j MASQUERADE');

    const wgConf = `[Interface]
PrivateKey = ${config.serverPrivateKey}
Address = ${serverAddress}/24
ListenPort = ${listenPort}
${postUpRules.map(r => `PostUp = ${r}`).join('\n')}
${postDownRules.map(r => `PostDown = ${r}`).join('\n')}

[Peer]
PublicKey = ${config.clientPublicKey || '<CLIENT_PUBLIC_KEY>'}
${config.presharedKey ? `PresharedKey = ${config.presharedKey}` : ''}
AllowedIPs = ${clientAddress}/32
`;

    return {
      files: [
        { path: '/etc/wireguard/wg0.conf', content: wgConf, mode: '0600' },
      ],
      commands: [
        'sysctl -w net.ipv4.ip_forward=1',
        'wg-quick up wg0',
        'systemctl enable wg-quick@wg0',
      ],
      listenPort,
      serverPublicKey: config.serverPublicKey,
      serverAddress,
      clientAddress,
    };
  }

  /**
   * 生成客户端 WireGuard 配置
   */
  generateClientConfig(instance) {
    const config = instance.config || {};
    const serverHost = config.serverHost || '<SERVER_IP>';
    const listenPort = config.listenPort || 51820;
    const clientAddress = config.clientAddress || '10.8.0.2';
    const subnet = config.subnet || '10.8.0.0/24';

    // 生成客户端密钥对（如果没有）
    if (!config.clientPrivateKey) {
      const keys = KeyGenerator.wireguard();
      config.clientPrivateKey = keys.privateKey;
      config.clientPublicKey = keys.publicKey;
    }

    const wgConf = `[Interface]
PrivateKey = ${config.clientPrivateKey}
Address = ${clientAddress}/24
DNS = ${config.dns || '8.8.8.8'}

[Peer]
PublicKey = ${config.serverPublicKey || '<SERVER_PUBLIC_KEY>'}
${config.presharedKey ? `PresharedKey = ${config.presharedKey}` : ''}
Endpoint = ${serverHost}:${listenPort}
AllowedIPs ${config.allowedIps || subnet}
PersistentKeepalive = 25
`;

    return {
      files: [],
      content: wgConf,
      filename: `nettools-wg-client-${instance.name || 'default'}.conf`,
    };
  }

  /**
   * 启动本地 WireGuard（作为客户端连接远程服务器）
   */
  start(instance) {
    const config = instance.config || {};
    const confPath = path.join(WG_CONFIG_DIR, `wg-client-${instance.id}.conf`);

    const clientResult = this.generateClientConfig(instance);
    fs.writeFileSync(confPath, clientResult.content, { mode: 0o600 });

    // 检查是否已有同名接口在运行
    try {
      const wgShow = execSync('wg show 2>/dev/null', { encoding: 'utf8' });
      if (wgShow.includes('wg-client-' + instance.id)) {
        execSync(`wg-quick down ${confPath} 2>/dev/null || true`);
      }
    } catch {}

    const proc = spawn('wg-quick', ['up', confPath], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    proc.stdout.on('data', d => console.log(`[wg:${instance.id}] ${d.toString().trim()}`));
    proc.stderr.on('data', d => console.error(`[wg:${instance.id}] ${d.toString().trim()}`));

    return proc;
  }

  stop(context) {
    if (context && context.confPath) {
      try { execSync(`wg-quick down ${context.confPath} 2>/dev/null`); } catch {}
    }
    if (context && context.process) {
      try { context.process.kill('SIGTERM'); } catch {}
    }
  }

  getStatus(context) {
    if (!context) return { running: false };
    try {
      const output = execSync('wg show 2>/dev/null', { encoding: 'utf8' });
      if (!output.trim()) return { running: false };

      // 解析流量统计
      const transferMatch = output.match(/transfer:\s+([\d.]+)\s*(\w+)\s+received,\s+([\d.]+)\s*(\w+)\s+sent/);
      let bytesDown = 0, bytesUp = 0;
      if (transferMatch) {
        bytesDown = this._parseBytes(parseFloat(transferMatch[1]), transferMatch[2]);
        bytesUp = this._parseBytes(parseFloat(transferMatch[3]), transferMatch[4]);
      }

      // 解析 peer 数量
      const peers = (output.match(/\[Peer\]/g) || []).length;

      return { running: true, bytesUp, bytesDown, peers };
    } catch {
      return { running: false };
    }
  }

  exportClientConfig(instance) {
    const result = this.generateClientConfig(instance);
    return {
      content: result.content,
      filename: result.filename,
    };
  }

  /**
   * 生成远程部署脚本
   */
  generateDeployScript(instance, nodeInfo) {
    const config = instance.config || {};
    const serverConfig = this.generateServerConfig(instance);
    const osType = nodeInfo.osType || 'ubuntu';
    const hasDocker = nodeInfo.hasDocker || false;

    // NAS 优先用 Docker
    if ((osType === 'synology' || osType === 'qnap') && hasDocker) {
      return this._dockerDeployScript(serverConfig, config);
    }

    // 标准 Linux 安装
    return this._nativeDeployScript(serverConfig, config, osType);
  }

  _dockerDeployScript(serverConfig, config) {
    const confContent = serverConfig.files[0].content;
    const listenPort = serverConfig.listenPort || 51820;

    return {
      files: [
        { path: '/tmp/nettools-wg0.conf', content: confContent, mode: '0600' },
      ],
      commands: [
        'mkdir -p /opt/nettools/wireguard/config',
        'cp /tmp/nettools-wg0.conf /opt/nettools/wireguard/config/wg0.conf',
        `docker run -d --name=nettools-wireguard --cap-add=NET_ADMIN --cap-add=SYS_MODULE --restart=always -v /opt/nettools/wireguard/config:/config -e PUID=1000 -e PGID=1000 -e TZ=Asia/Shanghai -p ${listenPort}:${listenPort}/udp linuxserver/wireguard`,
        'rm -f /tmp/nettools-wg0.conf',
      ],
    };
  }

  _nativeDeployScript(serverConfig, config, osType) {
    const confContent = serverConfig.files[0].content;
    let installCmd = '';

    if (osType === 'ubuntu' || osType === 'debian') {
      installCmd = 'apt update && apt install -y wireguard qrencode';
    } else if (osType === 'centos') {
      installCmd = 'yum install -y epel-release && yum install -y wireguard-tools qrencode';
    } else if (osType === 'alpine') {
      installCmd = 'apk add wireguard-tools qrencode';
    } else {
      installCmd = 'echo "Please install wireguard-tools manually"';
    }

    return {
      files: [
        { path: '/tmp/wg0.conf', content: confContent, mode: '0600' },
      ],
      commands: [
        `command -v wg >/dev/null || { ${installCmd}; }`,
        'mkdir -p /etc/wireguard',
        'mv /tmp/wg0.conf /etc/wireguard/wg0.conf',
        'chmod 600 /etc/wireguard/wg0.conf',
        'echo "net.ipv4.ip_forward = 1" > /etc/sysctl.d/99-wireguard.conf',
        'sysctl -p /etc/sysctl.d/99-wireguard.conf',
        'wg-quick up wg0',
        'systemctl enable wg-quick@wg0 2>/dev/null || true',
      ],
    };
  }

  _parseBytes(value, unit) {
    const multipliers = { B: 1, KiB: 1024, MiB: 1048576, GiB: 1073741824, TiB: 1099511627776 };
    return Math.round(value * (multipliers[unit] || 1));
  }
}

module.exports = { WireGuardDriver };
