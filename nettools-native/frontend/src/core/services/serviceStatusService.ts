import type { ApiResponse } from '../types';
import { apiClient } from '../api/apiClient';

// 服务状态接口
export interface ServiceStatus {
  id: string;
  name: string;
  type: 'tunnel' | 'vpn' | 'proxy' | 'storage';
  status: 'running' | 'stopped' | 'starting' | 'stopping' | 'error';
  uptime?: string;
  cpuUsage?: number;
  memoryUsage?: number;
  networkIn?: number;
  networkOut?: number;
  lastChecked?: string;
  error?: string;
}

/**
 * 服务状态管理服务类 — 全部通过后端 API 实现
 */
export class ServiceStatusService {
  private listeners: Set<(status: ServiceStatus[]) => void> = new Set();
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private statuses: ServiceStatus[] = [];

  // 开始监控
  startMonitoring(interval: number = 5000): void {
    this.stopMonitoring();
    this.intervalId = setInterval(async () => {
      const statuses = await this.getAllServiceStatuses();
      this.statuses = statuses.data || [];
      this.listeners.forEach(listener => listener(this.statuses));
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
  addListener(listener: (status: ServiceStatus[]) => void): void {
    this.listeners.add(listener);
    if (this.statuses.length > 0) listener(this.statuses);
  }

  // 移除状态变化监听器
  removeListener(listener: (status: ServiceStatus[]) => void): void {
    this.listeners.delete(listener);
  }

  // 获取所有服务状态
  async getAllServiceStatuses(): Promise<ApiResponse<ServiceStatus[]>> {
    const response = await apiClient.get<{ data: ServiceStatus[]; total: number }>('/services/status');
    return {
      data: response.data?.data || [],
      error: response.error,
    };
  }

  // 获取单个服务状态
  async getServiceStatus(id: string): Promise<ApiResponse<ServiceStatus>> {
    const response = await apiClient.get<{ data: ServiceStatus }>(`/services/status/${id}`);
    return {
      data: response.data?.data,
      error: response.error,
    };
  }

  // 启动服务 (通过类型路由到对应 API)
  async startService(id: string): Promise<ApiResponse<void>> {
    // 根据 id 前缀路由到正确的 API
    if (id.startsWith('tunnel-server-')) {
      const realId = id.replace('tunnel-server-', '');
      const resp = await apiClient.post<{ message: string }>(`/tunnel-servers/${realId}/start`, {});
      return { data: undefined, message: resp.data?.message, error: resp.error };
    }
    if (id.startsWith('clash')) {
      const resp = await apiClient.post<{ message: string }>('/clash/start', {});
      return { data: undefined, message: resp.data?.message, error: resp.error };
    }
    return { data: undefined, error: `Unknown service type for id: ${id}` };
  }

  // 停止服务
  async stopService(id: string): Promise<ApiResponse<void>> {
    if (id.startsWith('tunnel-server-')) {
      const realId = id.replace('tunnel-server-', '');
      const resp = await apiClient.post<{ message: string }>(`/tunnel-servers/${realId}/stop`, {});
      return { data: undefined, message: resp.data?.message, error: resp.error };
    }
    if (id.startsWith('clash')) {
      const resp = await apiClient.post<{ message: string }>('/clash/stop', {});
      return { data: undefined, message: resp.data?.message, error: resp.error };
    }
    return { data: undefined, error: `Unknown service type for id: ${id}` };
  }

  // 重启服务
  async restartService(id: string): Promise<ApiResponse<void>> {
    if (id.startsWith('tunnel-server-')) {
      const realId = id.replace('tunnel-server-', '');
      await this.stopService(id);
      const resp = await apiClient.post<{ message: string }>(`/tunnel-servers/${realId}/start`, {});
      return { data: undefined, message: resp.data?.message, error: resp.error };
    }
    if (id.startsWith('clash')) {
      const resp = await apiClient.post<{ message: string }>('/clash/restart', {});
      return { data: undefined, message: resp.data?.message, error: resp.error };
    }
    return { data: undefined, error: `Unknown service type for id: ${id}` };
  }

  // 获取服务统计信息
  async getServiceStatistics(id: string, period: 'hour' | 'day' | 'week' | 'month' = 'hour'): Promise<ApiResponse<{
    cpuUsage: number[];
    memoryUsage: number[];
    networkIn: number[];
    networkOut: number[];
    timestamps: string[];
  }>> {
    const response = await apiClient.get<{ data: any }>(`/services/${id}/statistics?period=${period}`);
    return {
      data: response.data?.data || { cpuUsage: [], memoryUsage: [], networkIn: [], networkOut: [], timestamps: [] },
      error: response.error,
    };
  }

  // 获取服务日志
  async getServiceLogs(id: string, lines: number = 100): Promise<ApiResponse<{ logs: string[] }>> {
    const response = await apiClient.get<{ data: { logs: string[] } }>(`/services/${id}/logs?lines=${lines}`);
    return {
      data: response.data?.data || { logs: [] },
      error: response.error,
    };
  }

  // 获取服务健康状态
  async getServiceHealth(_id: string): Promise<ApiResponse<{
    status: 'healthy' | 'unhealthy' | 'unknown';
    checks: Array<{ name: string; status: 'pass' | 'fail'; message: string }>;
  }>> {
    const response = await apiClient.get<{ data: { status: string; checks: Array<{ name: string; status: string; message: string }> } }>('/system/health');
    if (response.error) {
      return { data: { status: 'unknown', checks: [] }, error: response.error };
    }
    const d = response.data?.data;
    return {
      data: {
        status: (d?.status as 'healthy' | 'unhealthy' | 'unknown') || 'unknown',
        checks: (d?.checks || []).map(c => ({
          name: c.name,
          status: (c.status as 'pass' | 'fail') || 'fail',
          message: c.message,
        })),
      },
    };
  }
}

// 导出服务状态管理服务实例
export const serviceStatusService = new ServiceStatusService();
