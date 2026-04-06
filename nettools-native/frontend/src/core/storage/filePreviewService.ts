import type { ApiResponse } from '../types';
import { apiClient } from '../api/apiClient';

// 预览类型
export type PreviewType = 'text' | 'image' | 'pdf' | 'markdown' | 'office_unavailable' | 'binary' | 'unknown';

// 预览结果
export interface PreviewResult {
  type: PreviewType;
  content?: string;
  previewUrl?: string;
  name?: string;
  size?: number;
  downloadUrl?: string;
  message?: string;
  cached?: boolean;
  meta?: { size: number; modified: string };
}

/**
 * 文件预览服务类 — 对接真实后端 API
 */
export class FilePreviewService {
  /**
   * 根据文件扩展名判断预览类型（客户端预判）
   */
  getPreviewType(filename: string): PreviewType {
    const ext = filename.toLowerCase().split('.').pop() || '';

    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico'].includes(ext)) {
      return 'image';
    }
    if (['txt', 'js', 'ts', 'json', 'css', 'html', 'xml', 'yaml', 'yml', 'md',
         'sh', 'py', 'go', 'rs', 'java', 'c', 'cpp', 'h', 'log', 'conf', 'cfg', 'ini'].includes(ext)) {
      return 'text';
    }
    if (ext === 'pdf') return 'pdf';
    return 'binary';
  }

  /**
   * 通过后端 API 预览文件
   * 文本类直接返回内容，图片/PDF 类返回预览 URL，其他返回下载信息
   */
  async previewFile(driverId: string = 'local', filePath: string): Promise<ApiResponse<PreviewResult>> {
    const response = await apiClient.get<{ data: PreviewResult }>(
      `/preview?driver=${encodeURIComponent(driverId)}&path=${encodeURIComponent(filePath)}`
    );
    return {
      data: response.data?.data as PreviewResult,
      error: response.error,
    };
  }

  /**
   * 获取文件原始内容的 URL（用于 img/src 或 iframe/src）
   */
  getRawFileUrl(driverId: string = 'local', filePath: string): string {
    const token = localStorage.getItem('authToken') || '';
    const base = `/api/storage/raw`;
    return `${base}?driver=${encodeURIComponent(driverId)}&path=${encodeURIComponent(filePath)}&token=${encodeURIComponent(token)}`;
  }

  /**
   * 获取带认证的 fetch 请求（用于文本内容加载）
   */
  async fetchRawFile(driverId: string = 'local', filePath: string): Promise<Blob | null> {
    try {
      const token = localStorage.getItem('authToken') || '';
      const url = `/api/storage/raw?driver=${encodeURIComponent(driverId)}&path=${encodeURIComponent(filePath)}`;
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) return null;
      return await response.blob();
    } catch {
      return null;
    }
  }

  /**
   * 生成预览 URL（对象 URL，用于本地预览）
   */
  generatePreviewUrl(blob: Blob): string {
    return URL.createObjectURL(blob);
  }

  /**
   * 释放预览 URL
   */
  revokePreviewUrl(url: string): void {
    URL.revokeObjectURL(url);
  }
}

// 导出文件预览服务实例
export const filePreviewService = new FilePreviewService();
