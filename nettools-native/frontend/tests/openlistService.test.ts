import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenListService } from '../src/core/storage/openlistService';
import { storageServiceManager } from '../src/core/storage/storageService';
import { configService } from '../src/core/config/configService';
import { apiClient } from '../src/core/api/apiClient';

// 模拟localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// 模拟apiClient
vi.mock('../src/core/api/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

// 模拟storageServiceManager
vi.mock('../src/core/storage/storageService', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    storageServiceManager: {
      get: vi.fn(),
      register: vi.fn(),
      unregister: vi.fn(),
    },
  };
});

describe('OpenListService', () => {
  let openlistService: OpenListService;

  beforeEach(() => {
    openlistService = new OpenListService();
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  describe('getStorageServices', () => {
    it('should return storage services list', async () => {
      const mockServices = [
        { id: '1', name: 'Local Storage', type: 'local', status: 'online' },
        { id: '2', name: 'Aliyun Drive', type: 'aliyundrive', status: 'online' },
      ];
      (apiClient.get as any).mockResolvedValue({
        data: { data: mockServices, total: 2 },
        error: undefined,
      });

      const response = await openlistService.getStorageServices();

      expect(response.data).toEqual(mockServices);
      expect(response.error).toBeUndefined();
      expect(apiClient.get).toHaveBeenCalledWith('/storage/list');
    });

    it('should handle error', async () => {
      (apiClient.get as any).mockResolvedValue({
        data: undefined,
        error: 'Failed to get storage services',
      });

      const response = await openlistService.getStorageServices();

      expect(response.data).toEqual([]);
      expect(response.error).toBe('Failed to get storage services');
    });
  });

  describe('addStorageService', () => {
    it('should add storage service', async () => {
      const newService = {
        name: 'Test Storage',
        type: 'local',
        config: { path: '/' },
      };
      (apiClient.post as any).mockResolvedValue({
        data: { id: '3', message: 'Storage created successfully' },
        error: undefined,
      });

      const response = await openlistService.addStorageService(newService);

      expect(response.data).toEqual({
        ...newService,
        id: '3',
        status: 'offline',
      });
      expect(response.error).toBeUndefined();
      expect(apiClient.post).toHaveBeenCalledWith('/storage/create', newService);
    });

    it('should handle error', async () => {
      const newService = {
        name: 'Test Storage',
        type: 'local',
        config: { path: '/' },
      };
      (apiClient.post as any).mockResolvedValue({
        data: undefined,
        error: 'Failed to create storage service',
      });

      const response = await openlistService.addStorageService(newService);

      expect(response.data).toEqual({});
      expect(response.error).toBe('Failed to create storage service');
    });
  });

  describe('deleteStorageService', () => {
    it('should delete storage service', async () => {
      (apiClient.delete as any).mockResolvedValue({
        data: { message: 'Storage deleted successfully' },
        error: undefined,
      });

      const response = await openlistService.deleteStorageService('1');

      expect(response.data).toBeUndefined();
      expect(response.error).toBeUndefined();
      expect(apiClient.delete).toHaveBeenCalledWith('/storage/delete?id=1');
    });

    it('should handle error', async () => {
      (apiClient.delete as any).mockResolvedValue({
        data: undefined,
        error: 'Failed to delete storage service',
      });

      const response = await openlistService.deleteStorageService('1');

      expect(response.data).toBeUndefined();
      expect(response.error).toBe('Failed to delete storage service');
    });
  });

  describe('enableStorageService', () => {
    it('should enable storage service', async () => {
      (apiClient.post as any).mockResolvedValue({
        data: { message: 'Storage enabled successfully' },
        error: undefined,
      });

      const response = await openlistService.enableStorageService('1');

      expect(response.data).toBeUndefined();
      expect(response.error).toBeUndefined();
      expect(apiClient.post).toHaveBeenCalledWith('/storage/enable', { id: '1' });
    });
  });

  describe('disableStorageService', () => {
    it('should disable storage service', async () => {
      (apiClient.post as any).mockResolvedValue({
        data: { message: 'Storage disabled successfully' },
        error: undefined,
      });

      const response = await openlistService.disableStorageService('1');

      expect(response.data).toBeUndefined();
      expect(response.error).toBeUndefined();
      expect(apiClient.post).toHaveBeenCalledWith('/storage/disable', { id: '1' });
    });
  });
});
