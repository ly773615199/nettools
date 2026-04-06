import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClashService } from '../src/core/network/clashService';
import { apiClient } from '../src/core/api/apiClient';
import { configService } from '../src/core/config/configService';

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

describe('ClashService', () => {
  let clashService: ClashService;

  beforeEach(() => {
    clashService = new ClashService();
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  describe('getProxies', () => {
    it('should return proxies list', async () => {
      const mockProxies = [
        {
          id: '1',
          name: 'US Server',
          type: 'Shadowsocks',
          server: 'us.example.com',
          port: '8388',
          status: 'connected',
          config: {},
        },
      ];
      (apiClient.get as any).mockResolvedValue({
        data: { data: mockProxies, total: 1 },
        error: undefined,
      });

      const response = await clashService.getProxies();

      expect(response.data).toEqual(mockProxies);
      expect(response.error).toBeUndefined();
      expect(apiClient.get).toHaveBeenCalledWith('/proxy/list');
    });

    it('should handle error', async () => {
      (apiClient.get as any).mockResolvedValue({
        data: undefined,
        error: 'Failed to get proxies',
      });

      const response = await clashService.getProxies();

      expect(response.data).toEqual([]);
      expect(response.error).toBe('Failed to get proxies');
    });
  });

  describe('createProxy', () => {
    it('should create proxy', async () => {
      const newProxy = {
        name: 'Test Proxy',
        type: 'Shadowsocks',
        server: 'test.example.com',
        port: '8388',
        config: {},
      };
      (apiClient.post as any).mockResolvedValue({
        data: { id: '2', message: 'Proxy created successfully' },
        error: undefined,
      });

      const response = await clashService.createProxy(newProxy);

      expect(response.data).toEqual({
        ...newProxy,
        id: '2',
        status: 'disconnected',
      });
      expect(response.error).toBeUndefined();
      expect(apiClient.post).toHaveBeenCalledWith('/proxy/create', newProxy);
    });

    it('should handle error', async () => {
      const newProxy = {
        name: 'Test Proxy',
        type: 'Shadowsocks',
        server: 'test.example.com',
        port: '8388',
        config: {},
      };
      (apiClient.post as any).mockResolvedValue({
        data: undefined,
        error: 'Failed to create proxy',
      });

      const response = await clashService.createProxy(newProxy);

      expect(response.data).toEqual({});
      expect(response.error).toBe('Failed to create proxy');
    });
  });

  describe('deleteProxy', () => {
    it('should delete proxy', async () => {
      (apiClient.delete as any).mockResolvedValue({
        data: { message: 'Proxy deleted successfully' },
        error: undefined,
      });

      const response = await clashService.deleteProxy('1');

      expect(response.data).toBeUndefined();
      expect(response.error).toBeUndefined();
      expect(apiClient.delete).toHaveBeenCalledWith('/proxy/delete?id=1');
    });

    it('should handle error', async () => {
      (apiClient.delete as any).mockResolvedValue({
        data: undefined,
        error: 'Failed to delete proxy',
      });

      const response = await clashService.deleteProxy('1');

      expect(response.data).toBeUndefined();
      expect(response.error).toBe('Failed to delete proxy');
    });
  });

  describe('connectProxy', () => {
    it('should connect proxy', async () => {
      (apiClient.post as any).mockResolvedValue({
        data: { message: 'Proxy connected successfully' },
        error: undefined,
      });

      const response = await clashService.connectProxy('1');

      expect(response.data).toBeUndefined();
      expect(response.error).toBeUndefined();
      expect(apiClient.post).toHaveBeenCalledWith('/proxy/connect', { id: '1' });
    });
  });

  describe('disconnectProxy', () => {
    it('should disconnect proxy', async () => {
      (apiClient.post as any).mockResolvedValue({
        data: { message: 'Proxy disconnected successfully' },
        error: undefined,
      });

      const response = await clashService.disconnectProxy('1');

      expect(response.data).toBeUndefined();
      expect(response.error).toBeUndefined();
      expect(apiClient.post).toHaveBeenCalledWith('/proxy/disconnect', { id: '1' });
    });
  });

  describe('getSystemProxyStatus', () => {
    it('should get system proxy status', async () => {
      const response = await clashService.getSystemProxyStatus();

      expect(response.data).toEqual({
        enabled: true,
        proxy: '127.0.0.1:7890',
      });
      expect(response.error).toBeUndefined();
    });
  });

  describe('enableSystemProxy', () => {
    it('should enable system proxy', async () => {
      const response = await clashService.enableSystemProxy();

      expect(response.data).toBeUndefined();
      expect(response.error).toBeUndefined();
      expect(response.message).toBe('System proxy enabled successfully');
    });
  });

  describe('disableSystemProxy', () => {
    it('should disable system proxy', async () => {
      const response = await clashService.disableSystemProxy();

      expect(response.data).toBeUndefined();
      expect(response.error).toBeUndefined();
      expect(response.message).toBe('System proxy disabled successfully');
    });
  });

  describe('testProxy', () => {
    it('should test proxy connection', async () => {
      const response = await clashService.testProxy('1');

      expect(response.data).toEqual({
        status: 'success',
        latency: 120.5,
        speed: 5.2,
      });
      expect(response.error).toBeUndefined();
    });
  });

  describe('getProxyStatus', () => {
    it('should get proxy status', async () => {
      const mockProxies = [
        {
          id: '1',
          name: 'US Server',
          type: 'Shadowsocks',
          server: 'us.example.com',
          port: '8388',
          status: 'connected',
          config: {},
        },
      ];
      (apiClient.get as any).mockResolvedValue({
        data: { data: mockProxies, total: 1 },
        error: undefined,
      });

      const response = await clashService.getProxyStatus('1');

      expect(response.data).toEqual({
        status: 'connected',
        details: {
          server: 'us.example.com',
          port: '8388',
          type: 'Shadowsocks',
          uptime: '10m 15s',
        },
      });
      expect(response.error).toBeUndefined();
    });

    it('should handle proxy not found', async () => {
      (apiClient.get as any).mockResolvedValue({
        data: { data: [], total: 0 },
        error: undefined,
      });

      const response = await clashService.getProxyStatus('999');

      expect(response.data).toEqual({
        status: 'not_found',
        details: {},
      });
      expect(response.error).toBe('Proxy not found');
    });
  });
});
