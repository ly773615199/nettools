// 存储服务类型
export interface StorageService {
  id: string;
  name: string;
  type: string;
  status: 'online' | 'offline';
  config: Record<string, any>;
}

// 隧道服务类型
export interface Tunnel {
  id: string;
  name: string;
  localPort: string;
  remoteServer: string;
  remotePort: string;
  status: 'running' | 'stopped';
}

// 代理服务类型
export interface Proxy {
  id: string;
  name: string;
  type: string;
  server: string;
  port: string;
  status: 'connected' | 'disconnected';
  config: Record<string, any>;
}

// 配置类型
export interface AppConfig {
  storage: StorageService[];
  tunnels: Tunnel[];
  proxies: Proxy[];
  system: {
    language: string;
    theme: 'light' | 'dark';
    autoStart: boolean;
  };
  auth?: {
    token: string;
    user: any;
  };
}

// API响应类型
export interface ApiResponse<T> {
  data: T;
  message?: string;
  error?: string;
}
