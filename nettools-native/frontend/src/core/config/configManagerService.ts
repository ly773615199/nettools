import type { ApiResponse } from '../types';
import { apiClient } from '../api/apiClient';

// 系统信息接口
export interface SystemInfo {
  platform: string;
  arch: string;
  osVersion: string;
  nodeVersion: string;
  totalMemory: number;
  freeMemory: number;
  cpuCount: number;
  cpuUsage: number;
  cpuModel: string;
  hostname: string;
  uptime: number;
  isElectron: boolean;
  isDev: boolean;
}

// 网络环境接口
export interface NetworkInfo {
  isOnline: boolean;
  networkType: string;
  ipAddress: string;
  interfaces: Array<{ name: string; address: string; family: string; internal: boolean }>;
}

/**
 * 配置管理服务类 — 全部通过后端 API 实现
 */
export class ConfigManagerService {
  private systemInfo: SystemInfo | null = null;
  private networkInfo: NetworkInfo | null = null;

  // 获取系统信息
  async getSystemInfo(): Promise<ApiResponse<SystemInfo>> {
    const response = await apiClient.get<{ data: any }>('/system/metrics');
    if (response.error) return { data: undefined, error: response.error };

    const d = response.data?.data;
    const info: SystemInfo = {
      platform: d?.platform || 'unknown',
      arch: d?.arch || 'unknown',
      osVersion: d?.platform || '',
      nodeVersion: d?.nodeVersion || process.version,
      totalMemory: d?.memoryTotal ? Math.round(d.memoryTotal / 1024 / 1024) : 0,
      freeMemory: d?.memoryFree ? Math.round(d.memoryFree / 1024 / 1024) : 0,
      cpuCount: d?.cpuCores || 1,
      cpuUsage: parseFloat(d?.cpuUsage) || 0,
      cpuModel: d?.cpuModel || 'unknown',
      hostname: d?.hostname || '',
      uptime: d?.uptime || 0,
      isElectron: typeof window !== 'undefined' && !!(window as any).electronAPI,
      isDev: process.env.NODE_ENV === 'development',
    };
    this.systemInfo = info;
    return { data: info };
  }

  // 获取网络信息
  async getNetworkInfo(): Promise<ApiResponse<NetworkInfo>> {
    const response = await apiClient.get<{ data: any }>('/system/metrics');
    if (response.error) return { data: undefined, error: response.error };

    const d = response.data?.data;
    const interfaces = (d?.interfaces || []).map((i: any) => ({
      name: i.name,
      address: i.address,
      family: i.family,
      internal: i.internal,
    }));

    // 找到第一个非内部 IPv4 地址
    const externalIf = interfaces.find((i: any) => !i.internal);
    const info: NetworkInfo = {
      isOnline: true,
      networkType: 'ethernet',
      ipAddress: externalIf?.address || 'unknown',
      interfaces,
    };
    this.networkInfo = info;
    return { data: info };
  }

  // 自动调整配置
  async autoAdjustConfig(): Promise<ApiResponse<{ config: Record<string, any> }>> {
    const [sysResp, netResp] = await Promise.all([this.getSystemInfo(), this.getNetworkInfo()]);
    if (!sysResp.data || !netResp.data) {
      return { data: undefined, error: 'Failed to get system/network info' };
    }

    const config = {
      platform: sysResp.data.platform,
      maxMemoryUsage: Math.floor(sysResp.data.totalMemory * 0.8),
      network: { timeout: 5000, retryCount: 1 },
      cpu: { maxThreads: Math.max(1, Math.floor(sysResp.data.cpuCount * 0.8)) },
      environment: { isDev: sysResp.data.isDev, isElectron: sysResp.data.isElectron },
    };
    return { data: { config }, message: 'Configuration adjusted' };
  }

  // 检测环境变化
  async detectEnvironmentChanges(): Promise<ApiResponse<{ changed: boolean; changes: Record<string, any> }>> {
    const oldSys = this.systemInfo;
    const oldNet = this.networkInfo;
    const [newSys, newNet] = await Promise.all([this.getSystemInfo(), this.getNetworkInfo()]);

    const changes: Record<string, any> = {};
    if (oldSys && newSys.data) {
      if (oldSys.freeMemory !== newSys.data.freeMemory) changes.memory = { old: oldSys.freeMemory, new: newSys.data.freeMemory };
      if (oldSys.cpuUsage !== newSys.data.cpuUsage) changes.cpu = { old: oldSys.cpuUsage, new: newSys.data.cpuUsage };
    }
    if (oldNet && newNet.data) {
      if (oldNet.isOnline !== newNet.data.isOnline) changes.networkStatus = { old: oldNet.isOnline, new: newNet.data.isOnline };
    }

    return { data: { changed: Object.keys(changes).length > 0, changes } };
  }

  // 应用配置
  async applyConfig(config: Record<string, any>): Promise<ApiResponse<void>> {
    const response = await apiClient.put<{ message: string }>('/system/settings', { settings: config });
    return { data: undefined, message: response.data?.message, error: response.error };
  }

  // 重置配置到默认值
  async resetConfig(): Promise<ApiResponse<{ config: Record<string, any> }>> {
    const defaultConfig = {
      network: { timeout: 5000, retryCount: 1 },
      cpu: { maxThreads: 4 },
    };
    return { data: { config: defaultConfig }, message: 'Config reset to default' };
  }

  // 获取推荐配置
  async getRecommendedConfig(): Promise<ApiResponse<{ config: Record<string, any> }>> {
    return this.autoAdjustConfig();
  }
}

// 导出配置管理服务实例
export const configManagerService = new ConfigManagerService();
