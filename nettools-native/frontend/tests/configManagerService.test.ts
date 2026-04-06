import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfigManagerService } from '../src/core/config/configManagerService';

// 模拟os模块
const mockOs = {
  cpus: vi.fn(() => Array(4).fill({})),
};

// 模拟模块
vi.mock('os', () => ({
  default: mockOs,
}));

describe('ConfigManagerService', () => {
  let configManager: ConfigManagerService;
  
  beforeEach(() => {
    configManager = new ConfigManagerService();
    vi.clearAllMocks();
  });
  
  describe('getSystemInfo', () => {
    it('should get system info successfully', async () => {
      const result = await configManager.getSystemInfo();
      expect(result.data?.platform).toBeDefined();
      expect(result.data?.arch).toBeDefined();
      expect(result.data?.totalMemory).toBeDefined();
      expect(result.data?.cpuCount).toBe(4);
    });
  });
  
  describe('getNetworkInfo', () => {
    it('should get network info successfully', async () => {
      const result = await configManager.getNetworkInfo();
      expect(result.data?.isOnline).toBeDefined();
      expect(result.data?.networkType).toBeDefined();
      expect(result.data?.ipAddress).toBeDefined();
    });
  });
  
  describe('autoAdjustConfig', () => {
    it('should auto adjust config successfully', async () => {
      const result = await configManager.autoAdjustConfig();
      expect(result.data?.config).toBeDefined();
      expect(result.data?.config.platform).toBeDefined();
      expect(result.data?.config.network).toBeDefined();
      expect(result.data?.config.cpu).toBeDefined();
    });
  });
  
  describe('detectEnvironmentChanges', () => {
    it('should detect environment changes', async () => {
      // 第一次获取环境信息
      await configManager.getSystemInfo();
      await configManager.getNetworkInfo();
      
      // 第二次获取环境信息，检测变化
      const result = await configManager.detectEnvironmentChanges();
      expect(result.data?.changed).toBeDefined();
      expect(result.data?.changes).toBeDefined();
    });
  });
  
  describe('applyConfig', () => {
    it('should apply config successfully', async () => {
      const config = {
        network: {
          timeout: 5000,
          retryCount: 1,
        },
      };
      
      const result = await configManager.applyConfig(config);
      expect(result.data).toBeUndefined();
      expect(result.message).toBe('Config applied successfully');
    });
  });
  
  describe('resetConfig', () => {
    it('should reset config to default', async () => {
      const result = await configManager.resetConfig();
      expect(result.data?.config).toBeDefined();
      expect(result.data?.config.network).toBeDefined();
      expect(result.data?.config.cpu).toBeDefined();
    });
  });
  
  describe('getRecommendedConfig', () => {
    it('should get recommended config successfully', async () => {
      const result = await configManager.getRecommendedConfig();
      expect(result.data?.config).toBeDefined();
      expect(result.data?.config.performance).toBeDefined();
      expect(result.data?.config.network).toBeDefined();
      expect(result.data?.config.platform).toBeDefined();
    });
  });
});
