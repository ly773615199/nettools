import type { ApiResponse } from '../types';
import { apiClient } from '../api/apiClient';

// 文件/目录条目
export interface FileEntry {
  name: string;
  type: 'file' | 'folder';
  size: number;
  modified: string | null;
  path: string;
  extension: string | null;
}

// 存储驱动信息
export interface StorageDriverInfo {
  id: string;
  name: string;
  type: string;
}

// 文件信息
export interface FileInfo {
  name: string;
  type: 'file' | 'folder';
  size: number;
  created: string;
  modified: string;
  accessed: string;
  path: string;
  permissions: string;
}

/**
 * 存储服务管理器 — 全部通过后端 API 实现
 */
export class StorageServiceManager {
  /** 获取所有可用的存储驱动 */
  async getDrivers(): Promise<ApiResponse<StorageDriverInfo[]>> {
    const response = await apiClient.get<{ data: StorageDriverInfo[]; total: number }>('/drivers');
    return {
      data: response.data?.data || [],
      error: response.error,
    };
  }

  /** 列出目录内容 */
  async list(driverId: string = 'local', dirPath: string = '/'): Promise<ApiResponse<FileEntry[]>> {
    const response = await apiClient.get<{ data: FileEntry[]; total: number }>(
      `/storage/browse?driver=${encodeURIComponent(driverId)}&path=${encodeURIComponent(dirPath)}`
    );
    return {
      data: response.data?.data || [],
      error: response.error,
    };
  }

  /** 获取文件/目录详细信息 */
  async info(driverId: string = 'local', targetPath: string): Promise<ApiResponse<FileInfo>> {
    const response = await apiClient.get<{ data: FileInfo }>(
      `/storage/info?driver=${encodeURIComponent(driverId)}&path=${encodeURIComponent(targetPath)}`
    );
    return {
      data: response.data?.data as FileInfo,
      error: response.error,
    };
  }

  /** 读取文件内容（文本） */
  async readFile(driverId: string = 'local', filePath: string): Promise<ApiResponse<{ content: string; meta: { size: number; modified: string } }>> {
    const response = await apiClient.get<{ data: string; meta: { size: number; modified: string } }>(
      `/storage/read?driver=${encodeURIComponent(driverId)}&path=${encodeURIComponent(filePath)}`
    );
    return {
      data: { content: response.data?.data || '', meta: response.data?.meta || { size: 0, modified: '' } },
      error: response.error,
    };
  }

  /** 写入/上传文本文件 */
  async writeFile(driverId: string = 'local', filePath: string, content: string, encoding?: string): Promise<ApiResponse<{ path: string; size: number }>> {
    const response = await apiClient.post<{ message: string; data: { path: string; size: number } }>(
      '/storage/write',
      { driver: driverId, path: filePath, content, encoding }
    );
    return {
      data: response.data?.data,
      message: response.data?.message,
      error: response.error,
    };
  }

  /** 上传二进制文件 (multipart) */
  async uploadFile(driverId: string = 'local', targetDir: string, file: globalThis.File): Promise<ApiResponse<any>> {
    try {
      const authToken = localStorage.getItem('authToken');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('driver', driverId);
      formData.append('path', targetDir);

      const response = await fetch(`/api/files/upload`, {
        method: 'POST',
        headers: {
          ...(authToken && { 'Authorization': `Bearer ${authToken}` }),
        },
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        return { data: undefined, error: data.error || 'Upload failed' };
      }
      return { data: data.file, message: data.message };
    } catch (error) {
      return {
        data: undefined,
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    }
  }

  /** 创建文件夹 */
  async mkdir(driverId: string = 'local', folderPath: string): Promise<ApiResponse<void>> {
    const response = await apiClient.post<{ message: string }>(
      '/storage/mkdir',
      { driver: driverId, path: folderPath }
    );
    return {
      data: undefined,
      message: response.data?.message,
      error: response.error,
    };
  }

  /** 删除文件或目录 */
  async remove(driverId: string = 'local', targetPath: string): Promise<ApiResponse<void>> {
    const response = await apiClient.delete<{ message: string }>(
      `/storage/remove?driver=${encodeURIComponent(driverId)}&path=${encodeURIComponent(targetPath)}`
    );
    return {
      data: undefined,
      message: response.data?.message,
      error: response.error,
    };
  }

  /** 重命名/移动 */
  async rename(driverId: string = 'local', from: string, to: string): Promise<ApiResponse<void>> {
    const response = await apiClient.post<{ message: string }>(
      '/storage/rename',
      { driver: driverId, from, to }
    );
    return {
      data: undefined,
      message: response.data?.message,
      error: response.error,
    };
  }

  /** 复制 */
  async copy(driverId: string = 'local', from: string, to: string): Promise<ApiResponse<void>> {
    const response = await apiClient.post<{ message: string }>(
      '/storage/copy',
      { driver: driverId, from, to }
    );
    return {
      data: undefined,
      message: response.data?.message,
      error: response.error,
    };
  }

  /** 移动（重命名别名） */
  async move(driverId: string = 'local', from: string, to: string): Promise<ApiResponse<void>> {
    const response = await apiClient.post<{ message: string }>(
      '/storage/move',
      { driver: driverId, from, to }
    );
    return {
      data: undefined,
      message: response.data?.message,
      error: response.error,
    };
  }

  /** 检查是否存在 */
  async exists(driverId: string = 'local', targetPath: string): Promise<ApiResponse<{ exists: boolean }>> {
    const response = await apiClient.get<{ data: { exists: boolean } }>(
      `/storage/exists?driver=${encodeURIComponent(driverId)}&path=${encodeURIComponent(targetPath)}`
    );
    return {
      data: response.data?.data || { exists: false },
      error: response.error,
    };
  }

  /** 搜索文件 */
  async search(driverId: string = 'local', dirPath: string = '/', keyword: string): Promise<ApiResponse<FileEntry[]>> {
    const response = await apiClient.get<{ data: FileEntry[]; total: number }>(
      `/storage/search?driver=${encodeURIComponent(driverId)}&path=${encodeURIComponent(dirPath)}&q=${encodeURIComponent(keyword)}`
    );
    return {
      data: response.data?.data || [],
      error: response.error,
    };
  }
}

// 导出存储服务管理器实例
export const storageServiceManager = new StorageServiceManager();
