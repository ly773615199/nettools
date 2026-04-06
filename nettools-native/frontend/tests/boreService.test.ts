import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BoreService } from '../src/core/network/boreService';
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

describe('BoreService', () => {
  let boreService: BoreService;

  beforeEach(() => {
    boreService = new BoreService();
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  describe('getTunnels', () => {
    it('should return tunnels list', async () => {
      const mockTunnels = [
        {
          id: '1',
          name: 'Local Web Server',
          localPort: '8080',
          remoteServer: 'bore.pub',
          remotePort: '12345',
          status: 'running',
        },
      ];
      (apiClient.get as any).mockResolvedValue({
        data: { data: mockTunnels, total: 1 },
        error: undefined,
      });

      const response = await boreService.getTunnels();

      expect(response.data).toEqual(mockTunnels);
      expect(response.error).toBeUndefined();
      expect(apiClient.get).toHaveBeenCalledWith('/tunnel/list');
    });

    it('should handle error', async () => {
      (apiClient.get as any).mockResolvedValue({
        data: undefined,
        error: 'Failed to get tunnels',
      });

      const response = await boreService.getTunnels();

      expect(response.data).toEqual([]);
      expect(response.error).toBe('Failed to get tunnels');
    });
  });

  describe('createTunnel', () => {
    it('should create tunnel', async () => {
      const newTunnel = {
        name: 'Test Tunnel',
        localPort: '3000',
        remoteServer: 'bore.pub',
        remotePort: '54321',
      };
      (apiClient.post as any).mockResolvedValue({
        data: { id: '2', message: 'Tunnel created successfully' },
        error: undefined,
      });

      const response = await boreService.createTunnel(newTunnel);

      expect(response.data).toEqual({
        ...newTunnel,
        id: '2',
        status: 'stopped',
      });
      expect(response.error).toBeUndefined();
      expect(apiClient.post).toHaveBeenCalledWith('/tunnel/create', newTunnel);
    });

    it('should handle error', async () => {
      const newTunnel = {
        name: 'Test Tunnel',
        localPort: '3000',
        remoteServer: 'bore.pub',
        remotePort: '54321',
      };
      (apiClient.post as any).mockResolvedValue({
        data: undefined,
        error: 'Failed to create tunnel',
      });

      const response = await boreService.createTunnel(newTunnel);

      expect(response.data).toEqual({});
      expect(response.error).toBe('Failed to create tunnel');
    });
  });

  describe('deleteTunnel', () => {
    it('should delete tunnel', async () => {
      (apiClient.delete as any).mockResolvedValue({
        data: { message: 'Tunnel deleted successfully' },
        error: undefined,
      });

      const response = await boreService.deleteTunnel('1');

      expect(response.data).toBeUndefined();
      expect(response.error).toBeUndefined();
      expect(apiClient.delete).toHaveBeenCalledWith('/tunnel/delete?id=1');
    });

    it('should handle error', async () => {
      (apiClient.delete as any).mockResolvedValue({
        data: undefined,
        error: 'Failed to delete tunnel',
      });

      const response = await boreService.deleteTunnel('1');

      expect(response.data).toBeUndefined();
      expect(response.error).toBe('Failed to delete tunnel');
    });
  });

  describe('startTunnel', () => {
    it('should start tunnel', async () => {
      (apiClient.post as any).mockResolvedValue({
        data: { message: 'Tunnel started successfully' },
        error: undefined,
      });

      const response = await boreService.startTunnel('1');

      expect(response.data).toBeUndefined();
      expect(response.error).toBeUndefined();
      expect(apiClient.post).toHaveBeenCalledWith('/tunnel/start', { id: '1' });
    });
  });

  describe('stopTunnel', () => {
    it('should stop tunnel', async () => {
      (apiClient.post as any).mockResolvedValue({
        data: { message: 'Tunnel stopped successfully' },
        error: undefined,
      });

      const response = await boreService.stopTunnel('1');

      expect(response.data).toBeUndefined();
      expect(response.error).toBeUndefined();
      expect(apiClient.post).toHaveBeenCalledWith('/tunnel/stop', { id: '1' });
    });
  });

  describe('testTunnel', () => {
    it('should test tunnel connection', async () => {
      const response = await boreService.testTunnel('1');

      expect(response.data).toEqual({
        status: 'success',
        latency: 15.5,
      });
      expect(response.error).toBeUndefined();
    });
  });

  describe('getTunnelStatus', () => {
    it('should get tunnel status', async () => {
      const mockTunnels = [
        {
          id: '1',
          name: 'Local Web Server',
          localPort: '8080',
          remoteServer: 'bore.pub',
          remotePort: '12345',
          status: 'running',
        },
      ];
      (apiClient.get as any).mockResolvedValue({
        data: { data: mockTunnels, total: 1 },
        error: undefined,
      });

      const response = await boreService.getTunnelStatus('1');

      expect(response.data).toEqual({
        status: 'running',
        details: {
          localPort: '8080',
          remoteServer: 'bore.pub',
          remotePort: '12345',
          uptime: '5m 30s',
        },
      });
      expect(response.error).toBeUndefined();
    });

    it('should handle tunnel not found', async () => {
      (apiClient.get as any).mockResolvedValue({
        data: { data: [], total: 0 },
        error: undefined,
      });

      const response = await boreService.getTunnelStatus('999');

      expect(response.data).toEqual({
        status: 'not_found',
        details: {},
      });
      expect(response.error).toBe('Tunnel not found');
    });
  });
});
