import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NetworkMonitorService } from '../src/core/network/networkMonitorService';

describe('NetworkMonitorService', () => {
  let monitorService: NetworkMonitorService;
  
  beforeEach(() => {
    monitorService = new NetworkMonitorService();
    vi.clearAllMocks();
  });
  
  describe('getNetworkStatus', () => {
    it('should return network status successfully', async () => {
      const result = await monitorService.getNetworkStatus();
      expect(result.isOnline).toBeDefined();
      expect(result.networkType).toBeDefined();
      expect(result.ipAddress).toBeDefined();
      expect(result.uploadSpeed).toBeDefined();
      expect(result.downloadSpeed).toBeDefined();
    });
  });
  
  describe('getNetworkInterfaces', () => {
    it('should return network interfaces successfully', async () => {
      const result = await monitorService.getNetworkInterfaces();
      expect(result.data).toHaveLength(2);
      expect(result.data?.[0].name).toBe('Ethernet');
      expect(result.data?.[1].name).toBe('Wi-Fi');
    });
  });
  
  describe('testConnection', () => {
    it('should test connection successfully', async () => {
      const result = await monitorService.testConnection('https://example.com');
      expect(result.data?.ping).toBeDefined();
      expect(result.data?.status).toBeDefined();
    });
  });
  
  describe('resetTrafficStats', () => {
    it('should reset traffic stats successfully', () => {
      const result = monitorService.resetTrafficStats();
      expect(result.data).toBe(true);
      expect(result.message).toBe('Traffic stats reset successfully');
    });
  });
  
  describe('startMonitoring and stopMonitoring', () => {
    it('should start and stop monitoring successfully', () => {
      monitorService.startMonitoring(1000);
      monitorService.stopMonitoring();
      // 验证监控已停止（通过再次启动不会报错）
      monitorService.startMonitoring(1000);
      monitorService.stopMonitoring();
    });
  });
  
  describe('addListener and removeListener', () => {
    it('should add and remove listener successfully', () => {
      const listener = vi.fn();
      monitorService.addListener(listener);
      
      // 移除监听器
      monitorService.removeListener(listener);
      
      // 验证监听器可以被添加和移除，不报错
      expect(() => {
        monitorService.addListener(listener);
        monitorService.removeListener(listener);
      }).not.toThrow();
    });
  });
});
