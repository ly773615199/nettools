import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StorageServiceManager, LocalStorageDriver } from '../src/core/storage/storageService';
import { OpenListService } from '../src/core/storage/openlistService';
import { NetworkMonitorService } from '../src/core/network/networkMonitorService';
import { BoreService } from '../src/core/network/boreService';
import { ClashService } from '../src/core/network/clashService';
import { VpnService } from '../src/core/network/vpnService';
import { ServiceStatusService } from '../src/core/services/serviceStatusService';
import { ConfigManagerService } from '../src/core/config/configManagerService';
import { EncryptionService } from '../src/core/security/encryptionService';
import { PerformanceService } from '../src/core/performance/performanceService';
import { ResourceManagerService } from '../src/core/resources/resourceManagerService';

describe('Integration Tests', () => {
  let storageService: StorageServiceManager;
  let openListService: OpenListService;
  let networkMonitorService: NetworkMonitorService;
  let boreService: BoreService;
  let clashService: ClashService;
  let vpnService: VpnService;
  let serviceStatusService: ServiceStatusService;
  let configManagerService: ConfigManagerService;
  let encryptionService: EncryptionService;
  let performanceService: PerformanceService;
  let resourceManagerService: ResourceManagerService;
  
  beforeEach(() => {
    // 初始化服务
    storageService = new StorageServiceManager();
    openListService = new OpenListService();
    networkMonitorService = new NetworkMonitorService();
    boreService = new BoreService();
    clashService = new ClashService();
    vpnService = new VpnService();
    serviceStatusService = new ServiceStatusService();
    configManagerService = new ConfigManagerService();
    encryptionService = new EncryptionService();
    performanceService = new PerformanceService();
    resourceManagerService = new ResourceManagerService();
    
    // 清除所有模拟
    vi.clearAllMocks();
  });
  
  describe('Storage and OpenList Integration', () => {
    it('should list files through OpenList service', async () => {
      // 注册本地存储驱动
      const localDriver = new LocalStorageDriver({ id: 'local', name: 'Local Storage', path: '/' });
      storageService.register(localDriver);
      
      // 连接存储驱动
      await storageService.connect('local');
      
      // 通过OpenList服务列出文件
      const result = await openListService.listFiles('local', '/test');
      expect(result.data).toBeDefined();
    });
  });
  
  describe('Network Services Integration', () => {
    it('should test connection and create tunnel', async () => {
      // 测试网络连接
      const connectionResult = await networkMonitorService.testConnection('https://example.com');
      expect(connectionResult.data).toBeDefined();
      
      // 创建隧道
      const tunnelResult = await boreService.createTunnel({ localPort: 8080, remotePort: 8081 });
      expect(tunnelResult.data).toBeDefined();
    });
  });
  
  describe('Security and Storage Integration', () => {
    it('should encrypt and store data', async () => {
      // 加密数据
      const sensitiveData = { username: 'testuser', password: 'testpass' };
      const encryptedResult = await encryptionService.encryptObject(sensitiveData);
      expect(encryptedResult.data).toBeDefined();
      
      // 存储加密数据
      if (encryptedResult.data) {
        const storeResult = await encryptionService.encryptStorageData('userCredentials', sensitiveData);
        expect(storeResult.message).toBe('Data encrypted and stored successfully');
        
        // 读取并解密数据
        const retrieveResult = await encryptionService.decryptStorageData('userCredentials');
        expect(retrieveResult.data?.username).toBe('testuser');
        expect(retrieveResult.data?.password).toBe('testpass');
      }
    });
  });
  
  describe('Performance and Resource Management Integration', () => {
    it('should collect performance metrics and optimize resources', async () => {
      // 收集性能指标
      const metricsResult = await performanceService.collectMetrics();
      expect(metricsResult.data?.memory).toBeDefined();
      expect(metricsResult.data?.cpu).toBeDefined();
      
      // 优化资源使用
      const optimizeResult = await resourceManagerService.optimizeResourceUsage();
      expect(optimizeResult.message).toBe('Resource usage optimized successfully');
    });
  });
  
  describe('Config and Service Status Integration', () => {
    it('should adjust config based on system info and check service status', async () => {
      // 获取系统信息
      const systemInfoResult = await configManagerService.getSystemInfo();
      expect(systemInfoResult.data?.platform).toBeDefined();
      
      // 自动调整配置
      const configResult = await configManagerService.autoAdjustConfig();
      expect(configResult.data?.config).toBeDefined();
      
      // 应用配置
      if (configResult.data?.config) {
        const applyResult = await configManagerService.applyConfig(configResult.data.config);
        expect(applyResult.message).toBe('Config applied successfully');
      }
      
      // 检查服务状态
      const statusResult = await serviceStatusService.getServiceStatus('storage-1');
      expect(statusResult.data?.status).toBeDefined();
    });
  });
  
  describe('Full System Integration', () => {
    it('should perform end-to-end operations', async () => {
      // 1. 注册资源
      const resourceResult = await resourceManagerService.registerResource('network', 'test-connection');
      expect(resourceResult.data?.id).toBeDefined();
      
      // 2. 测试网络连接
      const connectionResult = await networkMonitorService.testConnection('https://example.com');
      expect(connectionResult.data).toBeDefined();
      
      // 3. 收集性能指标
      const metricsResult = await performanceService.collectMetrics();
      expect(metricsResult.data?.network).toBeDefined();
      
      // 4. 获取性能建议
      const suggestionsResult = performanceService.getSuggestions();
      expect(suggestionsResult.data).toBeDefined();
      
      // 5. 优化性能
      const optimizeResult = await performanceService.optimizeAll();
      expect(optimizeResult.message).toBe('All performance optimizations completed');
      
      // 6. 清理资源
      if (resourceResult.data?.id) {
        const cleanupResult = await resourceManagerService.unregisterResource(resourceResult.data.id);
        expect(cleanupResult.message).toBe('Resource unregistered successfully');
      }
    });
  });
});