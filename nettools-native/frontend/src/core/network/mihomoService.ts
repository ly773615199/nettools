import type { ApiResponse } from '../types';
import { apiClient } from '../api/apiClient';

// Mihomo 运行状态
export interface MihomoStatus {
  version: string;
  mode: string;
  port?: number;
  socksPort?: number;
  mixedPort?: number;
  redirPort?: number;
  proxyCount: number;
  ruleCount: number;
  connectionCount: number;
  host: string;
  port_api: number;
}

// 代理节点
export interface MihomoProxy {
  name: string;
  type: string;
  udp: boolean;
  xudp: boolean;
  tfo: boolean;
  history: Array<{ time: string; delay: number }>;
  all?: string[];
  now?: string;
}

// 代理组
export interface MihomoGroup extends MihomoProxy {
  now: string;
  all: string[];
  hidden: boolean;
}

// 活跃连接
export interface MihomoConnection {
  id: string;
  metadata: {
    network: string;
    type: string;
    host: string;
    srcIP: string;
    srcPort: string;
    dstIP: string;
    dstPort: string;
    process?: string;
  };
  chains: string[];
  rule: string;
  start: string;
  download: number;
  upload: number;
}

// 规则
export interface MihomoRule {
  type: string;
  payload: string;
  proxy: string;
  size?: number;
}

// 代理提供者
export interface MihomoProvider {
  name: string;
  type: string;
  proxies: MihomoProxy[];
  updatedAt: string;
  vehicleType: string;
}

/**
 * Mihomo 运行时 API 服务 — 对接后端 /api/mihomo/*
 * 对应 Clash Verge Rev 的 tauri-plugin-mihomo-api
 */
export class MihomoService {
  // ========== 状态 ==========

  async getStatus(): Promise<ApiResponse<MihomoStatus>> {
    const response = await apiClient.get<{ data: MihomoStatus }>('/mihomo/status');
    return { data: response.data?.data, error: response.error };
  }

  async getVersion(): Promise<ApiResponse<{ version: string }>> {
    const response = await apiClient.get<{ data: { version: string } }>('/mihomo/version');
    return { data: response.data?.data, error: response.error };
  }

  async getConfig(): Promise<ApiResponse<any>> {
    const response = await apiClient.get<{ data: any }>('/mihomo/config');
    return { data: response.data?.data, error: response.error };
  }

  async patchConfig(config: Partial<any>): Promise<ApiResponse<void>> {
    const response = await apiClient.patch<{ data: void }>('/mihomo/config', config);
    return { data: response.data?.data, error: response.error };
  }

  // ========== 代理 ==========

  async getProxies(): Promise<ApiResponse<{ proxies: Record<string, MihomoProxy | MihomoGroup> }>> {
    const response = await apiClient.get<{ data: { proxies: Record<string, MihomoProxy | MihomoGroup> } }>('/mihomo/proxies');
    return { data: response.data?.data, error: response.error };
  }

  async getProxy(name: string): Promise<ApiResponse<MihomoProxy | MihomoGroup>> {
    const response = await apiClient.get<{ data: MihomoProxy | MihomoGroup }>(`/mihomo/proxies/${encodeURIComponent(name)}`);
    return { data: response.data?.data, error: response.error };
  }

  // 切换代理组中的节点
  async selectProxy(group: string, proxy: string): Promise<ApiResponse<void>> {
    const response = await apiClient.put<{ error?: string }>(`/mihomo/proxies/${encodeURIComponent(group)}`, { name: proxy });
    return { data: undefined, error: response.error || response.data?.error };
  }

  // 测试代理延迟
  async testProxy(name: string, url?: string, timeout?: number): Promise<ApiResponse<{ delay: number }>> {
    const params = new URLSearchParams();
    if (url) params.set('url', url);
    if (timeout) params.set('timeout', String(timeout));
    const response = await apiClient.get<{ data: { delay: number } }>(
      `/mihomo/proxies/${encodeURIComponent(name)}/delay?${params}`
    );
    return { data: response.data?.data, error: response.error };
  }

  // 测试代理组所有节点
  async testGroup(name: string, url?: string, timeout?: number): Promise<ApiResponse<Record<string, number>>> {
    const params = new URLSearchParams();
    if (url) params.set('url', url);
    if (timeout) params.set('timeout', String(timeout));
    const response = await apiClient.get<{ data: Record<string, number> }>(
      `/mihomo/group/${encodeURIComponent(name)}/delay?${params}`
    );
    return { data: response.data?.data, error: response.error };
  }

  // ========== 规则 ==========

  async getRules(): Promise<ApiResponse<{ rules: MihomoRule[] }>> {
    const response = await apiClient.get<{ data: { rules: MihomoRule[] } }>('/mihomo/rules');
    return { data: response.data?.data, error: response.error };
  }

  // ========== 连接 ==========

  async getConnections(): Promise<ApiResponse<{ connections: MihomoConnection[]; downloadTotal: number; uploadTotal: number }>> {
    const response = await apiClient.get<{ data: { connections: MihomoConnection[]; downloadTotal: number; uploadTotal: number } }>('/mihomo/connections');
    return { data: response.data?.data, error: response.error };
  }

  async closeConnection(id: string): Promise<ApiResponse<void>> {
    const response = await apiClient.delete<{ error?: string }>(`/mihomo/connections/${id}`);
    return { data: undefined, error: response.error || response.data?.error };
  }

  async closeAllConnections(): Promise<ApiResponse<void>> {
    const response = await apiClient.delete<{ error?: string }>('/mihomo/connections');
    return { data: undefined, error: response.error || response.data?.error };
  }

  // ========== 提供者 ==========

  async getProxyProviders(): Promise<ApiResponse<{ providers: Record<string, MihomoProvider> }>> {
    const response = await apiClient.get<{ data: { providers: Record<string, MihomoProvider> } }>('/mihomo/providers');
    return { data: response.data?.data, error: response.error };
  }

  async updateProxyProvider(name: string): Promise<ApiResponse<void>> {
    const response = await apiClient.put<{ error?: string }>(`/mihomo/providers/${encodeURIComponent(name)}`, {});
    return { data: undefined, error: response.error || response.data?.error };
  }

  async getRuleProviders(): Promise<ApiResponse<{ providers: Record<string, MihomoProvider> }>> {
    const response = await apiClient.get<{ data: { providers: Record<string, MihomoProvider> } }>('/mihomo/rule-providers');
    return { data: response.data?.data, error: response.error };
  }

  // ========== 内存 ==========

  async getMemory(): Promise<ApiResponse<{ inuse: number; oslimit: number }>> {
    const response = await apiClient.get<{ data: { inuse: number; oslimit: number } }>('/mihomo/memory');
    return { data: response.data?.data, error: response.error };
  }
}

export const mihomoService = new MihomoService();
