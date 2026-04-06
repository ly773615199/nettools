/**
 * 服务监控守护进程 [G6]
 * 定时检查所有 managed 服务的存活状态，支持自动重启 + 指数退避
 */
const EventEmitter = require('events');

class ServiceWatchdog extends EventEmitter {
  constructor(options = {}) {
    super();
    this.checkInterval = options.checkInterval || 30000; // 30s
    this.maxRetries = options.maxRetries || 5;
    this.baseDelay = options.baseDelay || 5000; // 5s
    this.maxDelay = options.maxDelay || 60000; // 60s
    this.timer = null;
    this.services = new Map(); // serviceKey -> { name, checkFn, restartFn, retries, lastCheck, status, crashCount }
    this.events = []; // recent events
    this.maxEvents = 100;
  }

  /**
   * 注册受监控的服务
   * @param {string} key - 服务唯一标识
   * @param {object} service - { name, checkFn: () => bool, restartFn: () => Promise }
   */
  register(key, service) {
    this.services.set(key, {
      name: service.name || key,
      checkFn: service.checkFn,
      restartFn: service.restartFn,
      retries: 0,
      lastCheck: null,
      status: 'unknown',
      crashCount: 0,
      enabled: true,
    });
    this.logEvent('watchdog', null, 'start', `Service registered: ${service.name || key}`);
  }

  /**
   * 注销服务
   */
  unregister(key) {
    this.services.delete(key);
  }

  /**
   * 启动守护进程
   */
  start() {
    if (this.timer) return;
    console.log('[watchdog] Starting service watchdog');
    this.logEvent('watchdog', null, 'start', 'Watchdog started');
    this.timer = setInterval(() => this._checkAll(), this.checkInterval);
    // 立即执行一次检查
    this._checkAll();
  }

  /**
   * 停止守护进程
   */
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.logEvent('watchdog', null, 'stop', 'Watchdog stopped');
    console.log('[watchdog] Stopped');
  }

  /**
   * 检查所有服务
   */
  async _checkAll() {
    for (const [key, service] of this.services) {
      if (!service.enabled) continue;
      try {
        const healthy = await service.checkFn();
        service.lastCheck = new Date();

        if (healthy) {
          if (service.status !== 'healthy') {
            this.logEvent(service.name, null, 'healthy', 'Service is healthy');
            this.emit('healthy', key);
          }
          service.status = 'healthy';
          service.retries = 0;
        } else {
          service.status = 'unhealthy';
          this.logEvent(service.name, null, 'unhealthy', 'Health check failed');
          this.emit('unhealthy', key);
          await this._tryRestart(key, service);
        }
      } catch (err) {
        service.status = 'error';
        service.lastCheck = new Date();
        this.logEvent(service.name, null, 'unhealthy', `Check error: ${err.message}`);
        await this._tryRestart(key, service);
      }
    }
  }

  /**
   * 尝试重启服务（指数退避）
   */
  async _tryRestart(key, service) {
    if (service.retries >= this.maxRetries) {
      this.logEvent(service.name, null, 'crash', `Max retries (${this.maxRetries}) reached, giving up`);
      this.emit('crash', key, `Max retries reached`);
      service.enabled = false; // 停止重启
      return;
    }

    const delay = Math.min(this.baseDelay * Math.pow(2, service.retries), this.maxDelay);
    service.retries++;

    this.logEvent(service.name, null, 'restart',
      `Attempting restart ${service.retries}/${this.maxRetries} after ${delay}ms`);

    await new Promise(resolve => setTimeout(resolve, delay));

    try {
      await service.restartFn();
      service.status = 'healthy';
      service.crashCount++;
      service.retries = 0; // 重启成功，重置退避
      this.logEvent(service.name, null, 'healthy', 'Restart successful');
      this.emit('restarted', key);
    } catch (err) {
      service.status = 'error';
      this.logEvent(service.name, null, 'crash', `Restart failed: ${err.message}`);
      // 递归重试
      await this._tryRestart(key, service);
    }
  }

  /**
   * 记录事件
   */
  logEvent(serviceType, serviceId, eventType, message) {
    const event = {
      serviceType,
      serviceId,
      eventType,
      message,
      timestamp: new Date(),
    };
    this.events.unshift(event);
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(0, this.maxEvents);
    }
    console.log(`[watchdog] ${serviceType} ${eventType}: ${message}`);
  }

  /**
   * 获取所有服务状态
   */
  getStatus() {
    const status = {};
    for (const [key, service] of this.services) {
      status[key] = {
        name: service.name,
        status: service.status,
        lastCheck: service.lastCheck,
        crashCount: service.crashCount,
        retries: service.retries,
        enabled: service.enabled,
      };
    }
    return status;
  }

  /**
   * 获取最近事件
   */
  getEvents(limit = 20) {
    return this.events.slice(0, limit);
  }
}

module.exports = ServiceWatchdog;
