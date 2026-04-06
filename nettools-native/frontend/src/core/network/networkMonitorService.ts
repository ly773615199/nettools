import type { ApiResponse } from '../types';
import { apiClient } from '../api/apiClient';

// 网络状态
export interface NetworkStatus {
  isOnline: boolean;
  hostname: string;
  platform: string;
  arch: string;
  primaryInterface: string;
  primaryAddress: string;
  primaryMac: string;
  interfaces: NetworkInterface[];
  connections: number;
  loadAvg: { '1min': number; '5min': number; '15min': number };
  memory: { total: number; free: number; used: number; usagePercent: string };
  uptime: number;
  timestamp: number;
}

// 网络接口信息
export interface NetworkInterface {
  name: string;
  family: string;
  address: string;
  netmask: string;
  mac: string;
  internal: boolean;
  cidr: string;
}

// 流量统计
export interface TrafficStats {
  [iface: string]: {
    rxBytes: number;
    rxPackets: number;
    rxErrors: number;
    rxDropped: number;
    txBytes: number;
    txPackets: number;
    txErrors: number;
    txDropped: number;
  };
}

/**
 * 网络状态监控服务类 — 对接真实后端 API
 */
export class NetworkMonitorService {
  private listeners: Set<(status: NetworkStatus) => void> = new Set();
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private lastStatus: NetworkStatus | null = null;

  // 开始监控
  startMonitoring(interval: number = 5000): void {
    this.stopMonitoring();

    this.intervalId = setInterval(async () => {
      const status = await this.getNetworkStatus();
      this.lastStatus = status;
      this.listeners.forEach(listener => {
        listener(status);
      });
    }, interval);
  }

  // 停止监控
  stopMonitoring(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  // 添加状态变化监听器
  addListener(listener: (status: NetworkStatus) => void): void {
    this.listeners.add(listener);
    if (this.lastStatus) {
      listener(this.lastStatus);
    }
  }

  // 移除状态变化监听器
  removeListener(listener: (status: NetworkStatus) => void): void {
    this.listeners.delete(listener);
  }

  // 获取网络状态（从后端 API）
  async getNetworkStatus(): Promise<NetworkStatus> {
    try {
      const response = await apiClient.get<{ data: NetworkStatus }>('/network/status');
      if (response.data?.data) {
        return response.data.data;
      }
    } catch (error) {
      console.error('Error getting network status:', error);
    }

    // 回退默认值
    return {
      isOnline: false,
      hostname: 'unknown',
      platform: 'unknown',
      arch: 'unknown',
      primaryInterface: 'unknown',
      primaryAddress: 'unknown',
      primaryMac: 'unknown',
      interfaces: [],
      connections: 0,
      loadAvg: { '1min': 0, '5min': 0, '15min': 0 },
      memory: { total: 0, free: 0, used: 0, usagePercent: '0' },
      uptime: 0,
      timestamp: Date.now(),
    };
  }

  // 获取网络接口列表
  async getNetworkInterfaces(): Promise<ApiResponse<NetworkInterface[]>> {
    const response = await apiClient.get<{ data: NetworkInterface[] }>('/network/interfaces');
    return {
      data: response.data?.data || [],
      error: response.error,
    };
  }

  // 获取流量统计
  async getTrafficStats(): Promise<ApiResponse<TrafficStats>> {
    const response = await apiClient.get<{ data: TrafficStats }>('/network/traffic');
    return {
      data: response.data?.data || {},
      error: response.error,
    };
  }

  // 获取连接数
  async getConnections(): Promise<ApiResponse<{ tcp: number; tcp6: number; udp: number; total: number }>> {
    const response = await apiClient.get<{ data: { tcp: number; tcp6: number; udp: number; total: number } }>('/network/connections');
    return {
      data: response.data?.data || { tcp: 0, tcp6: 0, udp: 0, total: 0 },
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
  async testHttp(url: string = 'https://www.baidu.com'): Promise<ApiResponse<{ url: string; status: number; latency: number; success: boolean }>> {
    const response = await apiClient.post<{ data: any }>('/network/http-test', { url });
    return {
      data: response.data?.data,
      error: response.error,
    };
  }

  // 重置流量统计（OS 级别只读）
  resetTrafficStats(): ApiResponse<boolean> {
    return {
      data: true,
      message: 'Traffic stats are read from OS counters and cannot be reset',
    };
  }
}

// 导出网络状态监控服务实例
export const networkMonitorService = new NetworkMonitorService();
