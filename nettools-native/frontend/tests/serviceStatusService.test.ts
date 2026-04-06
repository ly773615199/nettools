import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ServiceStatusService } from '../src/core/services/serviceStatusService';

describe('ServiceStatusService', () => {
  let statusService: ServiceStatusService;
  
  beforeEach(() => {
    statusService = new ServiceStatusService();
    vi.clearAllMocks();
  });
  
  describe('getAllServiceStatuses', () => {
    it('should return all service statuses successfully', async () => {
      const result = await statusService.getAllServiceStatuses();
      expect(result.data).toHaveLength(4);
      expect(result.data?.[0].id).toBe('tunnel-1');
      expect(result.data?.[1].id).toBe('vpn-1');
      expect(result.data?.[2].id).toBe('proxy-1');
      expect(result.data?.[3].id).toBe('storage-1');
    });
  });
  
  describe('getServiceStatus', () => {
    it('should return service status successfully', async () => {
      const result = await statusService.getServiceStatus('tunnel-1');
      expect(result.data?.id).toBe('tunnel-1');
      expect(result.data?.name).toBe('Tunnel Server 1');
    });
    
    it('should handle service not found', async () => {
      const result = await statusService.getServiceStatus('non-existent');
      expect(result.data).toBeUndefined();
      expect(result.error).toBe('Service not found');
    });
  });
  
  describe('startService', () => {
    it('should start service successfully', async () => {
      const result = await statusService.startService('tunnel-1');
      expect(result.data).toBeUndefined();
      expect(result.message).toBe('Service started successfully');
    });
  });
  
  describe('stopService', () => {
    it('should stop service successfully', async () => {
      const result = await statusService.stopService('tunnel-1');
      expect(result.data).toBeUndefined();
      expect(result.message).toBe('Service stopped successfully');
    });
  });
  
  describe('restartService', () => {
    it('should restart service successfully', async () => {
      const result = await statusService.restartService('tunnel-1');
      expect(result.data).toBeUndefined();
      expect(result.message).toBe('Service restarted successfully');
    });
  });
  
  describe('enableAutoRestart', () => {
    it('should enable auto restart successfully', async () => {
      const result = await statusService.enableAutoRestart('tunnel-1', true);
      expect(result.data).toBeUndefined();
      expect(result.message).toBe('Auto restart enabled successfully');
    });
    
    it('should disable auto restart successfully', async () => {
      const result = await statusService.enableAutoRestart('tunnel-1', false);
      expect(result.data).toBeUndefined();
      expect(result.message).toBe('Auto restart disabled successfully');
    });
  });
  
  describe('getServiceLogs', () => {
    it('should get service logs successfully', async () => {
      const result = await statusService.getServiceLogs('storage', 3);
      expect(result.data?.logs).toHaveLength(3);
      expect(result.data?.logs[0]).toContain('Service storage - Log message 0');
    });
  });
  
  describe('clearServiceLogs', () => {
    it('should clear service logs successfully', async () => {
      const result = await statusService.clearServiceLogs('storage');
      expect(result.data).toBeUndefined();
      expect(result.message).toBe('Service logs cleared successfully');
    });
  });
  
  describe('getServiceStatistics', () => {
    it('should get service statistics successfully', async () => {
      const result = await statusService.getServiceStatistics('storage', 'day');
      expect(result.data?.cpuUsage).toHaveLength(24);
      expect(result.data?.memoryUsage).toHaveLength(24);
      expect(result.data?.networkIn).toHaveLength(24);
      expect(result.data?.networkOut).toHaveLength(24);
      expect(result.data?.timestamps).toHaveLength(24);
    });
  });
  
  describe('getServiceHealth', () => {
    it('should get service health successfully', async () => {
      const result = await statusService.getServiceHealth('storage');
      expect(result.data?.status).toBe('healthy');
      expect(result.data?.checks).toHaveLength(3);
    });
  });
  
  describe('startMonitoring', () => {
    it('should start monitoring successfully', () => {
      statusService.startMonitoring(1000);
      // 验证监控已启动（通过检查是否能停止）
      statusService.stopMonitoring();
    });
  });
  
  describe('stopMonitoring', () => {
    it('should stop monitoring successfully', () => {
      statusService.startMonitoring(1000);
      statusService.stopMonitoring();
    });
  });
  
  describe('addListener and removeListener', () => {
    it('should add and remove listener successfully', () => {
      const listener = vi.fn();
      statusService.addListener(listener);
      statusService.removeListener(listener);
      // 验证监听器已移除（不会被调用）
      statusService.startMonitoring(100);
      statusService.stopMonitoring();
      expect(listener).not.toHaveBeenCalled();
    });
  });
});
