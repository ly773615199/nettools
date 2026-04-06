import type { ApiResponse } from '../types';
import { StorageDriver } from './storageService';

/**
 * 云存储驱动基类
 * 所有云存储驱动需要实现真实的 API 调用
 * 以下为扩展驱动的接口定义，需要配置对应的 API Key/Token 才能使用
 */

// 阿里云盘驱动 — 需要配置 refreshToken
export class AliyunDriveDriver extends StorageDriver {
  id: string;
  name: string;
  type: string;
  status: 'online' | 'offline';
  config: Record<string, any>;

  constructor(config: { id: string; name: string; refreshToken: string }) {
    super();
    this.id = config.id;
    this.name = config.name;
    this.type = 'aliyundrive';
    this.status = 'offline';
    this.config = { refreshToken: config.refreshToken };
  }

  async list(_path: string): Promise<ApiResponse<any[]>> {
    return { data: [], error: 'AliyunDrive driver requires real API integration. Configure refreshToken.' };
  }
  async upload(_path: string, _file: File): Promise<ApiResponse<any>> {
    return { data: undefined, error: 'Not implemented — requires AliyunDrive API' };
  }
  async download(_path: string): Promise<ApiResponse<Blob>> {
    return { data: undefined as any, error: 'Not implemented — requires AliyunDrive API' };
  }
  async delete(_path: string): Promise<ApiResponse<void>> {
    return { data: undefined, error: 'Not implemented — requires AliyunDrive API' };
  }
  async rename(_oldPath: string, _newPath: string): Promise<ApiResponse<void>> {
    return { data: undefined, error: 'Not implemented' };
  }
  async move(_source: string, _destination: string): Promise<ApiResponse<void>> {
    return { data: undefined, error: 'Not implemented' };
  }
  async copy(_source: string, _destination: string): Promise<ApiResponse<void>> {
    return { data: undefined, error: 'Not implemented' };
  }
  async createFolder(_path: string): Promise<ApiResponse<void>> {
    return { data: undefined, error: 'Not implemented' };
  }
  async connect(): Promise<ApiResponse<void>> {
    return { data: undefined, error: 'AliyunDrive driver requires real API integration' };
  }
  async disconnect(): Promise<ApiResponse<void>> {
    this.status = 'offline';
    return { data: undefined };
  }
}

// OneDrive驱动 — 需要配置 accessToken
export class OneDriveDriver extends StorageDriver {
  id: string;
  name: string;
  type: string;
  status: 'online' | 'offline';
  config: Record<string, any>;

  constructor(config: { id: string; name: string; accessToken: string }) {
    super();
    this.id = config.id;
    this.name = config.name;
    this.type = 'onedrive';
    this.status = 'offline';
    this.config = { accessToken: config.accessToken };
  }

  async list(_path: string): Promise<ApiResponse<any[]>> {
    return { data: [], error: 'OneDrive driver requires real API integration. Configure accessToken.' };
  }
  async upload(_path: string, _file: File): Promise<ApiResponse<any>> {
    return { data: undefined, error: 'Not implemented — requires Microsoft Graph API' };
  }
  async download(_path: string): Promise<ApiResponse<Blob>> {
    return { data: undefined as any, error: 'Not implemented — requires Microsoft Graph API' };
  }
  async delete(_path: string): Promise<ApiResponse<void>> {
    return { data: undefined, error: 'Not implemented' };
  }
  async rename(_oldPath: string, _newPath: string): Promise<ApiResponse<void>> {
    return { data: undefined, error: 'Not implemented' };
  }
  async move(_source: string, _destination: string): Promise<ApiResponse<void>> {
    return { data: undefined, error: 'Not implemented' };
  }
  async copy(_source: string, _destination: string): Promise<ApiResponse<void>> {
    return { data: undefined, error: 'Not implemented' };
  }
  async createFolder(_path: string): Promise<ApiResponse<void>> {
    return { data: undefined, error: 'Not implemented' };
  }
  async connect(): Promise<ApiResponse<void>> {
    return { data: undefined, error: 'OneDrive driver requires real API integration' };
  }
  async disconnect(): Promise<ApiResponse<void>> {
    this.status = 'offline';
    return { data: undefined };
  }
}

// Google Drive驱动 — 需要配置 accessToken
export class GoogleDriveDriver extends StorageDriver {
  id: string;
  name: string;
  type: string;
  status: 'online' | 'offline';
  config: Record<string, any>;

  constructor(config: { id: string; name: string; accessToken: string }) {
    super();
    this.id = config.id;
    this.name = config.name;
    this.type = 'googledrive';
    this.status = 'offline';
    this.config = { accessToken: config.accessToken };
  }

  async list(_path: string): Promise<ApiResponse<any[]>> {
    return { data: [], error: 'GoogleDrive driver requires real API integration. Configure accessToken.' };
  }
  async upload(_path: string, _file: File): Promise<ApiResponse<any>> {
    return { data: undefined, error: 'Not implemented — requires Google Drive API' };
  }
  async download(_path: string): Promise<ApiResponse<Blob>> {
    return { data: undefined as any, error: 'Not implemented — requires Google Drive API' };
  }
  async delete(_path: string): Promise<ApiResponse<void>> {
    return { data: undefined, error: 'Not implemented' };
  }
  async rename(_oldPath: string, _newPath: string): Promise<ApiResponse<void>> {
    return { data: undefined, error: 'Not implemented' };
  }
  async move(_source: string, _destination: string): Promise<ApiResponse<void>> {
    return { data: undefined, error: 'Not implemented' };
  }
  async copy(_source: string, _destination: string): Promise<ApiResponse<void>> {
    return { data: undefined, error: 'Not implemented' };
  }
  async createFolder(_path: string): Promise<ApiResponse<void>> {
    return { data: undefined, error: 'Not implemented' };
  }
  async connect(): Promise<ApiResponse<void>> {
    return { data: undefined, error: 'GoogleDrive driver requires real API integration' };
  }
  async disconnect(): Promise<ApiResponse<void>> {
    this.status = 'offline';
    return { data: undefined };
  }
}
