/**
 * PenetrationManager — 统一穿透引擎核心调度器
 * 管理节点、穿透实例、驱动调度
 */
const { WireGuardDriver } = require('./wireguardDriver');
const { BoreDriver } = require('./boreDriver');
const { FrpDriver } = require('./frpDriver');
const { SshDriver } = require('./sshDriver');
const { CloudflareDriver } = require('./cloudflareDriver');
const { NodeDeployer } = require('./nodeDeployer');
const { KeyGenerator } = require('./keyGenerator');

class PenetrationManager {
  constructor() {
    this.drivers = {
      wireguard: new WireGuardDriver(),
      bore: new BoreDriver(),
      frp: new FrpDriver(),
      ssh: new SshDriver(),
      cloudflare: new CloudflareDriver(),
    };

    this.deployer = new NodeDeployer();
    // 注册驱动到部署器
    for (const [type, driver] of Object.entries(this.drivers)) {
      this.deployer.registerDriver(type, driver);
    }

    // 运行中的实例 { id -> { driver, process, startTime, confPath? } }
    this.runningInstances = new Map();
  }

  // ============================================
  //  节点管理
  // ============================================

  /**
   * 检测节点系统信息
   */
  async detectNode(node) {
    const result = await this.deployer.detectNode(node);
    return result;
  }

  /**
   * 测试节点连通性
   */
  async testNode(node) {
    try {
      if (node.nodeType === 'local' || node.host === 'localhost') {
        return { reachable: true, latency: 0 };
      }
      const start = Date.now();
      const conn = await this.deployer._sshConnect(node);
      conn.end();
      return { reachable: true, latency: Date.now() - start };
    } catch (err) {
      return { reachable: false, error: err.message };
    }
  }

  /**
   * 部署组件到节点
   */
  async deployToNode(node, components, instance, nodeInfo) {
    return this.deployer.deploy(node, components, instance, nodeInfo);
  }

  // ============================================
  //  穿透实例生命周期
  // ============================================

  /**
   * 启动穿透实例
   */
  async start(instanceModel) {
    const id = instanceModel.id;
    if (this.runningInstances.has(id)) {
      return { success: false, error: 'Instance already running' };
    }

    const driver = this.drivers[instanceModel.type];
    if (!driver) {
      return { success: false, error: `Unknown penetration type: ${instanceModel.type}` };
    }

    try {
      const instance = instanceModel.get ? instanceModel.get({ plain: true }) : instanceModel;
      const proc = driver.start(instance);

      const entry = { driver, process: proc, startTime: Date.now() };
      this.runningInstances.set(id, entry);

      proc.on('exit', (code) => {
        console.log(`[penetration:${id}] process exited (code=${code})`);
        this.runningInstances.delete(id);
        instanceModel.update({ status: 'stopped', pid: null }).catch(() => {});
      });

      proc.on('error', (err) => {
        console.error(`[penetration:${id}] process error: ${err.message}`);
        this.runningInstances.delete(id);
        instanceModel.update({ status: 'error', lastError: err.message, pid: null }).catch(() => {});
      });

      await instanceModel.update({ status: 'running', pid: proc.pid, lastError: null });
      return { success: true, pid: proc.pid };
    } catch (err) {
      await instanceModel.update({ status: 'error', lastError: err.message });
      return { success: false, error: err.message };
    }
  }

  /**
   * 停止穿透实例
   */
  async stop(instanceModel) {
    const id = instanceModel.id;
    const entry = this.runningInstances.get(id);
    if (!entry) {
      await instanceModel.update({ status: 'stopped' });
      return { success: true };
    }

    try {
      entry.driver.stop({ process: entry.process, confPath: entry.confPath });
    } catch {}

    this.runningInstances.delete(id);
    await instanceModel.update({ status: 'stopped', pid: null });
    return { success: true };
  }

  /**
   * 重启穿透实例
   */
  async restart(instanceModel) {
    await this.stop(instanceModel);
    await new Promise(r => setTimeout(r, 1000));
    return this.start(instanceModel);
  }

  /**
   * 获取实例状态
   */
  getStatus(instanceId) {
    const entry = this.runningInstances.get(instanceId);
    if (!entry) return { running: false };
    return {
      running: true,
      uptime: Date.now() - entry.startTime,
      ...entry.driver.getStatus(entry),
    };
  }

  // ============================================
  //  配置生成与导出
  // ============================================

  /**
   * 生成服务端配置
   */
  generateServerConfig(instance) {
    const driver = this.drivers[instance.type];
    if (!driver) throw new Error(`Unknown type: ${instance.type}`);
    return driver.generateServerConfig(instance);
  }

  /**
   * 生成客户端配置
   */
  generateClientConfig(instance) {
    const driver = this.drivers[instance.type];
    if (!driver) throw new Error(`Unknown type: ${instance.type}`);
    return driver.generateClientConfig(instance);
  }

  /**
   * 导出客户端配置（供下载）
   */
  exportClientConfig(instance) {
    const driver = this.drivers[instance.type];
    if (!driver) throw new Error(`Unknown type: ${instance.type}`);
    return driver.exportClientConfig(instance);
  }

  /**
   * 生成部署脚本
   */
  generateDeployScript(instance, nodeInfo) {
    const driver = this.drivers[instance.type];
    if (!driver) throw new Error(`Unknown type: ${instance.type}`);
    return driver.generateDeployScript(instance, nodeInfo);
  }

  // ============================================
  //  工具方法
  // ============================================

  /**
   * 检测本机可用穿透方法
   */
  async detectLocalCapabilities() {
    const result = {};
    for (const [type, driver] of Object.entries(this.drivers)) {
      result[type] = await driver.detect();
    }
    return result;
  }

  /**
   * 生成密钥对
   */
  generateKeys(type) {
    if (type === 'wireguard') return KeyGenerator.wireguard();
    if (type === 'frp') return { token: KeyGenerator.frpToken() };
    if (type === 'bore') return { secret: KeyGenerator.boreSecret() };
    return { token: KeyGenerator.randomToken() };
  }

  /**
   * 获取支持的穿透类型列表
   */
  getSupportedTypes() {
    return [
      {
        type: 'wireguard',
        name: 'WireGuard VPN',
        description: 'TUN 模式虚拟网卡，全流量穿透，最强大',
        needsPublicServer: true,
        needsRoot: true,
        protocols: ['udp'],
      },
      {
        type: 'bore',
        name: 'Bore',
        description: 'TCP 端口转发，最简单，无需 root',
        needsPublicServer: true,
        needsRoot: false,
        protocols: ['tcp'],
      },
      {
        type: 'frp',
        name: 'FRP',
        description: '反向代理，支持 TCP/UDP/HTTP/HTTPS，功能丰富',
        needsPublicServer: true,
        needsRoot: false,
        protocols: ['tcp', 'udp', 'http', 'https'],
      },
      {
        type: 'ssh',
        name: 'SSH 反向隧道',
        description: '零部署，只要能 SSH 到服务器即可',
        needsPublicServer: true,
        needsRoot: false,
        protocols: ['tcp'],
      },
      {
        type: 'cloudflare',
        name: 'Cloudflare Tunnel',
        description: '不需要公网 IP！免费 CF 边缘中继',
        needsPublicServer: false,
        needsRoot: false,
        protocols: ['http', 'https', 'tcp', 'udp'],
      },
    ];
  }

  /**
   * 优雅关闭所有实例
   */
  stopAll() {
    for (const [id, entry] of this.runningInstances) {
      try { entry.driver.stop({ process: entry.process, confPath: entry.confPath }); } catch {}
    }
    this.runningInstances.clear();
  }
}

// 单例
const penetrationManager = new PenetrationManager();

module.exports = { penetrationManager, PenetrationManager };
