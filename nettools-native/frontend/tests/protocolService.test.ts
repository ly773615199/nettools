import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProtocolService, ProtocolConfig } from '../src/core/storage/protocolService';

describe('ProtocolService', () => {
  let protocolService: ProtocolService;
  
  beforeEach(() => {
    protocolService = new ProtocolService();
    vi.clearAllMocks();
  });
  
  describe('getProtocolType', () => {
    it('should return http for http URLs', () => {
      expect(protocolService.getProtocolType('http://example.com')).toBe('http');
    });
    
    it('should return https for https URLs', () => {
      expect(protocolService.getProtocolType('https://example.com')).toBe('https');
    });
    
    it('should return ftp for ftp URLs', () => {
      expect(protocolService.getProtocolType('ftp://example.com')).toBe('ftp');
    });
    
    it('should return sftp for sftp URLs', () => {
      expect(protocolService.getProtocolType('sftp://example.com')).toBe('sftp');
    });
    
    it('should return s3 for s3 URLs', () => {
      expect(protocolService.getProtocolType('s3://bucket/path')).toBe('s3');
    });
    
    it('should return unknown for unknown protocols', () => {
      expect(protocolService.getProtocolType('unknown://example.com')).toBe('unknown');
    });
  });
  
  describe('buildUrl', () => {
    it('should build HTTP URL successfully', () => {
      const config: ProtocolConfig = {
        type: 'http',
        host: 'example.com',
      };
      const url = protocolService.buildUrl(config, '/path/file.txt');
      expect(url).toBe('http://example.com/path/file.txt');
    });
    
    it('should build FTP URL with credentials successfully', () => {
      const config: ProtocolConfig = {
        type: 'ftp',
        host: 'example.com',
        username: 'user',
        password: 'pass',
      };
      const url = protocolService.buildUrl(config, '/path/file.txt');
      expect(url).toBe('ftp://user:pass@example.com/path/file.txt');
    });
    
    it('should build S3 URL successfully', () => {
      const config: ProtocolConfig = {
        type: 's3',
        host: 'example.com',
        bucket: 'my-bucket',
      };
      const url = protocolService.buildUrl(config, '/path/file.txt');
      expect(url).toBe('s3://my-bucket/path/file.txt');
    });
  });
  
  describe('testConnection', () => {
    it('should test HTTP connection successfully', async () => {
      const config: ProtocolConfig = {
        type: 'http',
        host: 'example.com',
      };
      const result = await protocolService.testConnection(config);
      expect(result.data).toBe(true);
      expect(result.message).toBe('Connection test successful');
    });
    
    it('should test FTP connection successfully', async () => {
      const config: ProtocolConfig = {
        type: 'ftp',
        host: 'ftp.example.com',
        username: 'user',
        password: 'pass',
      };
      const result = await protocolService.testConnection(config);
      expect(result.data).toBe(true);
      expect(result.message).toBe('Connection test successful');
    });
  });
  
  describe('listFiles', () => {
    it('should list files successfully', async () => {
      const config: ProtocolConfig = {
        type: 'http',
        host: 'example.com',
      };
      const result = await protocolService.listFiles(config, '/path');
      expect(result.data).toHaveLength(2);
      expect(result.data?.[0].name).toBe('file1.txt');
      expect(result.data?.[1].name).toBe('folder1');
    });
  });
  
  describe('uploadFile', () => {
    it('should upload file successfully', async () => {
      const config: ProtocolConfig = {
        type: 'http',
        host: 'example.com',
      };
      const mockFile = new File(['test content'], 'test.txt', { type: 'text/plain' });
      const result = await protocolService.uploadFile(config, '/path', mockFile);
      expect(result.data?.path).toBe('/path/test.txt');
      expect(result.message).toBe('File uploaded successfully');
    });
  });
  
  describe('downloadFile', () => {
    it('should download file successfully', async () => {
      const config: ProtocolConfig = {
        type: 'http',
        host: 'example.com',
      };
      const result = await protocolService.downloadFile(config, '/path/file.txt');
      expect(result.data).toBeDefined();
      expect(result.data instanceof Blob).toBe(true);
    });
  });
  
  describe('deleteFile', () => {
    it('should delete file successfully', async () => {
      const config: ProtocolConfig = {
        type: 'http',
        host: 'example.com',
      };
      const result = await protocolService.deleteFile(config, '/path/file.txt');
      expect(result.data).toBeUndefined();
      expect(result.message).toBe('File deleted successfully');
    });
  });
});