import type { ApiResponse } from '../types';
import { apiClient } from '../api/apiClient';

// 订阅接口
export interface Subscription {
  id: number;
  name: string;
  url: string;
  userAgent: string;
  autoUpdate: boolean;
  updateInterval: number;
  status: 'pending' | 'active' | 'error';
  proxyCount: number;
  lastUpdate: string | null;
  lastError: string | null;
  createdAt: string;
}

// 订阅预览
export interface SubscriptionPreview {
  proxyCount: number;
  groupCount: number;
  proxies: Array<{ name: string; type: string; server: string; port: number }>;
  groups: Array<{ name: string; type: string; proxies: string[] }>;
}

/**
 * 订阅管理服务 — 对接后端 /api/clash/subscriptions
 */
export class SubscriptionService {
  // 获取订阅列表
  async getSubscriptions(): Promise<ApiResponse<Subscription[]>> {
    const response = await apiClient.get<{ data: Subscription[]; total: number }>('/clash/subscriptions');
    return { data: response.data?.data || [], error: response.error };
  }

  // 创建订阅（自动导入）
  async createSubscription(params: {
    name: string;
    url: string;
    userAgent?: string;
    autoUpdate?: boolean;
    updateInterval?: number;
  }): Promise<ApiResponse<Subscription>> {
    const response = await apiClient.post<{ data: Subscription; message: string }>('/clash/subscriptions', params);
    return { data: response.data?.data, message: response.data?.message, error: response.error };
  }

  // 删除订阅
  async deleteSubscription(id: number): Promise<ApiResponse<void>> {
    const response = await apiClient.delete<{ message: string }>(`/clash/subscriptions/${id}`);
    return { data: undefined, message: response.data?.message, error: response.error };
  }

  // 手动更新订阅
  async updateSubscription(id: number): Promise<ApiResponse<Subscription>> {
    const response = await apiClient.post<{ data: Subscription; message: string }>(`/clash/subscriptions/${id}/update`, {});
    return { data: response.data?.data, message: response.data?.message, error: response.error };
  }

  // 更新订阅配置
  async patchSubscription(id: number, params: Partial<Subscription>): Promise<ApiResponse<Subscription>> {
    const response = await apiClient.put<{ data: Subscription; message: string }>(`/clash/subscriptions/${id}`, params);
    return { data: response.data?.data, message: response.data?.message, error: response.error };
  }

  // 预览订阅（不导入）
  async previewSubscription(url: string, userAgent?: string): Promise<ApiResponse<SubscriptionPreview>> {
    const response = await apiClient.post<{ data: SubscriptionPreview }>('/clash/subscriptions/preview', { url, userAgent });
    return { data: response.data?.data, error: response.error };
  }
}

export const subscriptionService = new SubscriptionService();
