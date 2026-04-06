import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AliyunDriveDriver, OneDriveDriver, GoogleDriveDriver } from '../src/core/storage/storageDrivers';

describe('AliyunDriveDriver', () => {
  let driver: AliyunDriveDriver;
  
  beforeEach(() => {
    driver = new AliyunDriveDriver({ id: 'aliyun', name: 'Aliyun Drive', refreshToken: 'test-token' });
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

describe('OneDriveDriver', () => {
  let driver: OneDriveDriver;
  
  beforeEach(() => {
    driver = new OneDriveDriver({ id: 'onedrive', name: 'OneDrive', accessToken: 'test-token' });
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

describe('GoogleDriveDriver', () => {
  let driver: GoogleDriveDriver;
  
  beforeEach(() => {
    driver = new GoogleDriveDriver({ id: 'googledrive', name: 'Google Drive', accessToken: 'test-token' });
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
