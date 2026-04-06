import type { Tunnel, Proxy, ApiResponse } from '../types';
import { apiClient } from '../api/apiClient';

// 隧道服务类
export class TunnelService {
  async list(): Promise<ApiResponse<Tunnel[]>> {
    return apiClient.get('/tunnel/list');
  }

  async create(tunnel: Omit<Tunnel, 'id' | 'status'>): Promise<ApiResponse<Tunnel>> {
    return apiClient.post('/tunnel/create', tunnel);
  }

  async delete(id: string): Promise<ApiResponse<void>> {
    return apiClient.delete(`/tunnel/delete?id=${id}`);
  }

  async start(id: string): Promise<ApiResponse<void>> {
    return apiClient.post('/tunnel/start', { id });
  }

  async stop(id: string): Promise<ApiResponse<void>> {
    return apiClient.post('/tunnel/stop', { id });
  }
}

// 代理服务类
export class ProxyService {
  async list(): Promise<ApiResponse<Proxy[]>> {
    return apiClient.get('/proxy/list');
  }

  async create(proxy: Omit<Proxy, 'id' | 'status'>): Promise<ApiResponse<Proxy>> {
    return apiClient.post('/proxy/create', proxy);
  }

  async delete(id: string): Promise<ApiResponse<void>> {
    return apiClient.delete(`/proxy/delete?id=${id}`);
  }

  async connect(id: string): Promise<ApiResponse<void>> {
    return apiClient.post('/proxy/connect', { id });
  }

  async disconnect(id: string): Promise<ApiResponse<void>> {
    return apiClient.post('/proxy/disconnect', { id });
  }
}

// 导出服务实例
export const tunnelService = new TunnelService();
export const proxyService = new ProxyService();
