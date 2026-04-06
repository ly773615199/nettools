/**
 * Cloudflare Tunnel 驱动
 * 无需公网 IP，通过 cloudflared 出站连接到 CF 边缘网络
 */
const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { BasePenetrationDriver } = require('./baseDriver');

const CF_CONFIG_DIR = path.join(__dirname, '..', '..', '..', 'cloudflare-data');
if (!fs.existsSync(CF_CONFIG_DIR)) fs.mkdirSync(CF_CONFIG_DIR, { recursive: true });

function findCloudflared() {
  const candidates = [
    path.join(__dirname, '..', '..', '..', 'bin', 'cloudflared'),
    '/usr/local/bin/cloudflared',
    '/usr/bin/cloudflared',
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  try {
    return execSync('which cloudflared 2>/dev/null', { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

class CloudflareDriver extends BasePenetrationDriver {
  constructor() {
    super('cloudflare');
  }

  async detect() {
    const bin = findCloudflared();
    if (bin) return { available: true, binaryPath: bin };
    return { available: false, reason: 'cloudflared not found. Download: https://github.com/cloudflare/cloudflared/releases' };
  }

  generateClientConfig(instance) {
    const config = instance.config || {};
    const mappings = instance.mappings || [];
    const tunnelToken = config.tunnelToken || '<TUNNEL_TOKEN>';

    // 方法1: Token 模式（推荐，配置托管在 CF Dashboard）
    if (config.mode === 'token' || tunnelToken !== '<TUNNEL_TOKEN>') {
      return {
        files: [],
        content: `# Cloudflare Tunnel - Token Mode\n# Run: cloudflared tunnel run --token ${tunnelToken}\ncloudflared tunnel run --token ${tunnelToken}\n`,
        filename: `nettools-cf-tunnel-${instance.name || 'default'}.sh`,
      };
    }

    // 方法2: Ingress 模式（本地配置）
    let yaml = `tunnel: ${config.tunnelId || '<TUNNEL_ID>'}\ncredentials-file: ${config.credentialsFile || '/root/.cloudflared/<TUNNEL_ID>.json'}\n\ningress:\n`;

    for (const m of mappings) {
      const hostname = m.domain || m.hostname;
      if (hostname) {
        yaml += `  - hostname: ${hostname}\n    service: http://localhost:${m.localPort}\n`;
      } else {
        yaml += `  - service: http://localhost:${m.localPort}\n`;
      }
    }
    yaml += `  - http_status: 404\n`;

    return {
      files: [],
      content: yaml,
      filename: `nettools-cf-config-${instance.name || 'default'}.yml`,
    };
  }

  start(instance) {
    const config = instance.config || {};
    const bin = findCloudflared();
    if (!bin) throw new Error('cloudflared not found');

    let args;
    if (config.tunnelToken) {
      args = ['tunnel', 'run', '--token', config.tunnelToken];
    } else {
      const confPath = path.join(CF_CONFIG_DIR, `config-${instance.id}.yml`);
      const clientConfig = this.generateClientConfig(instance);
      fs.writeFileSync(confPath, clientConfig.content, 'utf8');
      args = ['tunnel', 'run', '--config', confPath];
    }

    const proc = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });

    proc.stdout.on('data', d => console.log(`[cf:${instance.id}] ${d.toString().trim()}`));
    proc.stderr.on('data', d => console.error(`[cf:${instance.id}] ${d.toString().trim()}`));

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
    const arch = nodeInfo.arch || 'x86_64';
    const osType = nodeInfo.osType || 'ubuntu';

    let downloadCmd;
    if (arch === 'aarch64') {
      downloadCmd = 'curl -sL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64 -o /opt/nettools/bin/cloudflared && chmod +x /opt/nettools/bin/cloudflared';
    } else {
      downloadCmd = 'curl -sL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /opt/nettools/bin/cloudflared && chmod +x /opt/nettools/bin/cloudflared';
    }

    const systemdUnit = `[Unit]
Description=NetTools Cloudflare Tunnel
After=network.target

[Service]
Type=simple
ExecStart=/opt/nettools/bin/cloudflared tunnel run --token %i
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
`;

    return {
      files: [
        { path: '/etc/systemd/system/nettools-cloudflare@.service', content: systemdUnit },
      ],
      commands: [
        `command -v cloudflared >/dev/null || { mkdir -p /opt/nettools/bin && ${downloadCmd}; }`,
        'echo "Cloudflare Tunnel requires a token from CF Dashboard."',
      ],
    };
  }
}

module.exports = { CloudflareDriver };
