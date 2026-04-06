import type { AppConfig, StorageService, Tunnel, Proxy } from '../types';
import { apiClient } from '../api/apiClient';

// 配置服务类
export class ConfigService {
  private config: AppConfig;
  private configKey = 'nettools-config';

  constructor() {
    // 从本地存储加载配置，如果没有则使用默认配置
    const savedConfig = localStorage.getItem(this.configKey);
    if (savedConfig) {
      this.config = JSON.parse(savedConfig);
    } else {
      // 默认配置
      this.config = {
        storage: [
          {
            id: '1',
            name: 'Local Storage',
            type: 'local',
            status: 'offline',
            config: {
              path: '/',
            },
          },
        ],
        tunnels: [
          {
            id: '1',
            name: 'Local Web Server',
            localPort: '8080',
            remoteServer: 'bore.pub',
            remotePort: '12345',
            status: 'stopped',
          },
        ],
        proxies: [
          {
            id: '1',
            name: 'US Server',
            type: 'Shadowsocks',
            server: 'us.example.com',
            port: '8388',
            status: 'disconnected',
            config: {},
          },
        ],
        system: {
          language: 'zh',
          theme: 'light',
          autoStart: false,
        },
        auth: {
          token: '',
          user: null,
        },
      };
      this.save();
    }
  }

  // 获取完整配置
  getConfig(): AppConfig {
    return this.config;
  }

  // 保存配置到本地存储
  save(): void {
    localStorage.setItem(this.configKey, JSON.stringify(this.config));
  }

  // 存储服务配置
  getStorageServices(): StorageService[] {
    return this.config.storage;
  }

  addStorageService(service: StorageService): void {
    this.config.storage.push(service);
    this.save();
  }

  updateStorageService(id: string, service: Partial<StorageService>): void {
    const index = this.config.storage.findIndex(s => s.id === id);
    if (index > -1) {
      this.config.storage[index] = { ...this.config.storage[index], ...service };
      this.save();
    }
  }

  removeStorageService(id: string): void {
    this.config.storage = this.config.storage.filter(s => s.id !== id);
    this.save();
  }

  // 隧道服务配置
  getTunnels(): Tunnel[] {
    return this.config.tunnels;
  }

  addTunnel(tunnel: Tunnel): void {
    this.config.tunnels.push(tunnel);
    this.save();
  }

  updateTunnel(id: string, tunnel: Partial<Tunnel>): void {
    const index = this.config.tunnels.findIndex(t => t.id === id);
    if (index > -1) {
      this.config.tunnels[index] = { ...this.config.tunnels[index], ...tunnel };
      this.save();
    }
  }

  removeTunnel(id: string): void {
    this.config.tunnels = this.config.tunnels.filter(t => t.id !== id);
    this.save();
  }

  // 代理服务配置
  getProxies(): Proxy[] {
    return this.config.proxies;
  }

  addProxy(proxy: Proxy): void {
    this.config.proxies.push(proxy);
    this.save();
  }

  updateProxy(id: string, proxy: Partial<Proxy>): void {
    const index = this.config.proxies.findIndex(p => p.id === id);
    if (index > -1) {
      this.config.proxies[index] = { ...this.config.proxies[index], ...proxy };
      this.save();
    }
  }

  removeProxy(id: string): void {
    this.config.proxies = this.config.proxies.filter(p => p.id !== id);
    this.save();
  }

  // 系统设置
  getSystemSettings() {
    return this.config.system;
  }

  updateSystemSettings(settings: Partial<typeof this.config.system>): void {
    this.config.system = { ...this.config.system, ...settings };
    this.save();
  }

  // 切换语言
  switchLanguage(language: 'zh' | 'en'): void {
    this.updateSystemSettings({ language });
  }

  // 导入配置
  importConfig(config: AppConfig): void {
    this.config = config;
    this.save();
  }

  // 导出配置
  exportConfig(): AppConfig {
    return this.config;
  }

  // 重置配置
  resetConfig(): void {
    this.config = {
      storage: [
        {
          id: '1',
          name: 'Local Storage',
          type: 'local',
          status: 'offline',
          config: {
            path: '/',
          },
        },
      ],
      tunnels: [
        {
          id: '1',
          name: 'Local Web Server',
          localPort: '8080',
          remoteServer: 'bore.pub',
          remotePort: '12345',
          status: 'stopped',
        },
      ],
      proxies: [
        {
          id: '1',
          name: 'US Server',
          type: 'Shadowsocks',
          server: 'us.example.com',
          port: '8388',
          status: 'disconnected',
          config: {},
        },
      ],
      system: {
        language: 'en',
        theme: 'light',
        autoStart: false,
      },
    };
    this.save();
  }

  // 设置完整配置
  setConfig(config: AppConfig): void {
    this.config = config;
    this.save();
  }

  // 认证相关方法
  getAuthToken(): string | null {
    return this.config.auth?.token || null;
  }

  setAuthToken(token: string): void {
    if (!this.config.auth) {
      this.config.auth = { token: '', user: null };
    }
    this.config.auth.token = token;
    this.save();
  }

  clearAuthToken(): void {
    if (!this.config.auth) {
      this.config.auth = { token: '', user: null };
    }
    this.config.auth.token = '';
    this.config.auth.user = null;
    this.save();
  }

  updateUserInfo(user: any): void {
    if (!this.config.auth) {
      this.config.auth = { token: '', user: null };
    }
    this.config.auth.user = user;
    this.save();
  }

  getUserInfo(): any {
    return this.config.auth?.user || null;
  }

  // 登录
  async login(username: string, password: string, rememberMe: boolean = false, captcha: string = ''): Promise<any> {
    const result = await apiClient.login(username, password, rememberMe, captcha);
    if (result.data) {
      this.setAuthToken(result.data.token);
      this.updateUserInfo(result.data.user);
    }
    return result;
  }

  // 获取验证码
  async getCaptcha(): Promise<any> {
    return await apiClient.getCaptcha();
  }

  // 注册
  async register(username: string, password: string): Promise<any> {
    const result = await apiClient.register(username, password);
    if (result.data) {
      this.setAuthToken(result.data.token);
      this.updateUserInfo(result.data.user);
    }
    return result;
  }

  // 注销
  async logout(): Promise<any> {
    const result = await apiClient.logout();
    if (!result.error) {
      this.clearAuthToken();
    }
    return result;
  }
}

// 导出配置服务实例
export const configService = new ConfigService();
