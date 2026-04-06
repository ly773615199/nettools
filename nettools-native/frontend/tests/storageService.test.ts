import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StorageServiceManager, LocalStorageDriver } from '../src/core/storage/storageService';

describe('StorageServiceManager', () => {
  let storageService: StorageServiceManager;
  
  beforeEach(() => {
    storageService = new StorageServiceManager();
    vi.clearAllMocks();
  });
  
  describe('register', () => {
    it('should register a storage driver', () => {
      const driver = new LocalStorageDriver({ id: 'local', name: 'Local Storage', path: '/tmp' });
      storageService.register(driver);
      
      expect(storageService.get('local')).toBe(driver);
    });
  });
  
  describe('get', () => {
    it('should return the registered driver', () => {
      const driver = new LocalStorageDriver({ id: 'local', name: 'Local Storage', path: '/tmp' });
      storageService.register(driver);
      
      const result = storageService.get('local');
      expect(result).toBe(driver);
    });
    
    it('should return undefined when driver not found', () => {
      const result = storageService.get('non-existent');
      expect(result).toBeUndefined();
    });
  });
  
  describe('getAll', () => {
    it('should return all registered drivers', () => {
      const driver1 = new LocalStorageDriver({ id: 'local1', name: 'Local Storage 1', path: '/tmp1' });
      const driver2 = new LocalStorageDriver({ id: 'local2', name: 'Local Storage 2', path: '/tmp2' });
      storageService.register(driver1);
      storageService.register(driver2);
      
      const drivers = storageService.getAll();
      expect(drivers).toHaveLength(2);
      expect(drivers[0]).toBe(driver1);
      expect(drivers[1]).toBe(driver2);
    });
  });
  
  describe('connect', () => {
    it('should connect to storage driver successfully', async () => {
      const driver = new LocalStorageDriver({ id: 'local', name: 'Local Storage', path: '/tmp' });
      storageService.register(driver);
      
      const result = await storageService.connect('local');
      expect(result.data).toBeUndefined();
      expect(result.message).toBe('Connected successfully');
    });
    
    it('should handle driver not found', async () => {
      const result = await storageService.connect('non-existent');
      expect(result.data).toBeUndefined();
      expect(result.error).toBe('Storage driver not found');
    });
  });
  
  describe('disconnect', () => {
    it('should disconnect from storage driver successfully', async () => {
      const driver = new LocalStorageDriver({ id: 'local', name: 'Local Storage', path: '/tmp' });
      storageService.register(driver);
      await storageService.connect('local');
      
      const result = await storageService.disconnect('local');
      expect(result.data).toBeUndefined();
      expect(result.message).toBe('Disconnected successfully');
    });
    
    it('should handle driver not found', async () => {
      const result = await storageService.disconnect('non-existent');
      expect(result.data).toBeUndefined();
      expect(result.error).toBe('Storage driver not found');
    });
  });
});

describe('LocalStorageDriver', () => {
  let driver: LocalStorageDriver;
  
  beforeEach(() => {
    driver = new LocalStorageDriver({ id: 'local', name: 'Local Storage', path: '/tmp' });
    vi.clearAllMocks();
  });
  
  describe('list', () => {
    it('should return files successfully', async () => {
      const result = await driver.list('/test');
      expect(result.data).toHaveLength(2);
      expect(result.data?.[0].name).toBe('file1.txt');
      expect(result.data?.[1].name).toBe('folder1');
    });
  });
  
  describe('upload', () => {
    it('should upload file successfully', async () => {
      const mockFile = new File(['test content'], 'test.txt', { type: 'text/plain' });
      const result = await driver.upload('/test', mockFile);
      expect(result.data?.path).toBe('/test.txt');
      expect(result.message).toBe('File uploaded successfully');
    });
  });
  
  describe('download', () => {
    it('should download file successfully', async () => {
      const result = await driver.download('/test/file.txt');
      expect(result.data).toBeDefined();
      expect(result.data instanceof Blob).toBe(true);
    });
  });
  
  describe('delete', () => {
    it('should delete file successfully', async () => {
      const result = await driver.delete('/test/file.txt');
      expect(result.data).toBeUndefined();
      expect(result.message).toBe('File deleted successfully');
    });
  });
  
  describe('rename', () => {
    it('should rename file successfully', async () => {
      const result = await driver.rename('/test/old.txt', '/test/new.txt');
      expect(result.data).toBeUndefined();
      expect(result.message).toBe('File renamed successfully');
    });
  });
  
  describe('move', () => {
    it('should move file successfully', async () => {
      const result = await driver.move('/test/source.txt', '/dest/destination.txt');
      expect(result.data).toBeUndefined();
      expect(result.message).toBe('File moved successfully');
    });
  });
  
  describe('copy', () => {
    it('should copy file successfully', async () => {
      const result = await driver.copy('/test/source.txt', '/dest/destination.txt');
      expect(result.data).toBeUndefined();
      expect(result.message).toBe('File copied successfully');
    });
  });
  
  describe('createFolder', () => {
    it('should create folder successfully', async () => {
      const result = await driver.createFolder('/test/folder');
      expect(result.data).toBeUndefined();
      expect(result.message).toBe('Folder created successfully');
    });
  });
  
  describe('connect', () => {
    it('should connect successfully', async () => {
      const result = await driver.connect();
      expect(result.data).toBeUndefined();
      expect(result.message).toBe('Connected successfully');
      expect(driver.status).toBe('online');
    });
  });
  
  describe('disconnect', () => {
    it('should disconnect successfully', async () => {
      await driver.connect();
      const result = await driver.disconnect();
      expect(result.data).toBeUndefined();
      expect(result.message).toBe('Disconnected successfully');
      expect(driver.status).toBe('offline');
    });
  });
});
