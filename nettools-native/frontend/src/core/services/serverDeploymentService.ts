import type { ApiResponse } from '../types';
import { apiClient } from '../api/apiClient';

// 服务器部署配置接口
export interface ServerDeploymentConfig {
  id: string;
  name: string;
  type: 'tunnel' | 'vpn';
  provider: 'aws' | 'gcp' | 'azure' | 'digitalocean' | 'vultr' | 'custom';
  region: string;
  instanceType: string;
  sshKey: string;
  domain?: string;
  port: number;
  authToken: string;
  status: 'deploying' | 'running' | 'stopped' | 'error';
  ipAddress?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * 服务器部署服务类 — 全部通过后端 API 实现
 */
export class ServerDeploymentService {
  // 获取服务器部署列表
  async getServerDeployments(): Promise<ApiResponse<ServerDeploymentConfig[]>> {
    const response = await apiClient.get<{ data: ServerDeploymentConfig[]; total: number }>('/deployments');
    return {
      data: response.data?.data || [],
      error: response.error,
    };
  }

  // 创建服务器部署
  async createServerDeployment(deployment: Omit<ServerDeploymentConfig, 'id' | 'status' | 'ipAddress' | 'createdAt' | 'updatedAt'>): Promise<ApiResponse<ServerDeploymentConfig>> {
    const response = await apiClient.post<{ data: ServerDeploymentConfig; message: string }>('/deployments', deployment);
    return {
      data: response.data?.data,
      message: response.data?.message,
      error: response.error,
    };
  }

  // 删除服务器部署
  async deleteServerDeployment(id: string): Promise<ApiResponse<void>> {
    const response = await apiClient.delete<{ message: string }>(`/deployments/${id}`);
    return {
      data: undefined,
      message: response.data?.message,
      error: response.error,
    };
  }

  // 启动服务器部署
  async startServerDeployment(id: string): Promise<ApiResponse<void>> {
    const response = await apiClient.post<{ message: string }>(`/deployments/${id}/start`, {});
    return {
      data: undefined,
      message: response.data?.message,
      error: response.error,
    };
  }

  // 停止服务器部署
  async stopServerDeployment(id: string): Promise<ApiResponse<void>> {
    const response = await apiClient.post<{ message: string }>(`/deployments/${id}/stop`, {});
    return {
      data: undefined,
      message: response.data?.message,
      error: response.error,
    };
  }

  // 获取服务器部署状态
  async getServerDeploymentStatus(id: string): Promise<ApiResponse<ServerDeploymentConfig>> {
    const response = await apiClient.get<{ data: ServerDeploymentConfig }>(`/deployments/${id}`);
    return {
      data: response.data?.data,
      error: response.error,
    };
  }

  // 获取可用云服务提供商
  async getAvailableProviders(): Promise<ApiResponse<Array<{ name: string; regions: string[] }>>> {
    const response = await apiClient.get<{ data: Array<{ name: string; regions: string[] }> }>('/deployments/providers');
    return {
      data: response.data?.data || [],
      error: response.error,
    };
  }

  // 获取可用实例类型
  async getAvailableInstanceTypes(provider: string): Promise<ApiResponse<string[]>> {
    const response = await apiClient.get<{ data: string[] }>(`/deployments/instance-types/${provider}`);
    return {
      data: response.data?.data || [],
      error: response.error,
    };
  }

  // 生成服务器部署配置
  async generateServerDeploymentConfig(deployment: Omit<ServerDeploymentConfig, 'id' | 'status' | 'ipAddress' | 'createdAt' | 'updatedAt'>): Promise<ApiResponse<{ config: string }>> {
    const config = `# ${deployment.type.charAt(0).toUpperCase() + deployment.type.slice(1)} Server Deployment Configuration\nname: ${deployment.name}\ntype: ${deployment.type}\nprovider: ${deployment.provider}\nregion: ${deployment.region}\ninstanceType: ${deployment.instanceType}\nport: ${deployment.port}\nauthToken: ${deployment.authToken}\n${deployment.domain ? `domain: ${deployment.domain}` : ''}`;
    return { data: { config }, message: 'Server deployment config generated' };
  }

  // 测试服务器连接
  async testServerConnection(_ipAddress: string, _port: number, _authToken: string): Promise<ApiResponse<{ status: string; latency: number }>> {
    // 测试需要通过具体部署 ID，直接返回需要 ID
    return { data: { status: 'error', latency: 0 }, error: 'Use deployment ID to test connection' };
  }
}

// 导出服务器部署服务实例
export const serverDeploymentService = new ServerDeploymentService();
