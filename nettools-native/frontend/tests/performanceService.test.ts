import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PerformanceService } from '../src/core/performance/performanceService';

// 模拟os模块
const mockOs = {
  cpus: vi.fn(() => Array(4).fill({})),
};

// 模拟模块
vi.mock('os', () => ({
  default: mockOs,
}));

describe('PerformanceService', () => {
  let performanceService: PerformanceService;
  
  beforeEach(() => {
    performanceService = new PerformanceService();
    vi.clearAllMocks();
  });
  
  describe('startMonitoring', () => {
    it('should start monitoring successfully', () => {
      const result = performanceService.startMonitoring();
      expect(result.data).toBeUndefined();
      expect(result.message).toBe('Performance monitoring started');
    });
  });
  
  describe('stopMonitoring', () => {
    it('should stop monitoring successfully', () => {
      performanceService.startMonitoring();
      const result = performanceService.stopMonitoring();
      expect(result.data).toBeUndefined();
      expect(result.message).toBe('Performance monitoring stopped');
    });
  });
  
  describe('collectMetrics', () => {
    it('should collect performance metrics successfully', async () => {
      const result = await performanceService.collectMetrics();
      expect(result.data?.memory).toBeDefined();
      expect(result.data?.cpu).toBeDefined();
      expect(result.data?.network).toBeDefined();
      expect(result.data?.render).toBeDefined();
      expect(result.data?.storage).toBeDefined();
    });
  });
  
  describe('getMetrics', () => {
    it('should get performance metrics successfully', async () => {
      await performanceService.collectMetrics();
      const result = performanceService.getMetrics();
      expect(result.data?.memory).toBeDefined();
      expect(result.data?.cpu).toBeDefined();
      expect(result.data?.network).toBeDefined();
      expect(result.data?.render).toBeDefined();
      expect(result.data?.storage).toBeDefined();
    });
  });
  
  describe('getSuggestions', () => {
    it('should get performance suggestions successfully', async () => {
      await performanceService.collectMetrics();
      const result = performanceService.getSuggestions();
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
    });
  });
  
  describe('optimizeMemory', () => {
    it('should optimize memory successfully', async () => {
      const result = await performanceService.optimizeMemory();
      expect(result.data).toBeUndefined();
      expect(result.message).toBe('Memory optimized successfully');
    });
  });
  
  describe('optimizeCpu', () => {
    it('should optimize CPU successfully', async () => {
      const result = await performanceService.optimizeCpu();
      expect(result.data).toBeUndefined();
      expect(result.message).toBe('CPU optimized successfully');
    });
  });
  
  describe('optimizeNetwork', () => {
    it('should optimize network successfully', async () => {
      const result = await performanceService.optimizeNetwork();
      expect(result.data).toBeUndefined();
      expect(result.message).toBe('Network optimized successfully');
    });
  });
  
  describe('optimizeRender', () => {
    it('should optimize render successfully', async () => {
      const result = await performanceService.optimizeRender();
      expect(result.data).toBeUndefined();
      expect(result.message).toBe('Render optimized successfully');
    });
  });
  
  describe('optimizeAll', () => {
    it('should optimize all performance aspects successfully', async () => {
      const result = await performanceService.optimizeAll();
      expect(result.data).toBeUndefined();
      expect(result.message).toBe('All performance optimizations completed');
    });
  });
  
  describe('getPerformanceReport', () => {
    it('should get performance report successfully', async () => {
      const result = await performanceService.getPerformanceReport();
      expect(result.data?.metrics).toBeDefined();
      expect(result.data?.suggestions).toBeDefined();
      expect(result.data?.timestamp).toBeDefined();
    });
  });
});
