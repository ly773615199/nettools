import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VpnService } from '../src/core/network/vpnService';

// Mock apiClient
vi.mock('../src/core/api/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import { apiClient } from '../src/core/api/apiClient';

describe('VpnService', () => {
  let vpnService: VpnService;

  beforeEach(() => {
    vpnService = new VpnService();
    vi.clearAllMocks();
  });

  describe('getVpnServers', () => {
    it('should return VPN servers successfully', async () => {
      (apiClient.get as any).mockResolvedValue({
        data: {
          data: [
            { id: '1', name: 'OpenVPN Server', type: 'openvpn', server: 'vpn.example.com', port: 1194, protocol: 'udp', status: 'disconnected', config: {} },
            { id: '2', name: 'WireGuard Server', type: 'wireguard', server: 'wg.example.com', port: 51820, protocol: 'udp', status: 'disconnected', config: {} },
          ],
          total: 2,
        },
      });

      const result = await vpnService.getVpnServers();
      expect(result.data).toHaveLength(2);
      expect(result.data?.[0].name).toBe('OpenVPN Server');
      expect(result.data?.[1].name).toBe('WireGuard Server');
      expect(apiClient.get).toHaveBeenCalledWith('/vpn/servers');
    });

    it('should handle API error', async () => {
      (apiClient.get as any).mockResolvedValue({ error: 'Network error' });
      const result = await vpnService.getVpnServers();
      expect(result.data).toEqual([]);
      expect(result.error).toBe('Network error');
    });
  });

  describe('createVpnServer', () => {
    it('should create VPN server successfully', async () => {
      (apiClient.post as any).mockResolvedValue({
        data: {
          data: { id: 1, name: 'Test VPN Server', type: 'openvpn', server: 'vpn.test.com', port: 1194, protocol: 'udp', status: 'stopped', config: {} },
          message: 'VPN server created',
        },
      });

      const serverConfig = {
        name: 'Test VPN Server',
        type: 'openvpn' as const,
        server: 'vpn.test.com',
        port: 1194,
        protocol: 'udp' as const,
        username: 'testuser',
        password: 'testpass',
        config: {},
      };

      const result = await vpnService.createVpnServer(serverConfig);
      expect(result.data?.name).toBe('Test VPN Server');
      expect(result.data?.status).toBe('stopped');
      expect(apiClient.post).toHaveBeenCalledWith('/vpn/servers', serverConfig);
    });
  });

  describe('deleteVpnServer', () => {
    it('should delete VPN server successfully', async () => {
      (apiClient.delete as any).mockResolvedValue({ data: { message: 'VPN server deleted' } });
      const result = await vpnService.deleteVpnServer('1');
      expect(result.data).toBeUndefined();
      expect(result.message).toBe('VPN server deleted');
      expect(apiClient.delete).toHaveBeenCalledWith('/vpn/servers/1');
    });
  });

  describe('connectVpnServer', () => {
    it('should connect VPN server successfully', async () => {
      (apiClient.post as any).mockResolvedValue({ data: { message: 'VPN Test connected', data: { status: 'running' } } });
      const result = await vpnService.connectVpnServer('1');
      expect(result.data).toBeUndefined();
      expect(result.message).toBe('VPN Test connected');
      expect(apiClient.post).toHaveBeenCalledWith('/vpn/servers/1/connect', {});
    });
  });

  describe('disconnectVpnServer', () => {
    it('should disconnect VPN server successfully', async () => {
      (apiClient.post as any).mockResolvedValue({ data: { message: 'VPN Test disconnected' } });
      const result = await vpnService.disconnectVpnServer('1');
      expect(result.data).toBeUndefined();
      expect(result.message).toBe('VPN Test disconnected');
      expect(apiClient.post).toHaveBeenCalledWith('/vpn/servers/1/disconnect', {});
    });
  });

  describe('getVpnServerStatus', () => {
    it('should get VPN server status successfully', async () => {
      (apiClient.get as any).mockResolvedValue({
        data: { data: { id: '1', name: 'OpenVPN Server', type: 'openvpn', server: 'vpn.example.com', port: 1194, status: 'running', running: true, uptime: '2h 30m', config: {} } },
      });

      const result = await vpnService.getVpnServerStatus('1');
      expect(result.data?.id).toBe('1');
      expect(result.data?.name).toBe('OpenVPN Server');
      expect(apiClient.get).toHaveBeenCalledWith('/vpn/servers/1');
    });

    it('should handle server not found', async () => {
      (apiClient.get as any).mockResolvedValue({ error: 'VPN server not found' });
      const result = await vpnService.getVpnServerStatus('non-existent');
      expect(result.data).toBeUndefined();
      expect(result.error).toBe('VPN server not found');
    });
  });

  describe('generateVpnClientConfig', () => {
    it('should generate OpenVPN client config successfully', async () => {
      const serverConfig = {
        id: '1', name: 'OpenVPN Server', type: 'openvpn' as const,
        server: 'vpn.example.com', port: 1194, protocol: 'udp' as const,
        username: 'user', password: 'password',
        status: 'disconnected' as const, config: {},
      };

      const result = await vpnService.generateVpnClientConfig(serverConfig);
      expect(result.data?.id).toBeDefined();
      expect(result.data?.name).toBe('OpenVPN Server Client');
      expect(result.data?.config).toContain('client');
      expect(result.data?.config).toContain('vpn.example.com');
    });

    it('should generate WireGuard client config successfully', async () => {
      const serverConfig = {
        id: '2', name: 'WireGuard Server', type: 'wireguard' as const,
        server: 'wg.example.com', port: 51820, protocol: 'udp' as const,
        status: 'disconnected' as const, config: {},
      };

      const result = await vpnService.generateVpnClientConfig(serverConfig);
      expect(result.data?.id).toBeDefined();
      expect(result.data?.name).toBe('WireGuard Server Client');
      expect(result.data?.config).toContain('[Interface]');
      expect(result.data?.config).toContain('wg.example.com:51820');
    });
  });

  describe('testVpnServerConnection', () => {
    it('should test VPN server connection successfully', async () => {
      (apiClient.post as any).mockResolvedValue({ data: { data: { status: 'success', latency: 25 } } });
      const result = await vpnService.testVpnServerConnection({
        id: '1', name: 'Test', type: 'openvpn', server: 'vpn.example.com',
        port: 1194, protocol: 'udp', status: 'disconnected', config: {},
      });
      expect(result.data?.status).toBe('success');
      expect(result.data?.latency).toBe(25);
      expect(apiClient.post).toHaveBeenCalledWith('/vpn/servers/1/test', {});
    });
  });

  describe('getVpnTypes', () => {
    it('should return VPN types successfully', async () => {
      const result = await vpnService.getVpnTypes();
      expect(result.data).toHaveLength(3);
      expect(result.data?.[0].type).toBe('openvpn');
      expect(result.data?.[1].type).toBe('wireguard');
      expect(result.data?.[2].type).toBe('ikev2');
    });
  });

  describe('importVpnConfig', () => {
    it('should import VPN config successfully', async () => {
      (apiClient.post as any).mockResolvedValue({
        data: {
          data: { id: 3, name: 'Imported VPN', type: 'openvpn', status: 'stopped', config: {} },
          message: 'VPN server created',
        },
      });

      const config = '# OpenVPN Config\nremote myserver.com 1194\nproto udp\ndev tun';
      const result = await vpnService.importVpnConfig(config);
      expect(result.data?.id).toBeDefined();
      expect(result.data?.name).toBe('Imported VPN');
    });
  });

  describe('exportVpnConfig', () => {
    it('should export VPN config successfully', async () => {
      (apiClient.get as any).mockResolvedValue({
        data: { data: { id: '1', name: 'OpenVPN Server', type: 'openvpn', server: 'vpn.example.com', port: 1194, protocol: 'udp', status: 'stopped', config: {} } },
      });

      const result = await vpnService.exportVpnConfig('1');
      expect(result.data?.config).toBeDefined();
      expect(result.data?.config).toContain('# OpenVPN Server Config');
      expect(result.data?.config).toContain('vpn.example.com');
    });

    it('should export WireGuard config', async () => {
      (apiClient.get as any).mockResolvedValue({
        data: { data: { id: '2', name: 'WG Server', type: 'wireguard', server: 'wg.example.com', port: 51820, protocol: 'udp', status: 'stopped', config: {} } },
      });

      const result = await vpnService.exportVpnConfig('2');
      expect(result.data?.config).toContain('# WireGuard Server Config');
      expect(result.data?.config).toContain('[Interface]');
    });
  });
});
