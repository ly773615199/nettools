import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResourceManagerService } from '../src/core/resources/resourceManagerService';

describe('ResourceManagerService', () => {
  let resourceManager: ResourceManagerService;
  
  beforeEach(() => {
    resourceManager = new ResourceManagerService();
    vi.clearAllMocks();
  });
  
  describe('registerResource', () => {
    it('should register resource successfully', async () => {
      const result = await resourceManager.registerResource('file', 'test.txt', { path: '/test/test.txt' });
      expect(result.data?.id).toBeDefined();
      expect(result.data?.type).toBe('file');
      expect(result.data?.name).toBe('test.txt');
      expect(result.data?.status).toBe('active');
      expect(result.data?.size).toBe(1);
    });
  });
  
  describe('unregisterResource', () => {
    it('should unregister resource successfully', async () => {
      const registerResult = await resourceManager.registerResource('file', 'test.txt');
      const resourceId = registerResult.data?.id;
      
      if (resourceId) {
        const result = await resourceManager.unregisterResource(resourceId);
        expect(result.data).toBeUndefined();
        expect(result.message).toBe('Resource unregistered successfully');
      }
    });
    
    it('should handle resource not found', async () => {
      const result = await resourceManager.unregisterResource('non-existent');
      expect(result.data).toBeUndefined();
      expect(result.error).toBe('Resource not found');
    });
  });
  
  describe('getResource', () => {
    it('should get resource successfully', async () => {
      const registerResult = await resourceManager.registerResource('file', 'test.txt');
      const resourceId = registerResult.data?.id;
      
      if (resourceId) {
        const result = resourceManager.getResource(resourceId);
        expect(result.data?.id).toBe(resourceId);
        expect(result.data?.name).toBe('test.txt');
      }
    });
    
    it('should handle resource not found', () => {
      const result = resourceManager.getResource('non-existent');
      expect(result.data).toBeUndefined();
      expect(result.error).toBe('Resource not found');
    });
  });
  
  describe('getResources', () => {
    it('should get all resources', async () => {
      await resourceManager.registerResource('file', 'test1.txt');
      await resourceManager.registerResource('file', 'test2.txt');
      await resourceManager.registerResource('network', 'connection1');
      
      const result = resourceManager.getResources();
      expect(result.data).toHaveLength(3);
    });
    
    it('should get resources by type', async () => {
      await resourceManager.registerResource('file', 'test1.txt');
      await resourceManager.registerResource('file', 'test2.txt');
      await resourceManager.registerResource('network', 'connection1');
      
      const result = resourceManager.getResources('file');
      expect(result.data).toHaveLength(2);
      expect(result.data?.[0].type).toBe('file');
      expect(result.data?.[1].type).toBe('file');
    });
  });
  
  describe('updateResourceStatus', () => {
    it('should update resource status successfully', async () => {
      const registerResult = await resourceManager.registerResource('file', 'test.txt');
      const resourceId = registerResult.data?.id;
      
      if (resourceId) {
        const result = await resourceManager.updateResourceStatus(resourceId, 'idle');
        expect(result.data?.status).toBe('idle');
      }
    });
  });
  
  describe('updateResourceMetadata', () => {
    it('should update resource metadata successfully', async () => {
      const registerResult = await resourceManager.registerResource('file', 'test.txt');
      const resourceId = registerResult.data?.id;
      
      if (resourceId) {
        const result = await resourceManager.updateResourceMetadata(resourceId, { size: 100, type: 'text/plain' });
        expect(result.data?.metadata?.size).toBe(100);
        expect(result.data?.metadata?.type).toBe('text/plain');
      }
    });
  });
  
  describe('getResourceUsage', () => {
    it('should get resource usage successfully', () => {
      const result = resourceManager.getResourceUsage();
      expect(result.data?.files).toBeDefined();
      expect(result.data?.networkConnections).toBeDefined();
      expect(result.data?.processes).toBeDefined();
      expect(result.data?.memoryUsage).toBeDefined();
      expect(result.data?.storageUsage).toBeDefined();
    });
  });
  
  describe('getResourceLimits', () => {
    it('should get resource limits successfully', () => {
      const result = resourceManager.getResourceLimits();
      expect(result.data?.maxFiles).toBeDefined();
      expect(result.data?.maxNetworkConnections).toBeDefined();
      expect(result.data?.maxProcesses).toBeDefined();
      expect(result.data?.maxMemoryUsage).toBeDefined();
      expect(result.data?.maxStorageUsage).toBeDefined();
    });
  });
  
  describe('updateResourceLimits', () => {
    it('should update resource limits successfully', async () => {
      const limits = {
        maxFiles: 2000,
        maxNetworkConnections: 200,
      };
      
      const result = await resourceManager.updateResourceLimits(limits);
      expect(result.data?.maxFiles).toBe(2000);
      expect(result.data?.maxNetworkConnections).toBe(200);
    });
  });
  
  describe('cleanupIdleResources', () => {
    it('should cleanup idle resources successfully', async () => {
      const registerResult = await resourceManager.registerResource('file', 'test.txt');
      const resourceId = registerResult.data?.id;
      
      if (resourceId) {
        await resourceManager.updateResourceStatus(resourceId, 'idle');
        const result = await resourceManager.cleanupIdleResources();
        expect(result.data).toBe(1);
        expect(result.message).toBe('1 idle resources cleaned up');
      }
    });
  });
  
  describe('cleanupErrorResources', () => {
    it('should cleanup error resources successfully', async () => {
      const registerResult = await resourceManager.registerResource('file', 'test.txt');
      const resourceId = registerResult.data?.id;
      
      if (resourceId) {
        await resourceManager.updateResourceStatus(resourceId, 'error');
        const result = await resourceManager.cleanupErrorResources();
        expect(result.data).toBe(1);
        expect(result.message).toBe('1 error resources cleaned up');
      }
    });
  });
  
  describe('cleanupAllResources', () => {
    it('should cleanup all resources successfully', async () => {
      await resourceManager.registerResource('file', 'test1.txt');
      await resourceManager.registerResource('file', 'test2.txt');
      
      const result = await resourceManager.cleanupAllResources();
      expect(result.data).toBe(2);
      expect(result.message).toBe('2 resources cleaned up');
    });
  });
  
  describe('getResourceStatistics', () => {
    it('should get resource statistics successfully', async () => {
      await resourceManager.registerResource('file', 'test.txt');
      await resourceManager.registerResource('network', 'connection');
      
      const result = await resourceManager.getResourceStatistics();
      expect(result.data?.usage).toBeDefined();
      expect(result.data?.limits).toBeDefined();
      expect(result.data?.resourceCount).toBe(2);
      expect(result.data?.resourcesByType).toBeDefined();
      expect(result.data?.resourcesByStatus).toBeDefined();
    });
  });
  
  describe('checkResourceLeaks', () => {
    it('should check resource leaks successfully', async () => {
      const registerResult = await resourceManager.registerResource('file', 'test.txt');
      const resourceId = registerResult.data?.id;
      
      if (resourceId) {
        await resourceManager.updateResourceStatus(resourceId, 'idle');
        const result = await resourceManager.checkResourceLeaks();
        expect(result.data).toBeDefined();
        expect(Array.isArray(result.data)).toBe(true);
      }
    });
  });
  
  describe('optimizeResourceUsage', () => {
    it('should optimize resource usage successfully', async () => {
      const registerResult = await resourceManager.registerResource('file', 'test.txt');
      const resourceId = registerResult.data?.id;
      
      if (resourceId) {
        await resourceManager.updateResourceStatus(resourceId, 'idle');
        const result = await resourceManager.optimizeResourceUsage();
        expect(result.data).toBeUndefined();
        expect(result.message).toBe('Resource usage optimized successfully');
      }
    });
  });
});
