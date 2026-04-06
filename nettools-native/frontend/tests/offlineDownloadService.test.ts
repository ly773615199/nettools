import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OfflineDownloadService } from '../src/core/storage/offlineDownloadService';

describe('OfflineDownloadService', () => {
  let downloadService: OfflineDownloadService;
  
  beforeEach(() => {
    downloadService = new OfflineDownloadService();
    vi.clearAllMocks();
  });
  
  describe('createDownloadTask', () => {
    it('should create download task successfully', () => {
      const url = 'https://example.com/file.zip';
      const targetPath = '/downloads';
      const storageServiceId = 'local';
      
      const task = downloadService.createDownloadTask(url, targetPath, storageServiceId);
      expect(task.id).toBeDefined();
      expect(task.url).toBe(url);
      expect(task.targetPath).toBe(targetPath);
      expect(task.storageServiceId).toBe(storageServiceId);
    });
  });
  
  describe('getDownloadTask', () => {
    it('should get download task successfully', () => {
      const url = 'https://example.com/file.zip';
      const targetPath = '/downloads';
      
      const task = downloadService.createDownloadTask(url, targetPath);
      const taskId = task.id;
      
      const retrievedTask = downloadService.getDownloadTask(taskId);
      expect(retrievedTask?.id).toBe(taskId);
      expect(retrievedTask?.url).toBe(url);
    });
    
    it('should return undefined for non-existent task', () => {
      const task = downloadService.getDownloadTask('non-existent');
      expect(task).toBeUndefined();
    });
  });
  
  describe('getDownloadTasks', () => {
    it('should return all download tasks', () => {
      const task1 = downloadService.createDownloadTask('https://example.com/file1.zip', '/downloads');
      const task2 = downloadService.createDownloadTask('https://example.com/file2.zip', '/downloads');
      
      const tasks = downloadService.getDownloadTasks();
      expect(tasks).toHaveLength(2);
      expect(tasks[0].id).toBe(task1.id);
      expect(tasks[1].id).toBe(task2.id);
    });
  });
  
  describe('startDownloadTask', () => {
    it('should start download task successfully', async () => {
      const task = downloadService.createDownloadTask('https://example.com/file.zip', '/downloads');
      const taskId = task.id;
      
      const result = await downloadService.startDownloadTask(taskId);
      expect(result.data?.status).toBe('downloading');
      expect(result.data?.id).toBe(taskId);
    });
    
    it('should handle task not found', async () => {
      const result = await downloadService.startDownloadTask('non-existent');
      expect(result.data).toBeUndefined();
      expect(result.error).toBe('Download task not found');
    });
  });
  
  describe('pauseDownloadTask', () => {
    it('should pause download task successfully', async () => {
      const task = downloadService.createDownloadTask('https://example.com/file.zip', '/downloads');
      const taskId = task.id;
      await downloadService.startDownloadTask(taskId);
      
      const result = downloadService.pauseDownloadTask(taskId);
      expect(result.data?.status).toBe('paused');
      expect(result.data?.id).toBe(taskId);
    });
    
    it('should handle task not found', () => {
      const result = downloadService.pauseDownloadTask('non-existent');
      expect(result.data).toBeUndefined();
      expect(result.error).toBe('Download task not found');
    });
  });
  
  describe('cancelDownloadTask', () => {
    it('should cancel download task successfully', () => {
      const task = downloadService.createDownloadTask('https://example.com/file.zip', '/downloads');
      const taskId = task.id;
      
      const result = downloadService.cancelDownloadTask(taskId);
      expect(result.data).toBe(true);
      expect(result.message).toBe('Download task cancelled');
    });
    
    it('should handle task not found', () => {
      const result = downloadService.cancelDownloadTask('non-existent');
      expect(result.data).toBe(false);
      expect(result.error).toBe('Download task not found');
    });
  });
  
  describe('startBatchDownloads', () => {
    it('should start batch downloads successfully', async () => {
      const urls = [
        'https://example.com/file1.zip',
        'https://example.com/file2.zip',
      ];
      const targetPath = '/downloads';
      const storageServiceId = 'local';
      
      const result = await downloadService.startBatchDownloads(urls, targetPath, storageServiceId);
      expect(result.data).toHaveLength(2);
      expect(result.data?.[0].url).toBe(urls[0]);
      expect(result.data?.[1].url).toBe(urls[1]);
    });
  });
});
