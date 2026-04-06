import type { Tunnel, ApiResponse } from '../types';
import { apiClient } from '../api/apiClient';

// 隧道服务器配置接口
export interface TunnelServerConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  authToken: string;
  isSelfHosted: boolean;
  status: 'running' | 'stopped' | 'error';
  uptime?: string;
  version?: string;
}

// 网络接口信息
export interface NetworkInterfaceInfo {
  name: string;
  family: string;
  address: string;
  mac: string;
  internal: boolean;
}

/**
 * Bore 隧道服务类 — 全部对接真实后端 API
 */
export class BoreService {
  // ========== 隧道 CRUD ==========

  // 获取隧道列表
  async getTunnels(): Promise<ApiResponse<Tunnel[]>> {
    const response = await apiClient.get<{ data: Tunnel[]; total: number }>('/tunnel/list');
    return {
      data: response.data?.data || [],
      error: response.error,
    };
  }

  // 创建隧道
  async createTunnel(tunnel: Omit<Tunnel, 'id' | 'status'>): Promise<ApiResponse<Tunnel>> {
    const response = await apiClient.post<{ id: string; message: string }>('/tunnel/create', tunnel);
    if (response.error) {
      return { data: {} as Tunnel, error: response.error };
    }
    const newTunnel: Tunnel = {
      ...tunnel,
      id: response.data?.id || '',
      status: 'stopped',
    };
    return {
      data: newTunnel,
      message: response.data?.message || 'Tunnel created successfully',
    };
  }

  // 删除隧道
  async deleteTunnel(id: string): Promise<ApiResponse<void>> {
    const response = await apiClient.delete<{ message: string }>(`/tunnel/delete?id=${id}`);
    return {
      data: undefined,
      message: response.data?.message || 'Tunnel deleted successfully',
      error: response.error,
    };
  }

  // 启动隧道（实际启动 bore 进程）
  async startTunnel(id: string): Promise<ApiResponse<void>> {
    const response = await apiClient.post<{ message: string }>('/tunnel/start', { id });
    return {
      data: undefined,
      message: response.data?.message,
      error: response.error,
    };
  }

  // 停止隧道（实际停止 bore 进程）
  async stopTunnel(id: string): Promise<ApiResponse<void>> {
    const response = await apiClient.post<{ message: string }>('/tunnel/stop', { id });
    return {
      data: undefined,
      message: response.data?.message,
      error: response.error,
    };
  }

  // ========== 隧道状态 ==========

  // 获取隧道状态
  async getTunnelStatus(id: string): Promise<ApiResponse<{ status: string; details: any }>> {
    const tunnels = await this.getTunnels();
    const tunnel = (tunnels.data || []).find(t => t.id === id);
    if (tunnel) {
      return {
        data: {
          status: tunnel.status,
          details: {
            localPort: tunnel.localPort,
            remoteServer: tunnel.remoteServer,
            remotePort: tunnel.remotePort,
          },
        },
      };
    }
    return { data: { status: 'not_found', details: {} }, error: 'Tunnel not found' };
  }

  // 生成隧道配置
  async generateTunnelConfig(tunnel: Tunnel): Promise<ApiResponse<{ config: string }>> {
    const config = `# Bore Tunnel Configuration
name: ${tunnel.name}
localPort: ${tunnel.localPort}
remoteServer: ${tunnel.remoteServer}
remotePort: ${tunnel.remotePort}
`;
    return { data: { config } };
  }

  // ========== 网络监控（通过后端 API） ==========

  // 获取网络状态
  async getNetworkStatus(): Promise<ApiResponse<any>> {
    const response = await apiClient.get<{ data: any }>('/network/status');
    return {
      data: response.data?.data,
      error: response.error,
    };
  }

  // 获取网络接口列表
  async getNetworkInterfaces(): Promise<ApiResponse<NetworkInterfaceInfo[]>> {
    const response = await apiClient.get<{ data: NetworkInterfaceInfo[] }>('/network/interfaces');
    return {
      data: response.data?.data || [],
      error: response.error,
    };
  }

  // 测试网络连接 (ping)
  async testConnection(host: string = '8.8.8.8'): Promise<ApiResponse<{ ping: number; status: number; loss: number }>> {
    const response = await apiClient.post<{ data: any }>('/network/ping', { host, count: 4 });
    const d = response.data?.data;
    return {
      data: {
        ping: d?.rtt?.avg || 0,
        status: d?.loss < 100 ? 200 : 0,
        loss: d?.loss ?? 100,
      },
      error: response.error,
    };
  }

  // HTTP 连接测试
  async testHttpConnection(url: string = 'https://www.baidu.com'): Promise<ApiResponse<any>> {
    const response = await apiClient.post<{ data: any }>('/network/http-test', { url });
    return {
      data: response.data?.data,
      error: response.error,
    };
  }

  // 获取流量统计
  async getTrafficStats(): Promise<ApiResponse<any>> {
    const response = await apiClient.get<{ data: any }>('/network/traffic');
    return {
      data: response.data?.data,
      error: response.error,
    };
  }

  // 获取连接数
  async getConnections(): Promise<ApiResponse<any>> {
    const response = await apiClient.get<{ data: any }>('/network/connections');
    return {
      data: response.data?.data,
      error: response.error,
    };
  }

  // 重置流量统计（当前为服务端只读，不支持重置）
  resetTrafficStats(): ApiResponse<boolean> {
    return { data: true, message: 'Traffic stats are read from OS counters and cannot be reset' };
  }

  // ========== 网络状态监控（前端定时轮询） ==========

  private listeners: Set<(status: any) => void> = new Set();
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private lastStatus: any = null;

  startNetworkMonitoring(interval: number = 5000): void {
    this.stopNetworkMonitoring();
    this.intervalId = setInterval(async () => {
      const resp = await this.getNetworkStatus();
      if (resp.data) {
        this.lastStatus = resp.data;
        this.listeners.forEach(listener => listener(resp.data));
      }
    }, interval);
  }

  stopNetworkMonitoring(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  addNetworkStatusListener(listener: (status: any) => void): void {
    this.listeners.add(listener);
    if (this.lastStatus) listener(this.lastStatus);
  }

  removeNetworkStatusListener(listener: (status: any) => void): void {
    this.listeners.delete(listener);
  }

  // ========== 隧道服务器管理（对接后端 API） ==========

  // 获取隧道服务器列表
  async getTunnelServers(): Promise<ApiResponse<TunnelServerConfig[]>> {
    const response = await apiClient.get<{ data: any[]; total: number }>('/tunnel-servers');
    if (response.error) {
      return { data: [], error: response.error };
    }
    const servers: TunnelServerConfig[] = (response.data?.data || []).map((s: any) => ({
      id: String(s.id),
      name: s.name,
      host: s.host,
      port: s.port,
      authToken: s.secret || '',
      isSelfHosted: true,
      status: s.running ? 'running' : s.status,
    }));
    return { data: servers };
  }

  // 创建隧道服务器
  async addTunnelServer(server: Omit<TunnelServerConfig, 'id' | 'status' | 'uptime' | 'version'>): Promise<ApiResponse<TunnelServerConfig>> {
    const response = await apiClient.post<{ data: any; message: string }>('/tunnel-servers', {
      name: server.name,
      host: server.host,
      port: server.port,
      secret: server.authToken || null,
    });
    if (response.error) {
      return { data: {} as TunnelServerConfig, error: response.error };
    }
    const s = response.data?.data;
    return {
      data: {
        id: String(s.id),
        name: s.name,
        host: s.host,
        port: s.port,
        authToken: s.secret || '',
        isSelfHosted: true,
        status: s.status,
      },
      message: response.data?.message,
    };
  }

  // 删除隧道服务器
  async deleteTunnelServer(id: string): Promise<ApiResponse<void>> {
    const response = await apiClient.delete<{ message: string }>(`/tunnel-servers/${id}`);
    return {
      data: undefined,
      message: response.data?.message,
      error: response.error,
    };
  }

  // 启动隧道服务器
  async startTunnelServer(id: string): Promise<ApiResponse<void>> {
    const response = await apiClient.post<{ message: string }>(`/tunnel-servers/${id}/start`, {});
    return {
      data: undefined,
      message: response.data?.message,
      error: response.error,
    };
  }

  // 停止隧道服务器
  async stopTunnelServer(id: string): Promise<ApiResponse<void>> {
    const response = await apiClient.post<{ message: string }>(`/tunnel-servers/${id}/stop`, {});
    return {
      data: undefined,
      message: response.data?.message,
      error: response.error,
    };
  }

  // 获取隧道服务器状态
  async getTunnelServerStatus(id: string): Promise<ApiResponse<TunnelServerConfig>> {
    const response = await apiClient.get<{ data: any }>(`/tunnel-servers/${id}`);
    if (response.error) {
      return { data: {} as TunnelServerConfig, error: response.error };
    }
    const s = response.data?.data;
    return {
      data: {
        id: String(s.id),
        name: s.name,
        host: s.host,
        port: s.port,
        authToken: s.secret || '',
        isSelfHosted: true,
        status: s.running ? 'running' : s.status,
      },
    };
  }

  // 测试隧道服务器连接
  async testTunnelServerConnection(host: string, _port: number, _authToken: string): Promise<ApiResponse<{ status: string; latency: number }>> {
    const pingResp = await this.testConnection(host);
    return {
      data: {
        status: pingResp.data?.status === 200 ? 'success' : 'error',
        latency: pingResp.data?.ping || 0,
      },
    };
  }

  // 生成隧道服务器配置
  async generateTunnelServerConfig(server: Omit<TunnelServerConfig, 'id' | 'status' | 'uptime' | 'version'>): Promise<ApiResponse<{ config: string }>> {
    const config = `# Bore Server Configuration
name: ${server.name}
host: ${server.host}
port: ${server.port}
secret: ${server.authToken}
`;
    return { data: { config } };
  }
}

// 导出 Bore 服务实例
export const boreService = new BoreService();
