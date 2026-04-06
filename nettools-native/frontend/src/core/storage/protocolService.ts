import type { ApiResponse } from '../types';
import { apiClient } from '../api/apiClient';

// 协议类型
export type ProtocolType = 'http' | 'https' | 'ftp' | 'sftp' | 's3' | 'webdav' | 'smb';

// 协议配置接口
export interface ProtocolConfig {
  type: ProtocolType;
  host: string;
  port?: number;
  username?: string;
  password?: string;
  bucket?: string;
  region?: string;
  accessKey?: string;
  secretKey?: string;
}

/**
 * 协议服务类 — 文件操作通过后端存储 API 实现
 */
export class ProtocolService {
  // 根据URL获取协议类型
  getProtocolType(url: string): ProtocolType | 'unknown' {
    const protocol = url.split('://')[0].toLowerCase();
    switch (protocol) {
      case 'http': return 'http';
      case 'https': return 'https';
      case 'ftp': return 'ftp';
      case 'sftp': return 'sftp';
      case 's3': return 's3';
      case 'webdav': case 'dav': return 'webdav';
      case 'smb': return 'smb';
      default: return 'unknown';
    }
  }

  // 构建完整URL
  buildUrl(config: ProtocolConfig, path: string): string {
    let url = '';
    switch (config.type) {
      case 'http':
      case 'https':
        url = `${config.type}://${config.host}`;
        if (config.port) url += `:${config.port}`;
        break;
      case 'ftp':
      case 'sftp':
        if (config.username && config.password) {
          url = `${config.type}://${encodeURIComponent(config.username)}:${encodeURIComponent(config.password)}@${config.host}`;
        } else if (config.username) {
          url = `${config.type}://${encodeURIComponent(config.username)}@${config.host}`;
        } else {
          url = `${config.type}://${config.host}`;
        }
        if (config.port) url += `:${config.port}`;
        break;
      case 's3':
        url = `s3://${config.bucket}${path}`;
        return url;
      case 'webdav':
        url = `https://${config.host}`;
        if (config.port) url = `http://${config.host}:${config.port}`;
        break;
      case 'smb':
        url = `smb://${config.host}`;
        if (config.port) url += `:${config.port}`;
        break;
    }

    const normalizedPath = path && !path.startsWith('/') ? `/${path}` : path;
    url += normalizedPath;
    return url;
  }

  // 测试连接 — 通过后端存储驱动验证
  async testConnection(config: ProtocolConfig): Promise<ApiResponse<boolean>> {
    // 尝试通过后端 API 测试连接
    const driverId = this._configToDriverId(config);
    if (driverId) {
      const resp = await apiClient.get<{ data: any[] }>(`/storage/browse?driver=${encodeURIComponent(driverId)}&path=/`);
      if (!resp.error) {
        return { data: true, message: 'Connection test successful' };
      }
      return { data: false, error: resp.error };
    }
    return { data: false, error: 'Unsupported protocol type for API test' };
  }

  // 列出文件 — 通过后端存储 API
  async listFiles(config: ProtocolConfig, dirPath: string): Promise<ApiResponse<any[]>> {
    const driverId = this._configToDriverId(config);
    if (driverId) {
      const resp = await apiClient.get<{ data: any[]; total: number }>(
        `/storage/browse?driver=${encodeURIComponent(driverId)}&path=${encodeURIComponent(dirPath)}`
      );
      return {
        data: resp.data?.data || [],
        error: resp.error,
      };
    }
    return { data: [], error: 'Unsupported protocol type' };
  }

  // 上传文件 — 通过后端存储 API
  async uploadFile(config: ProtocolConfig, targetDir: string, file: File): Promise<ApiResponse<any>> {
    const driverId = this._configToDriverId(config);
    if (driverId) {
      try {
        const authToken = localStorage.getItem('authToken');
        const formData = new FormData();
        formData.append('file', file);
        formData.append('driver', driverId);
        formData.append('path', targetDir);

        const response = await fetch('/api/files/upload', {
          method: 'POST',
          headers: { ...(authToken && { 'Authorization': `Bearer ${authToken}` }) },
          body: formData,
        });
        const data = await response.json();
        if (!response.ok) return { data: undefined, error: data.error || 'Upload failed' };
        return { data: data.file, message: data.message };
      } catch (error) {
        return { data: undefined, error: error instanceof Error ? error.message : 'Upload failed' };
      }
    }
    return { data: undefined, error: 'Unsupported protocol type' };
  }

  // 下载文件 — 通过后端存储 API 读取
  async downloadFile(config: ProtocolConfig, filePath: string): Promise<ApiResponse<Blob>> {
    const driverId = this._configToDriverId(config);
    if (driverId) {
      try {
        const authToken = localStorage.getItem('authToken');
        const url = `/api/storage/read?driver=${encodeURIComponent(driverId)}&path=${encodeURIComponent(filePath)}`;
        const response = await fetch(url, {
          headers: { ...(authToken && { 'Authorization': `Bearer ${authToken}` }) },
        });
        if (!response.ok) {
          return { data: new Blob(), error: `HTTP error ${response.status}` };
        }
        const blob = await response.blob();
        return { data: blob };
      } catch (error) {
        return { data: new Blob(), error: error instanceof Error ? error.message : 'Download failed' };
      }
    }
    return { data: new Blob(), error: 'Unsupported protocol type' };
  }

  // 删除文件 — 通过后端存储 API
  async deleteFile(config: ProtocolConfig, filePath: string): Promise<ApiResponse<void>> {
    const driverId = this._configToDriverId(config);
    if (driverId) {
      const resp = await apiClient.delete<{ message: string }>(
        `/storage/remove?driver=${encodeURIComponent(driverId)}&path=${encodeURIComponent(filePath)}`
      );
      return { data: undefined, message: resp.data?.message, error: resp.error };
    }
    return { data: undefined, error: 'Unsupported protocol type' };
  }

  /** 将协议配置映射为后端存储驱动 ID */
  private _configToDriverId(config: ProtocolConfig): string | null {
    switch (config.type) {
      case 'ftp': return 'ftp';
      case 'sftp': return 'sftp';
      case 's3': return 's3';
      case 'webdav': return 'webdav';
      case 'smb': return 'smb';
      default: return null;
    }
  }
}

// 导出协议服务实例
export const protocolService = new ProtocolService();
