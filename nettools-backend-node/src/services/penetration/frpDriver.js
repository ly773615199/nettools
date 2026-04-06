/**
 * FRP 穿透驱动
 * 反向代理，支持 TCP/UDP/HTTP/HTTPS
 */
const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { BasePenetrationDriver } = require('./baseDriver');
const { KeyGenerator } = require('./keyGenerator');

const FRP_BIN_DIR = path.join(__dirname, '..', '..', '..', 'bin');
const FRP_CONFIG_DIR = path.join(__dirname, '..', '..', '..', 'frp-data');
if (!fs.existsSync(FRP_CONFIG_DIR)) fs.mkdirSync(FRP_CONFIG_DIR, { recursive: true });

class FrpDriver extends BasePenetrationDriver {
  constructor() {
    super('frp');
  }

  async detect() {
    const frpc = path.join(FRP_BIN_DIR, 'frpc');
    const frps = path.join(FRP_BIN_DIR, 'frps');
    const hasFrpc = fs.existsSync(frpc) || !!execSync('which frpc 2>/dev/null || true', { encoding: 'utf8' }).trim();
    const hasFrps = fs.existsSync(frps) || !!execSync('which frps 2>/dev/null || true', { encoding: 'utf8' }).trim();

    if (hasFrpc || hasFrps) return { available: true };
    return { available: false, reason: 'frpc/frps not found. Place in bin/ or download from GitHub releases.' };
  }

  /**
   * 生成 frps (服务端) 配置
   */
  generateServerConfig(instance) {
    const config = instance.config || {};
    const token = config.token || KeyGenerator.frpToken();
    const bindPort = config.bindPort || 7000;
    const dashboardPort = config.dashboardPort || 7500;

    const toml = `# NetTools FRP Server Config
bindPort = ${bindPort}

auth.method = "token"
auth.token = "${token}"

webServer.addr = "0.0.0.0"
webServer.port = ${dashboardPort}
webServer.user = "admin"
webServer.password = "${KeyGenerator.randomToken(8)}"

log.level = "info"
log.maxDays = 7
`;

    return {
      files: [{ path: '/opt/nettools/frp/frps.toml', content: toml }],
      commands: [],
      listenPort: bindPort,
      dashboardPort,
      token,
    };
  }

  /**
   * 生成 frpc (客户端) 配置
   */
  generateClientConfig(instance) {
    const config = instance.config || {};
    const mappings = instance.mappings || [];
    const serverHost = config.serverHost || '<SERVER_IP>';
    const serverPort = config.serverPort || 7000;
    const token = config.token || '<TOKEN>';

    let toml = `# NetTools FRP Client Config
serverAddr = "${serverHost}"
serverPort = ${serverPort}

auth.method = "token"
auth.token = "${token}"

log.level = "info"
log.maxDays = 7
`;

    for (let i = 0; i < mappings.length; i++) {
      const m = mappings[i];
      const name = m.name || `proxy-${i}`;
      const type = m.frpType || 'tcp';

      toml += `
[[proxies]]
name = "${name}"
type = "${type}"
localIP = "127.0.0.1"
localPort = ${m.localPort}
`;

      if (type === 'http' || type === 'https') {
        if (m.domain) toml += `customDomains = ["${m.domain}"]\n`;
      } else {
        toml += `remotePort = ${m.remotePort || m.localPort}\n`;
      }
    }

    return {
      files: [],
      content: toml,
      filename: `nettools-frpc-${instance.name || 'default'}.toml`,
    };
  }

  start(instance) {
    const config = instance.config || {};
    const clientResult = this.generateClientConfig(instance);
    const confPath = path.join(FRP_CONFIG_DIR, `frpc-${instance.id}.toml`);
    fs.writeFileSync(confPath, clientResult.content, 'utf8');

    const bin = fs.existsSync(path.join(FRP_BIN_DIR, 'frpc'))
      ? path.join(FRP_BIN_DIR, 'frpc')
      : 'frpc';

    const proc = spawn(bin, ['proxy', '-c', confPath], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    proc.stdout.on('data', d => console.log(`[frpc:${instance.id}] ${d.toString().trim()}`));
    proc.stderr.on('data', d => console.error(`[frpc:${instance.id}] ${d.toString().trim()}`));

    return proc;
  }

  stop(context) {
    if (context && context.process) {
      try { context.process.kill('SIGTERM'); } catch {}
    }
  }

  getStatus(context) {
    if (!context || !context.process) return { running: false };
    return { running: context.process.exitCode === null };
  }

  exportClientConfig(instance) {
    const result = this.generateClientConfig(instance);
    return {
      content: result.content,
      filename: result.filename,
    };
  }

  generateDeployScript(instance, nodeInfo) {
    const config = instance.config || {};
    const osType = nodeInfo.osType || 'ubuntu';
    const arch = nodeInfo.arch || 'x86_64';
    const token = config.token || KeyGenerator.frpToken();
    const bindPort = config.bindPort || 7000;
    const dashboardPort = config.dashboardPort || 7500;

    const archTag = arch === 'aarch64' ? 'arm64' : 'amd64';
    const serverConfig = this.generateServerConfig({ ...instance, config: { ...config, token } });

    // 通用下载脚本
    const downloadCmd = `mkdir -p /opt/nettools/frp /opt/nettools/bin && cd /tmp && curl -sL https://github.com/fatedier/frp/releases/download/v0.61.0/frp_0.61.0_linux_${archTag}.tar.gz -o frp.tar.gz && tar xzf frp.tar.gz && cp frp_0.61.0_linux_${archTag}/frps /opt/nettools/bin/ && cp frp_0.61.0_linux_${archTag}/frpc /opt/nettools/bin/ && rm -rf frp.tar.gz frp_0.61.0_linux_${archTag}`;

    const systemdUnit = `[Unit]
Description=NetTools FRP Server
After=network.target

[Service]
Type=simple
ExecStart=/opt/nettools/bin/frps -c /opt/nettools/frp/frps.toml
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
`;

    const installCmd = (osType === 'synology' || osType === 'qnap')
      ? downloadCmd
      : `command -v frps >/dev/null || { ${downloadCmd}; }`;

    return {
      files: [
        ...serverConfig.files,
        { path: '/etc/systemd/system/nettools-frps.service', content: systemdUnit },
      ],
      commands: [
        installCmd,
        'systemctl daemon-reload',
        'systemctl enable nettools-frps',
        'systemctl start nettools-frps',
      ],
    };
  }
}

module.exports = { FrpDriver };
