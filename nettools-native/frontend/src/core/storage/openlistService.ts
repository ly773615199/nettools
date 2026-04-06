import type { StorageService, ApiResponse } from '../types';
import { apiClient } from '../api/apiClient';
import type { FileEntry } from './storageService';

// OpenList 服务 — 纯后端 API 调用，不管理前端本地驱动
export class OpenListService {

  // ========== 存储管理 ==========

  /** 获取存储服务列表 */
  async getStorageServices(): Promise<ApiResponse<StorageService[]>> {
    const response = await apiClient.get<{ data: StorageService[]; total: number }>('/storages');
    // 兼容：如果 storages 路由不可用，回退到 drivers 列表
    if (response.error) {
      const fallback = await apiClient.get<{ data: any[]; total: number }>('/drivers');
      return {
        data: (fallback.data?.data || []).map((d: any) => ({
          id: d.id,
          name: d.name,
          type: d.type,
          config: {},
          status: 'online' as const,
        })),
        error: fallback.error,
      };
    }
    return {
      data: response.data?.data || [],
      error: response.error,
    };
  }

  /** 添加存储服务 */
  async addStorageService(service: Omit<StorageService, 'id' | 'status'>): Promise<ApiResponse<StorageService>> {
    const response = await apiClient.post<{ id: string; message: string }>('/storages', {
      name: service.name,
      type: service.type,
      config: service.config,
    });
    return {
      data: {
        ...service,
        id: response.data?.id || '',
        status: 'offline',
      },
      message: response.data?.message,
      error: response.error,
    };
  }

  /** 删除存储服务 */
  async deleteStorageService(id: string): Promise<ApiResponse<void>> {
    const response = await apiClient.delete<{ message: string }>(`/storages/${id}`);
    return { data: undefined, message: response.data?.message, error: response.error };
  }

  /** 启用存储服务 */
  async enableStorageService(id: string): Promise<ApiResponse<void>> {
    const response = await apiClient.post<{ message: string }>(`/storages/${id}/enable`, {});
    return { data: undefined, message: response.data?.message, error: response.error };
  }

  /** 禁用存储服务 */
  async disableStorageService(id: string): Promise<ApiResponse<void>> {
    const response = await apiClient.post<{ message: string }>(`/storages/${id}/disable`, {});
    return { data: undefined, message: response.data?.message, error: response.error };
  }

  // ========== 文件操作（全部走后端 API） ==========

  /** 列出文件 */
  async listFiles(driverId: string, dirPath: string): Promise<ApiResponse<FileEntry[]>> {
    const response = await apiClient.get<{ data: FileEntry[]; total: number }>(
      `/storages/${encodeURIComponent(driverId)}/browse?path=${encodeURIComponent(dirPath)}`
    );
    return {
      data: response.data?.data || [],
      error: response.error,
    };
  }

  /** 读取文件内容 */
  async readFile(driverId: string, filePath: string): Promise<ApiResponse<{ content: string; meta: any }>> {
    const response = await apiClient.get<{ data: string; meta: any }>(
      `/storages/${encodeURIComponent(driverId)}/read?path=${encodeURIComponent(filePath)}`
    );
    return {
      data: { content: response.data?.data || '', meta: response.data?.meta },
      error: response.error,
    };
  }

  /** 写入文件 */
  async writeFile(driverId: string, filePath: string, content: string): Promise<ApiResponse<any>> {
    return apiClient.post(`/storages/${encodeURIComponent(driverId)}/write`, { path: filePath, content });
  }

  /** 上传文件 (multipart) */
  async uploadFile(driverId: string, targetDir: string, file: globalThis.File): Promise<ApiResponse<any>> {
    try {
      const authToken = localStorage.getItem('authToken');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('path', targetDir);

      const baseUrl = import.meta.env.VITE_API_URL || '/api';
      const response = await fetch(`${baseUrl}/storages/${encodeURIComponent(driverId)}/upload`, {
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

  /** 创建文件夹 */
  async createFolder(driverId: string, folderPath: string): Promise<ApiResponse<void>> {
    const response = await apiClient.post<{ message: string }>(`/storages/${encodeURIComponent(driverId)}/mkdir`, { path: folderPath });
    return { data: undefined, message: response.data?.message, error: response.error };
  }

  /** 删除文件/目录 */
  async deleteFile(driverId: string, targetPath: string): Promise<ApiResponse<void>> {
    const response = await apiClient.delete<{ message: string }>(
      `/storages/${encodeURIComponent(driverId)}/remove?path=${encodeURIComponent(targetPath)}`
    );
    return { data: undefined, message: response.data?.message, error: response.error };
  }

  /** 重命名 */
  async renameFile(driverId: string, from: string, to: string): Promise<ApiResponse<void>> {
    const response = await apiClient.post<{ message: string }>(`/storages/${encodeURIComponent(driverId)}/rename`, { from, to });
    return { data: undefined, message: response.data?.message, error: response.error };
  }

  /** 移动 */
  async moveFile(driverId: string, from: string, to: string): Promise<ApiResponse<void>> {
    const response = await apiClient.post<{ message: string }>(`/storages/${encodeURIComponent(driverId)}/move`, { from, to });
    return { data: undefined, message: response.data?.message, error: response.error };
  }

  /** 复制 */
  async copyFile(driverId: string, from: string, to: string): Promise<ApiResponse<void>> {
    const response = await apiClient.post<{ message: string }>(`/storages/${encodeURIComponent(driverId)}/copy`, { from, to });
    return { data: undefined, message: response.data?.message, error: response.error };
  }

  /** 搜索文件 */
  async searchFiles(driverId: string, dirPath: string, keyword: string): Promise<ApiResponse<FileEntry[]>> {
    const response = await apiClient.get<{ data: FileEntry[]; total: number }>(
      `/storages/${encodeURIComponent(driverId)}/browse?path=${encodeURIComponent(dirPath)}&search=${encodeURIComponent(keyword)}`
    );
    return { data: response.data?.data || [], error: response.error };
  }

  /** 检查是否存在 */
  async fileExists(driverId: string, targetPath: string): Promise<ApiResponse<{ exists: boolean }>> {
    const response = await apiClient.get<{ data: { exists: boolean } }>(
      `/storages/${encodeURIComponent(driverId)}/info?path=${encodeURIComponent(targetPath)}`
    );
    return { data: { exists: !!response.data?.data }, error: response.error };
  }
}

export const openlistService = new OpenListService();
