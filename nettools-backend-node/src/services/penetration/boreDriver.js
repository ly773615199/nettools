/**
 * Bore 穿透驱动
 * 包装现有 bore 二进制，TCP 端口转发
 */
const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { BasePenetrationDriver } = require('./baseDriver');
const { KeyGenerator } = require('./keyGenerator');

const BORE_BIN = path.join(__dirname, '..', '..', '..', 'bin', 'bore');

class BoreDriver extends BasePenetrationDriver {
  constructor() {
    super('bore');
  }

  async detect() {
    if (fs.existsSync(BORE_BIN)) {
      return { available: true, binaryPath: BORE_BIN };
    }
    try {
      execSync('which bore 2>/dev/null', { encoding: 'utf8' });
      return { available: true };
    } catch {
      return { available: false, reason: 'bore binary not found. Place bore in bin/ directory.' };
    }
  }

  generateServerConfig(instance) {
    const config = instance.config || {};
    const minPort = config.minPort || 1024;
    const maxPort = config.maxPort || 65535;
    const secret = config.secret || KeyGenerator.boreSecret();

    const bindAddr = config.bindAddr || '0.0.0.0';

    return {
      files: [],
      commands: [
        `${BORE_BIN} server --min-port ${minPort} --max-port ${maxPort} --secret ${secret} --bind-addr ${bindAddr} &`,
      ],
      listenPort: 7835,
      secret,
    };
  }

  generateClientConfig(instance) {
    const config = instance.config || {};
    const mappings = instance.mappings || [];
    const serverHost = config.serverHost || '<SERVER_IP>';

    // Bore 每个映射需要一个独立进程
    const commands = mappings.map(m =>
      `${BORE_BIN} local ${m.localPort} --to ${serverHost} --port ${m.remotePort || 0} ${config.secret ? '--secret ' + config.secret : ''} &`
    );

    return { files: [], commands };
  }

  start(instance) {
    const config = instance.config || {};
    const mappings = instance.mappings || [];
    const serverHost = config.serverHost;
    if (!serverHost) throw new Error('serverHost is required for bore client');

    // 启动第一个映射
    const m = mappings[0] || { localPort: 3000 };
    const args = ['local', String(m.localPort), '--to', serverHost];
    if (m.remotePort) args.push('--port', String(m.remotePort));
    if (config.secret) args.push('--secret', config.secret);

    const bin = fs.existsSync(BORE_BIN) ? BORE_BIN : 'bore';
    const proc = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });

    proc.stdout.on('data', d => console.log(`[bore:${instance.id}] ${d.toString().trim()}`));
    proc.stderr.on('data', d => console.error(`[bore:${instance.id}] ${d.toString().trim()}`));

    return proc;
  }

  stop(context) {
    if (context && context.process) {
      try { context.process.kill('SIGTERM'); } catch {}
    }
  }

  getStatus(context) {
    if (!context || !context.process) return { running: false };
    return {
      running: context.process.exitCode === null,
    };
  }

  exportClientConfig(instance) {
    const config = instance.config || {};
    const mappings = instance.mappings || [];
    const serverHost = config.serverHost || '<SERVER_IP>';

    let content = `# Bore Tunnel Client Configuration\n`;
    content += `# Server: ${serverHost}\n`;
    content += `# Each mapping requires a separate bore process\n\n`;

    for (const m of mappings) {
      content += `# ${m.localPort} -> ${serverHost}:${m.remotePort || 'auto'}\n`;
      content += `bore local ${m.localPort} --to ${serverHost}`;
      if (m.remotePort) content += ` --port ${m.remotePort}`;
      if (config.secret) content += ` --secret ${config.secret}`;
      content += `\n\n`;
    }

    return {
      content,
      filename: `nettools-bore-client-${instance.name || 'default'}.sh`,
    };
  }

  generateDeployScript(instance, nodeInfo) {
    const config = instance.config || {};
    const osType = nodeInfo.osType || 'ubuntu';
    const arch = nodeInfo.arch || 'x86_64';
    const minPort = config.minPort || 1024;
    const maxPort = config.maxPort || 65535;
    const secret = config.secret || KeyGenerator.boreSecret();

    // 确定二进制文件名
    let binaryName = 'bore';
    let downloadCmd = '';

    if (osType === 'synology' || osType === 'qnap') {
      // NAS: 直接下载二进制
      downloadCmd = `curl -sL https://github.com/ekzhang/bore/releases/latest/download/bore-${arch === 'aarch64' ? 'aarch64' : 'x86_64'}-unknown-linux-musl -o /opt/nettools/bin/bore && chmod +x /opt/nettools/bin/bore`;
    } else {
      downloadCmd = `mkdir -p /opt/nettools/bin && curl -sL https://github.com/ekzhang/bore/releases/latest/download/bore-x86_64-unknown-linux-musl -o /opt/nettools/bin/bore && chmod +x /opt/nettools/bin/bore`;
    }

    // 生成 systemd service
    const systemdUnit = `[Unit]
Description=NetTools Bore Server
After=network.target

[Service]
Type=simple
ExecStart=/opt/nettools/bin/bore server --min-port ${minPort} --max-port ${maxPort} --secret ${secret} --bind-addr 0.0.0.0
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
`;

    return {
      files: [
        { path: '/etc/systemd/system/nettools-bore.service', content: systemdUnit },
      ],
      commands: [
        `command -v bore >/dev/null || { ${downloadCmd}; }`,
        'systemctl daemon-reload',
        'systemctl enable nettools-bore',
        'systemctl start nettools-bore',
      ],
    };
  }
}

module.exports = { BoreDriver };
