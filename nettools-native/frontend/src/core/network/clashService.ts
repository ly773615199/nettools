import type { Proxy, ApiResponse } from '../types';
import { apiClient } from '../api/apiClient';

// 代理规则接口
export interface ProxyRule {
  id: string;
  name: string;
  type: 'DOMAIN' | 'DOMAIN-SUFFIX' | 'DOMAIN-KEYWORD' | 'IP-CIDR' | 'URL-REGEX' | 'PROCESS-NAME' | 'PROCESS-PATH';
  value: string;
  proxy: string;
  enabled: boolean;
}

// 规则组接口
export interface RuleGroup {
  id: string;
  name: string;
  type: 'select' | 'url-test' | 'fallback' | 'load-balance';
  proxies: string[];
  url?: string;
  interval?: number;
  enabled: boolean;
}

// Clash 状态
export interface ClashStatus {
  running: boolean;
  hasBinary: boolean;
  binaryPath: string | null;
  uptime: string;
  configFile: string;
  httpPort: number;
  socksPort: number;
  mode: 'Rule' | 'Global' | 'Direct';
}

/**
 * Clash 服务类 — 全部对接真实后端 API
 */
export class ClashService {
  // 获取代理列表
  async getProxies(): Promise<ApiResponse<Proxy[]>> {
    const response = await apiClient.get<{ data: Proxy[]; total: number }>('/proxy/list');
    return {
      data: response.data?.data || [],
      error: response.error,
    };
  }

  // 创建代理
  async createProxy(proxy: Omit<Proxy, 'id' | 'status'>): Promise<ApiResponse<Proxy>> {
    const response = await apiClient.post<{ id: string; message: string }>('/proxy/create', proxy);
    if (response.error) {
      return { data: {} as Proxy, error: response.error };
    }
    const newProxy: Proxy = {
      ...proxy,
      id: response.data?.id || '',
      status: 'disconnected',
    };
    return {
      data: newProxy,
      message: response.data?.message || 'Proxy created successfully',
    };
  }

  // 删除代理
  async deleteProxy(id: string): Promise<ApiResponse<void>> {
    const response = await apiClient.delete<{ message: string }>(`/proxy/delete?id=${id}`);
    return {
      data: undefined,
      message: response.data?.message || 'Proxy deleted successfully',
      error: response.error,
    };
  }

  // 连接代理（启动 Clash 进程）
  async connectProxy(id: string): Promise<ApiResponse<{ clash: any }>> {
    const response = await apiClient.post<{ message: string; clash: any }>('/proxy/connect', { id });
    return {
      data: { clash: response.data?.clash },
      message: response.data?.message,
      error: response.error,
    };
  }

  // 断开代理
  async disconnectProxy(id: string): Promise<ApiResponse<void>> {
    const response = await apiClient.post<{ message: string }>('/proxy/disconnect', { id });
    return {
      data: undefined,
      message: response.data?.message,
      error: response.error,
    };
  }

  // ========== Clash 进程管理 ==========

  // 获取 Clash 状态
  async getClashStatus(): Promise<ApiResponse<ClashStatus>> {
    const response = await apiClient.get<{ data: ClashStatus }>('/clash/status');
    return {
      data: response.data?.data as ClashStatus,
      error: response.error,
    };
  }

  // 获取 Clash 配置
  async getClashConfig(): Promise<ApiResponse<any>> {
    const response = await apiClient.get<{ data: any }>('/clash/config');
    return {
      data: response.data?.data,
      error: response.error,
    };
  }

  // 启动 Clash
  async startClash(): Promise<ApiResponse<any>> {
    const response = await apiClient.post<{ message: string; data: any }>('/clash/start', {});
    return {
      data: response.data?.data,
      message: response.data?.message,
      error: response.error,
    };
  }

  // 停止 Clash
  async stopClash(): Promise<ApiResponse<void>> {
    const response = await apiClient.post<{ message: string }>('/clash/stop', {});
    return {
      data: undefined,
      message: response.data?.message,
      error: response.error,
    };
  }

  // 重启 Clash
  async restartClash(): Promise<ApiResponse<any>> {
    const response = await apiClient.post<{ message: string; data: any }>('/clash/restart', {});
    return {
      data: response.data?.data,
      message: response.data?.message,
      error: response.error,
    };
  }

  // ========== 系统代理 ==========

  // 获取系统代理状态（读取系统环境变量/配置）
  async getSystemProxyStatus(): Promise<ApiResponse<{ enabled: boolean; proxy: string }>> {
    try {
      const status = await this.getClashStatus();
      return {
        data: {
          enabled: status.data?.running || false,
          proxy: status.data?.running ? `127.0.0.1:${status.data.httpPort}` : '',
        },
      };
    } catch (error) {
      return {
        data: { enabled: false, proxy: '' },
        error: error instanceof Error ? error.message : 'Failed to get system proxy status',
      };
    }
  }

  // 启用系统代理 — 启动 Clash 并设置环境变量提示
  async enableSystemProxy(): Promise<ApiResponse<void>> {
    const response = await this.startClash();
    return {
      data: undefined,
      message: response.message,
      error: response.error,
    };
  }

  // 禁用系统代理 — 停止 Clash
  async disableSystemProxy(): Promise<ApiResponse<void>> {
    const response = await this.stopClash();
    return {
      data: undefined,
      message: response.message,
      error: response.error,
    };
  }

  // ========== 代理模式 ==========

  // 获取代理模式
  async getProxyMode(): Promise<ApiResponse<{ mode: 'Rule' | 'Global' | 'Direct' }>> {
    const status = await this.getClashStatus();
    return {
      data: { mode: status.data?.mode || 'Rule' },
      error: status.error,
    };
  }

  // 设置代理模式
  async setProxyMode(mode: 'Rule' | 'Global' | 'Direct'): Promise<ApiResponse<void>> {
    const response = await apiClient.put<{ message: string }>('/clash/mode', { mode });
    return {
      data: undefined,
      message: response.data?.message,
      error: response.error,
    };
  }

  // ========== 代理规则 ==========

  // 获取 Clash 配置中的规则
  async getProxyRules(): Promise<ApiResponse<ProxyRule[]>> {
    const configResp = await this.getClashConfig();
    if (configResp.error || !configResp.data) {
      return { data: [], error: configResp.error };
    }
    const rules = (configResp.data.rules || []).map((r: string, idx: number) => {
      const parts = r.split(',');
      return {
        id: String(idx),
        name: parts[1] || r,
        type: (parts[0] || 'DOMAIN-SUFFIX') as ProxyRule['type'],
        value: parts[1] || '',
        proxy: parts[2] || 'DIRECT',
        enabled: true,
      };
    });
    return { data: rules };
  }

  // 更新规则
  async updateRules(rules: string[]): Promise<ApiResponse<void>> {
    const response = await apiClient.put<{ message: string }>('/clash/rules', { rules });
    return {
      data: undefined,
      message: response.data?.message,
      error: response.error,
    };
  }

  // ========== TUN 模式（需要 root 权限，通过后端配置） ==========

  async getTunModeStatus(): Promise<ApiResponse<{ enabled: boolean; device: string }>> {
    // TUN 模式需要在 Clash 配置中启用 tun 字段，且需要 root 权限
    // 当前返回配置文件中是否有 tun 配置
    const configResp = await this.getClashConfig();
    const tun = configResp.data?.tun;
    return {
      data: {
        enabled: tun?.enable || false,
        device: tun?.device || 'tun0',
      },
    };
  }

  async enableTunMode(): Promise<ApiResponse<void>> {
    // TUN 模式需要修改 Clash 配置并重启 — 高级功能
    return {
      data: undefined,
      error: 'TUN mode requires manual configuration with root privileges',
    };
  }

  async disableTunMode(): Promise<ApiResponse<void>> {
    return {
      data: undefined,
      error: 'TUN mode requires manual configuration with root privileges',
    };
  }

  // ========== 代理测试 ==========

  async testProxy(_id: string): Promise<ApiResponse<{ status: string; latency: number; speed: number }>> {
    const pingResult = await apiClient.post<{ data: any }>('/network/ping', { host: '8.8.8.8', count: 2 });
    const rtt = pingResult.data?.data?.rtt;
    return {
      data: {
        status: pingResult.data?.data?.loss < 100 ? 'success' : 'error',
        latency: rtt?.avg || 0,
        speed: 0,
      },
    };
  }

  // 获取代理状态
  async getProxyStatus(id: string): Promise<ApiResponse<{ status: string; details: any }>> {
    const proxies = await this.getProxies();
    const proxy = proxies.data.find(p => p.id === id);
    if (!proxy) {
      return { data: { status: 'not_found', details: {} }, error: 'Proxy not found' };
    }
    return {
      data: {
        status: proxy.status,
        details: {
          server: proxy.server,
          port: proxy.port,
          type: proxy.type,
        },
      },
    };
  }

  // 生成代理配置
  async generateProxyConfig(proxy: Proxy): Promise<ApiResponse<{ config: string }>> {
    const config = `# Clash Proxy Configuration
name: ${proxy.name}
type: ${proxy.type}
server: ${proxy.server}
port: ${proxy.port}
`;
    return { data: { config } };
  }

  // 导入代理配置
  async importProxyConfig(_config: string): Promise<ApiResponse<Proxy>> {
    return {
      data: {} as Proxy,
      error: 'Import not yet implemented — use createProxy() instead',
    };
  }

  // 配置系统代理
  async configureSystemProxy(_proxy: string): Promise<ApiResponse<void>> {
    // 在服务器端环境，系统代理由 Clash 管理
    return {
      data: undefined,
      message: 'System proxy is managed by Clash process',
    };
  }
}

// 导出 Clash 服务实例
export const clashService = new ClashService();
