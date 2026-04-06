import type { ApiResponse } from '../types';

// 资源类型
export type ResourceType = 'file' | 'network' | 'process' | 'memory' | 'storage';

// 资源状态
export type ResourceStatus = 'active' | 'idle' | 'error' | 'closed';

// 资源接口
export interface Resource {
  id: string;
  type: ResourceType;
  name: string;
  status: ResourceStatus;
  createdAt: string;
  lastAccessed: string;
  metadata: Record<string, any>;
  size: number;
}

// 资源限制接口
export interface ResourceLimits {
  maxFiles: number;
  maxNetworkConnections: number;
  maxProcesses: number;
  maxMemoryUsage: number; // MB
  maxStorageUsage: number; // MB
}

// 资源使用统计接口
export interface ResourceUsage {
  files: number;
  networkConnections: number;
  processes: number;
  memoryUsage: number; // MB
  storageUsage: number; // MB
}

// 资源管理服务类
export class ResourceManagerService {
  private resources: Map<string, Resource> = new Map();
  private limits: ResourceLimits;
  private usage: ResourceUsage;
  
  constructor(limits: Partial<ResourceLimits> = {}) {
    this.limits = {
      maxFiles: limits.maxFiles ?? 1000,
      maxNetworkConnections: limits.maxNetworkConnections ?? 100,
      maxProcesses: limits.maxProcesses ?? 50,
      maxMemoryUsage: limits.maxMemoryUsage ?? 8192, // 8GB
      maxStorageUsage: limits.maxStorageUsage ?? 512000, // 500GB
    };
    
    this.usage = {
      files: 0,
      networkConnections: 0,
      processes: 0,
      memoryUsage: 0,
      storageUsage: 0,
    };
  }
  
  // 注册资源
  async registerResource(type: ResourceType, name: string, metadata: Record<string, any> = {}, size: number = 1): Promise<ApiResponse<Resource>> {
    try {
      // 检查资源限制
      if (!this.checkResourceLimit(type, size)) {
        return {
          data: undefined,
          error: `Resource limit reached for ${type}`,
        };
      }
      
      // 创建资源
      const now = new Date().toISOString();
      const resource: Resource = {
        id: `resource-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type,
        name,
        status: 'active',
        createdAt: now,
        lastAccessed: now,
        metadata,
        size,
      };
      
      // 添加到资源列表
      this.resources.set(resource.id, resource);
      
      // 更新资源使用情况
      this.updateResourceUsage(type, size);
      
      return {
        data: resource,
        message: 'Resource registered successfully',
      };
    } catch (error) {
      console.error('Error registering resource:', error);
      return {
        data: undefined,
        error: error instanceof Error ? error.message : 'Failed to register resource',
      };
    }
  }
  
  // 注销资源
  async unregisterResource(resourceId: string): Promise<ApiResponse<void>> {
    try {
      const resource = this.resources.get(resourceId);
      if (!resource) {
        return {
          data: undefined,
          error: 'Resource not found',
        };
      }
      
      // 更新资源状态
      resource.status = 'closed';
      
      // 从资源列表中移除
      this.resources.delete(resourceId);
      
      // 更新资源使用情况
      this.updateResourceUsage(resource.type, -resource.size);
      
      return {
        data: undefined,
        message: 'Resource unregistered successfully',
      };
    } catch (error) {
      console.error('Error unregistering resource:', error);
      return {
        data: undefined,
        error: error instanceof Error ? error.message : 'Failed to unregister resource',
      };
    }
  }
  
  // 获取资源
  getResource(resourceId: string): ApiResponse<Resource> {
    const resource = this.resources.get(resourceId);
    if (!resource) {
      return {
        data: undefined,
        error: 'Resource not found',
      };
    }
    
    // 更新最后访问时间
    resource.lastAccessed = new Date().toISOString();
    
    return {
      data: resource,
    };
  }
  
  // 获取所有资源
  getResources(type?: ResourceType): ApiResponse<Resource[]> {
    let resources = Array.from(this.resources.values());
    
    if (type) {
      resources = resources.filter(resource => resource.type === type);
    }
    
    return {
      data: resources,
    };
  }
  
  // 更新资源状态
  async updateResourceStatus(resourceId: string, status: ResourceStatus): Promise<ApiResponse<Resource>> {
    try {
      const resource = this.resources.get(resourceId);
      if (!resource) {
        return {
          data: undefined,
          error: 'Resource not found',
        };
      }
      
      // 更新状态
      resource.status = status;
      resource.lastAccessed = new Date().toISOString();
      
      return {
        data: resource,
        message: 'Resource status updated successfully',
      };
    } catch (error) {
      console.error('Error updating resource status:', error);
      return {
        data: undefined,
        error: error instanceof Error ? error.message : 'Failed to update resource status',
      };
    }
  }
  
  // 更新资源元数据
  async updateResourceMetadata(resourceId: string, metadata: Record<string, any>): Promise<ApiResponse<Resource>> {
    try {
      const resource = this.resources.get(resourceId);
      if (!resource) {
        return {
          data: undefined,
          error: 'Resource not found',
        };
      }
      
      // 更新元数据
      resource.metadata = { ...resource.metadata, ...metadata };
      resource.lastAccessed = new Date().toISOString();
      
      return {
        data: resource,
        message: 'Resource metadata updated successfully',
      };
    } catch (error) {
      console.error('Error updating resource metadata:', error);
      return {
        data: undefined,
        error: error instanceof Error ? error.message : 'Failed to update resource metadata',
      };
    }
  }
  
  // 检查资源限制
  private checkResourceLimit(type: ResourceType, size: number = 1): boolean {
    switch (type) {
      case 'file':
        return this.usage.files < this.limits.maxFiles;
      case 'network':
        return this.usage.networkConnections < this.limits.maxNetworkConnections;
      case 'process':
        return this.usage.processes < this.limits.maxProcesses;
      case 'memory':
        return this.usage.memoryUsage + size < this.limits.maxMemoryUsage;
      case 'storage':
        return this.usage.storageUsage + size < this.limits.maxStorageUsage;
      default:
        return true;
    }
  }
  
  // 更新资源使用情况
  private updateResourceUsage(type: ResourceType, delta: number): void {
    switch (type) {
      case 'file':
        this.usage.files = Math.max(0, this.usage.files + delta);
        break;
      case 'network':
        this.usage.networkConnections = Math.max(0, this.usage.networkConnections + delta);
        break;
      case 'process':
        this.usage.processes = Math.max(0, this.usage.processes + delta);
        break;
      case 'memory':
        this.usage.memoryUsage = Math.max(0, this.usage.memoryUsage + delta);
        break;
      case 'storage':
        this.usage.storageUsage = Math.max(0, this.usage.storageUsage + delta);
        break;
    }
  }
  
  // 获取资源使用情况
  getResourceUsage(): ApiResponse<ResourceUsage> {
    return {
      data: this.usage,
    };
  }
  
  // 获取资源限制
  getResourceLimits(): ApiResponse<ResourceLimits> {
    return {
      data: this.limits,
    };
  }
  
  // 更新资源限制
  async updateResourceLimits(limits: Partial<ResourceLimits>): Promise<ApiResponse<ResourceLimits>> {
    try {
      this.limits = { ...this.limits, ...limits };
      
      return {
        data: this.limits,
        message: 'Resource limits updated successfully',
      };
    } catch (error) {
      console.error('Error updating resource limits:', error);
      return {
        data: undefined,
        error: error instanceof Error ? error.message : 'Failed to update resource limits',
      };
    }
  }
  
  // 清理闲置资源
  async cleanupIdleResources(): Promise<ApiResponse<number>> {
    try {
      const idleResources = Array.from(this.resources.values()).filter(
        resource => resource.status === 'idle'
      );
      
      const cleanedCount = idleResources.length;
      
      // 注销闲置资源
      for (const resource of idleResources) {
        await this.unregisterResource(resource.id);
      }
      
      return {
        data: cleanedCount,
        message: `${cleanedCount} idle resources cleaned up`,
      };
    } catch (error) {
      console.error('Error cleaning up idle resources:', error);
      return {
        data: undefined,
        error: error instanceof Error ? error.message : 'Failed to clean up idle resources',
      };
    }
  }
  
  // 清理错误资源
  async cleanupErrorResources(): Promise<ApiResponse<number>> {
    try {
      const errorResources = Array.from(this.resources.values()).filter(
        resource => resource.status === 'error'
      );
      
      const cleanedCount = errorResources.length;
      
      // 注销错误资源
      for (const resource of errorResources) {
        await this.unregisterResource(resource.id);
      }
      
      return {
        data: cleanedCount,
        message: `${cleanedCount} error resources cleaned up`,
      };
    } catch (error) {
      console.error('Error cleaning up error resources:', error);
      return {
        data: undefined,
        error: error instanceof Error ? error.message : 'Failed to clean up error resources',
      };
    }
  }
  
  // 清理所有资源
  async cleanupAllResources(): Promise<ApiResponse<number>> {
    try {
      const resourceCount = this.resources.size;
      
      // 注销所有资源
      for (const resourceId of this.resources.keys()) {
        await this.unregisterResource(resourceId);
      }
      
      return {
        data: resourceCount,
        message: `${resourceCount} resources cleaned up`,
      };
    } catch (error) {
      console.error('Error cleaning up all resources:', error);
      return {
        data: undefined,
        error: error instanceof Error ? error.message : 'Failed to clean up all resources',
      };
    }
  }
  
  // 获取资源使用统计
  async getResourceStatistics(): Promise<ApiResponse<{
    usage: ResourceUsage;
    limits: ResourceLimits;
    resourceCount: number;
    resourcesByType: Record<ResourceType, number>;
    resourcesByStatus: Record<ResourceStatus, number>;
  }>> {
    try {
      // 按类型统计资源
      const resourcesByType: Record<ResourceType, number> = {
        file: 0,
        network: 0,
        process: 0,
        memory: 0,
        storage: 0,
      };
      
      // 按状态统计资源
      const resourcesByStatus: Record<ResourceStatus, number> = {
        active: 0,
        idle: 0,
        error: 0,
        closed: 0,
      };
      
      for (const resource of this.resources.values()) {
        resourcesByType[resource.type]++;
        resourcesByStatus[resource.status]++;
      }
      
      return {
        data: {
          usage: this.usage,
          limits: this.limits,
          resourceCount: this.resources.size,
          resourcesByType,
          resourcesByStatus,
        },
      };
    } catch (error) {
      console.error('Error getting resource statistics:', error);
      return {
        data: undefined,
        error: error instanceof Error ? error.message : 'Failed to get resource statistics',
      };
    }
  }
  
  // 检查资源泄漏
  async checkResourceLeaks(): Promise<ApiResponse<Resource[]>> {
    try {
      // 检查长时间闲置的资源
      const now = new Date();
      const idleThreshold = 5 * 60 * 1000; // 5 minutes
      
      const leakedResources = Array.from(this.resources.values()).filter(resource => {
        const lastAccessed = new Date(resource.lastAccessed);
        const idleTime = now.getTime() - lastAccessed.getTime();
        return resource.status === 'idle' && idleTime > idleThreshold;
      });
      
      return {
        data: leakedResources,
        message: `${leakedResources.length} potential resource leaks found`,
      };
    } catch (error) {
      console.error('Error checking resource leaks:', error);
      return {
        data: undefined,
        error: error instanceof Error ? error.message : 'Failed to check resource leaks',
      };
    }
  }
  
  // 优化资源使用
  async optimizeResourceUsage(): Promise<ApiResponse<void>> {
    try {
      // 清理闲置资源
      await this.cleanupIdleResources();
      
      // 清理错误资源
      await this.cleanupErrorResources();
      
      return {
        data: undefined,
        message: 'Resource usage optimized successfully',
      };
    } catch (error) {
      console.error('Error optimizing resource usage:', error);
      return {
        data: undefined,
        error: error instanceof Error ? error.message : 'Failed to optimize resource usage',
      };
    }
  }
}

// 导出资源管理服务实例
export const resourceManagerService = new ResourceManagerService();
