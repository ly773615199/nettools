import type { ApiResponse } from '../types';
import { apiClient } from '../api/apiClient';

// 下载任务状态
export type DownloadStatus = 'pending' | 'downloading' | 'paused' | 'completed' | 'failed' | 'cancelled';

// 下载任务接口
export interface DownloadTask {
  id: string;
  url: string;
  targetPath: string;
  fileName: string;
  filePath: string;
  size: number;
  downloaded: number;
  status: DownloadStatus;
  progress: number;
  speed: number;
  startTime: string;
  endTime: string | null;
  error: string | null;
}

// 已下载文件
export interface DownloadedFile {
  name: string;
  size: number;
  modified: string;
  downloadUrl: string;
}

/**
 * 离线下载服务类 — 对接真实后端 API
 */
export class OfflineDownloadService {
  /**
   * 创建并立即启动下载任务
   */
  async createDownload(url: string, targetPath?: string, filename?: string): Promise<ApiResponse<DownloadTask>> {
    const response = await apiClient.post<{ data: DownloadTask; message: string; error: string }>(
      '/downloads',
      { url, targetPath, filename }
    );
    return {
      data: response.data?.data as DownloadTask,
      message: response.data?.message,
      error: response.data?.error || response.error,
    };
  }

  /**
   * 获取所有下载任务
   */
  async getDownloadTasks(): Promise<ApiResponse<DownloadTask[]>> {
    const response = await apiClient.get<{ data: DownloadTask[] }>('/downloads');
    return {
      data: response.data?.data || [],
      error: response.error,
    };
  }

  /**
   * 获取单个下载任务
   */
  async getDownloadTask(id: string): Promise<ApiResponse<DownloadTask>> {
    const response = await apiClient.get<{ data: DownloadTask }>(`/downloads/${id}`);
    return {
      data: response.data?.data as DownloadTask,
      error: response.error,
    };
  }

  /**
   * 取消下载任务
   */
  async cancelDownloadTask(id: string): Promise<ApiResponse<void>> {
    const response = await apiClient.post<{ message: string; error: string }>(`/downloads/${id}/cancel`, {});
    return {
      data: undefined,
      message: response.data?.message,
      error: response.data?.error || response.error,
    };
  }

  /**
   * 删除下载任务记录
   */
  async deleteDownloadTask(id: string): Promise<ApiResponse<void>> {
    const response = await apiClient.delete<{ message: string }>(`/downloads/${id}`);
    return {
      data: undefined,
      message: response.data?.message,
      error: response.error,
    };
  }

  /**
   * 获取已下载文件列表
   */
  async getDownloadedFiles(): Promise<ApiResponse<DownloadedFile[]>> {
    const response = await apiClient.get<{ data: DownloadedFile[] }>('/downloads-files');
    return {
      data: response.data?.data || [],
      error: response.error,
    };
  }

  /**
   * 获取下载文件的下载 URL
   */
  getDownloadUrl(filename: string): string {
    return `/api/downloads-files/${encodeURIComponent(filename)}`;
  }

  /**
   * 批量下载
   */
  async startBatchDownloads(urls: string[], targetPath?: string): Promise<ApiResponse<DownloadTask[]>> {
    try {
      const tasks: DownloadTask[] = [];
      for (const url of urls) {
        const resp = await this.createDownload(url, targetPath);
        if (resp.data) tasks.push(resp.data);
      }
      return {
        data: tasks,
        message: `Started ${tasks.length} download tasks`,
      };
    } catch (error) {
      return {
        data: [],
        error: error instanceof Error ? error.message : 'Batch download failed',
      };
    }
  }
}

// 导出离线下载服务实例
export const offlineDownloadService = new OfflineDownloadService();
