/**
 * 穿透驱动基类
 * 所有穿透方法必须继承此类并实现接口
 */
class BasePenetrationDriver {
  constructor(type) {
    this.type = type;
  }

  /**
   * 检测本机是否支持此穿透方法
   * @returns {{ available: boolean, reason?: string }}
   */
  async detect() {
    throw new Error(`detect() not implemented for ${this.type}`);
  }

  /**
   * 生成服务端配置文件
   * @param {Object} instance - PenetrationInstance (plain object)
   * @returns {{ files: [{path, content, mode?}], commands: string[] }}
   */
  generateServerConfig(instance) {
    throw new Error(`generateServerConfig() not implemented for ${this.type}`);
  }

  /**
   * 生成客户端配置文件
   * @param {Object} instance
   * @returns {{ files: [{path, content, mode?}], commands: string[] }}
   */
  generateClientConfig(instance) {
    throw new Error(`generateClientConfig() not implemented for ${this.type}`);
  }

  /**
   * 启动本地进程
   * @param {Object} instance
   * @returns {ChildProcess}
   */
  start(instance) {
    throw new Error(`start() not implemented for ${this.type}`);
  }

  /**
   * 停止进程
   * @param {Object} context - { pid, process? }
   */
  stop(context) {
    throw new Error(`stop() not implemented for ${this.type}`);
  }

  /**
   * 获取运行状态和统计
   * @returns {{ running, bytesUp?, bytesDown?, peers? }}
   */
  getStatus(context) {
    return { running: false };
  }

  /**
   * 导出客户端配置（供下载/扫码）
   * @param {Object} instance
   * @returns {{ content: string, filename: string, qrCode?: string }}
   */
  exportClientConfig(instance) {
    throw new Error(`exportClientConfig() not implemented for ${this.type}`);
  }

  /**
   * 部署服务端到远程节点的部署脚本
   * @param {Object} instance
   * @param {Object} nodeInfo - 节点检测信息
   * @returns {{ files: [{path, content, mode?}], commands: string[] }}
   */
  generateDeployScript(instance, nodeInfo) {
    throw new Error(`generateDeployScript() not implemented for ${this.type}`);
  }
}

module.exports = { BasePenetrationDriver };
