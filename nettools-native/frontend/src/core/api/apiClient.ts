import type { ApiResponse } from '../types';
import { configService } from '../config/configService';

// API基础URL — 使用相对路径，由 nginx 反向代理到后端
// 开发模式下可通过 VITE_API_URL 环境变量覆盖
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// API客户端类
export class ApiClient {
  // 获取认证令牌
  private getAuthToken(): string | null {
    return configService.getAuthToken();
  }

  // 通用请求方法
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    try {
      const authToken = this.getAuthToken();
      
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(authToken && { 'Authorization': `Bearer ${authToken}` }),
          ...options.headers,
        },
      });

      // 解析响应数据
      let data;
      try {
        data = await response.json();
      } catch (e) {
        data = null;
      }

      if (!response.ok) {
        // 处理401错误（未授权）
        if (response.status === 401) {
          // 清除认证令牌
          configService.clearAuthToken();
          // 可以在这里添加重新登录的逻辑
          console.error('Unauthorized, please login again');
        }
        
        // 处理其他错误
        const errorMessage = data?.error || `HTTP error! status: ${response.status}`;
        return {
          data: undefined as T,
          error: errorMessage,
        };
      }

      return {
        data: data as T,
        error: undefined,
      };
    } catch (error) {
      console.error('API request failed:', error);
      // 处理网络错误等
      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
          errorMessage = 'Network error: Please check your internet connection';
        } else {
          errorMessage = error.message;
        }
      }
      return {
        data: undefined as T,
        error: errorMessage,
      };
    }
  }

  // GET请求
  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'GET',
    });
  }

  // POST请求
  async post<T>(endpoint: string, body: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  // PUT请求
  async put<T>(endpoint: string, body: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  // DELETE请求
  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
    });
  }

  // 登录
  async login(username: string, password: string, rememberMe: boolean = false, captcha: string = ''): Promise<ApiResponse<{ token: string; user: any }>> {
    return this.request<{ token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password, rememberMe, captcha }),
    });
  }

  // 获取验证码
  async getCaptcha(): Promise<ApiResponse<Blob | undefined>> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/captcha`);
      if (!response.ok) {
        return {
          data: undefined,
          error: `HTTP error! status: ${response.status}`,
        };
      }
      const blob = await response.blob();
      return {
        data: blob,
        error: undefined,
      };
    } catch (error) {
      console.error('Get captcha failed:', error);
      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      return {
        data: undefined,
        error: errorMessage,
      };
    }
  }

  // 注册
  async register(username: string, password: string): Promise<ApiResponse<{ token: string; user: any }>> {
    return this.request<{ token: string; user: any }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  }

  // 注销
  async logout(): Promise<ApiResponse<void>> {
    return this.request<void>('/auth/logout', {
      method: 'POST',
    });
  }
}

// 导出API客户端实例
export const apiClient = new ApiClient();
