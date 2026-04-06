/**
 * 多节点部署器
 * 支持 VPS / NAS / 本地电脑 部署穿透组件
 * 通过 SSH 连接远程节点，或直接本地执行
 */
const { Client } = require('ssh2');
const { execSync, exec } = require('child_process');
const fs = require('fs');
const os = require('os');

class NodeDeployer {
  constructor() {
    this.drivers = {};
  }

  registerDriver(type, driver) {
    this.drivers[type] = driver;
  }

  /**
   * 自动检测节点系统信息
   * @param {Object} node - PenetrationNode plain object
   * @returns {Object} 检测结果
   */
  async detectNode(node) {
    if (node.nodeType === 'local' || node.host === 'localhost') {
      return this._detectLocal();
    }
    return this._detectRemote(node);
  }

  /**
   * 本地检测
   */
  async _detectLocal() {
    const platform = os.platform();
    const arch = os.arch();

    const result = {
      osType: this._mapPlatform(platform),
      arch: arch === 'arm64' ? 'aarch64' : arch,
      hasRoot: process.getuid ? process.getuid() === 0 : false,
      hasDocker: false,
      installed: {},
      publicIp: null,
      pkgManager: 'none',
      isNAS: false,
    };

    // 检测 Docker
    try { execSync('docker --version 2>/dev/null'); result.hasDocker = true; } catch {}

    // 检测包管理器
    try { execSync('which apt 2>/dev/null'); result.pkgManager = 'apt'; } catch {}
    try { execSync('which yum 2>/dev/null'); result.pkgManager = 'yum'; } catch {}
    try { execSync('which brew 2>/dev/null'); result.pkgManager = 'brew'; } catch {}

    // 检测已安装组件
    result.installed = await this._detectInstalled();

    // 检测公网 IP
    try {
      result.publicIp = execSync('curl -s --connect-timeout 3 ifconfig.me 2>/dev/null || curl -s --connect-timeout 3 ip.sb 2>/dev/null || true', { encoding: 'utf8' }).trim();
    } catch {}

    return result;
  }

  /**
   * 远程检测（通过 SSH）
   */
  async _detectRemote(node) {
    const conn = await this._sshConnect(node);

    try {
      const detectScript = `
        echo "OS_TYPE=$(cat /etc/os-release 2>/dev/null | grep ^ID= | cut -d= -f2 | tr -d '"' || uname -s)"
        echo "ARCH=$(uname -m)"
        echo "UID=$(id -u)"
        echo "DOCKER=$(docker --version 2>/dev/null && echo yes || echo no)"
        echo "WG=$(which wg 2>/dev/null && echo yes || echo no)"
        echo "BORE=$(which bore 2>/dev/null && echo yes || echo no)"
        echo "FRP=$(which frpc 2>/dev/null || which frps 2>/dev/null && echo yes || echo no)"
        echo "PUBLIC_IP=$(curl -s --connect-timeout 3 ifconfig.me 2>/dev/null || curl -s --connect-timeout 3 ip.sb 2>/dev/null)"
        echo "SYNOLOGY=$(test -f /etc.defaults/VERSION && echo yes || echo no)"
        echo "QNAP=$(getcfg System Platform -f /etc/platform.conf 2>/dev/null && echo yes || echo no)"
        echo "PKG=$(which apt 2>/dev/null && echo apt || (which yum 2>/dev/null && echo yum || (which apk 2>/dev/null && echo apk || echo none)))"
      `;

      const output = await this._sshExec(conn, detectScript);
      const lines = output.split('\n').reduce((acc, line) => {
        const [key, ...vals] = line.split('=');
        if (key) acc[key.trim()] = vals.join('=').trim();
        return acc;
      }, {});

      const isNAS = lines.SYNOLOGY === 'yes' || lines.QNAP === 'yes';

      return {
        osType: lines.SYNOLOGY === 'yes' ? 'synology'
          : lines.QNAP === 'yes' ? 'qnap'
          : this._normalizeOsType(lines.OS_TYPE),
        arch: lines.ARCH,
        hasRoot: lines.UID === '0',
        hasDocker: lines.DOCKER === 'yes',
        installed: {
          wireguard: lines.WG === 'yes',
          bore: lines.BORE === 'yes',
          frp: lines.FRP === 'yes',
          docker: lines.DOCKER === 'yes',
        },
        publicIp: lines.PUBLIC_IP || null,
        pkgManager: lines.PKG,
        isNAS,
      };
    } finally {
      conn.end();
    }
  }

  /**
   * 部署穿透组件到节点
   * @param {Object} node - PenetrationNode
   * @param {string[]} components - ['wireguard', 'frp', 'bore', ...]
   * @param {Object} instance - PenetrationInstance (用于生成配置)
   * @param {Object} nodeInfo - 检测结果
   * @returns {{ success: boolean, log: string[], error?: string }}
   */
  async deploy(node, components, instance, nodeInfo) {
    const log = [];

    for (const component of components) {
      const driver = this.drivers[component];
      if (!driver) {
        log.push(`[SKIP] Unknown component: ${component}`);
        continue;
      }

      try {
        log.push(`[DEPLOY] Installing ${component}...`);
        const deployConfig = driver.generateDeployScript(instance, nodeInfo);

        if (node.nodeType === 'local' || node.host === 'localhost') {
          await this._deployLocal(deployConfig, log);
        } else {
          await this._deployRemote(node, deployConfig, log);
        }

        log.push(`[OK] ${component} deployed successfully`);
      } catch (err) {
        log.push(`[ERROR] ${component}: ${err.message}`);
      }
    }

    return { success: true, log };
  }

  /**
   * 本地部署执行
   */
  async _deployLocal(deployConfig, log) {
    for (const file of deployConfig.files || []) {
      try {
        const dir = require('path').dirname(file.path);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(file.path, file.content, { mode: file.mode ? parseInt(file.mode, 8) : undefined });
        log.push(`  Written: ${file.path}`);
      } catch (err) {
        log.push(`  Failed to write ${file.path}: ${err.message}`);
      }
    }

    for (const cmd of deployConfig.commands || []) {
      try {
        log.push(`  Exec: ${cmd}`);
        const output = execSync(cmd, { encoding: 'utf8', timeout: 120000 });
        if (output.trim()) log.push(`  ${output.trim()}`);
      } catch (err) {
        log.push(`  Command failed: ${err.message}`);
      }
    }
  }

  /**
   * 远程部署执行（通过 SSH）
   */
  async _deployRemote(node, deployConfig, log) {
    const conn = await this._sshConnect(node);

    try {
      // 上传文件
      for (const file of deployConfig.files || []) {
        log.push(`  Upload: ${file.path}`);
        await this._sshExec(conn, `mkdir -p $(dirname ${file.path})`);
        await this._sshUpload(conn, file.content, file.path, file.mode);
      }

      // 执行命令
      for (const cmd of deployConfig.commands || []) {
        log.push(`  Remote: ${cmd}`);
        const output = await this._sshExec(conn, cmd);
        if (output.trim()) log.push(`  ${output.trim()}`);
      }
    } finally {
      conn.end();
    }
  }

  // ---- SSH 工具方法 ----

  _sshConnect(node) {
    return new Promise((resolve, reject) => {
      const conn = new Client();
      conn.on('ready', () => resolve(conn));
      conn.on('error', reject);

      const config = {
        host: node.host,
        port: node.sshPort || 22,
        username: node.sshUser || 'root',
        readyTimeout: 10000,
      };

      if (node.sshAuth === 'password' && node.sshPassword) {
        config.password = node.sshPassword;
      } else if (node.sshKeyPath) {
        try {
          config.privateKey = fs.readFileSync(node.sshKeyPath);
        } catch {
          return reject(new Error(`Cannot read SSH key: ${node.sshKeyPath}`));
        }
      }

      conn.connect(config);
    });
  }

  _sshExec(conn, command) {
    return new Promise((resolve, reject) => {
      conn.exec(command, { pty: false }, (err, stream) => {
        if (err) return reject(err);
        let output = '';
        stream.on('data', (data) => { output += data.toString(); });
        stream.stderr.on('data', (data) => { output += data.toString(); });
        stream.on('close', () => resolve(output));
      });
    });
  }

  _sshUpload(conn, content, remotePath, mode) {
    return new Promise((resolve, reject) => {
      conn.sftp((err, sftp) => {
        if (err) return reject(err);
        const writeStream = sftp.createWriteStream(remotePath);
        writeStream.on('close', () => {
          if (mode) {
            conn.exec(`chmod ${mode} ${remotePath}`, () => resolve());
          } else {
            resolve();
          }
        });
        writeStream.on('error', reject);
        writeStream.end(content);
      });
    });
  }

  _mapPlatform(platform) {
    const map = { linux: 'linux', darwin: 'macos', win32: 'windows' };
    return map[platform] || platform;
  }

  _normalizeOsType(osType) {
    if (!osType) return 'linux';
    const lower = osType.toLowerCase().trim();
    if (['ubuntu', 'debian', 'centos', 'rhel', 'fedora', 'alpine', 'arch'].includes(lower)) return lower;
    if (lower.includes('ubuntu')) return 'ubuntu';
    if (lower.includes('debian')) return 'debian';
    if (lower.includes('centos') || lower.includes('rhel')) return 'centos';
    return lower;
  }

  async _detectInstalled() {
    const installed = {};
    const checks = {
      wireguard: 'which wg 2>/dev/null',
      bore: 'which bore 2>/dev/null',
      frp: 'which frpc 2>/dev/null || which frps 2>/dev/null',
      cloudflare: 'which cloudflared 2>/dev/null',
      docker: 'which docker 2>/dev/null',
      autossh: 'which autossh 2>/dev/null',
    };

    for (const [key, cmd] of Object.entries(checks)) {
      try {
        const result = execSync(`${cmd} || true`, { encoding: 'utf8' }).trim();
        installed[key] = !!result;
      } catch {
        installed[key] = false;
      }
    }

    return installed;
  }
}

module.exports = { NodeDeployer };
