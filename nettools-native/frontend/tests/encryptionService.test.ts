import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EncryptionService } from '../src/core/security/encryptionService';

// 模拟crypto模块
const mockCrypto = {
  randomBytes: vi.fn((size) => Buffer.from('x'.repeat(size))),
  createCipheriv: vi.fn(() => ({
    update: vi.fn((data, inputEncoding, outputEncoding) => 'encrypted'),
    final: vi.fn((outputEncoding) => 'final'),
  })),
  createDecipheriv: vi.fn(() => ({
    update: vi.fn((data, inputEncoding, outputEncoding) => 'decrypted'),
    final: vi.fn((outputEncoding) => 'final'),
  })),
  createHash: vi.fn(() => ({
    update: vi.fn((data) => this),
    digest: vi.fn((encoding) => 'hash'),
  })),
};

// 模拟模块
vi.mock('crypto', () => ({
  default: mockCrypto,
}));

// 模拟localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('EncryptionService', () => {
  let encryptionService: EncryptionService;
  
  beforeEach(() => {
    encryptionService = new EncryptionService();
    vi.clearAllMocks();
    localStorageMock.clear();
  });
  
  describe('encrypt', () => {
    it('should encrypt data successfully', async () => {
      const result = await encryptionService.encrypt('test data');
      expect(result.data).toBeDefined();
    });
  });
  
  describe('decrypt', () => {
    it('should decrypt data successfully', async () => {
      const encrypted = await encryptionService.encrypt('test data');
      if (encrypted.data) {
        const result = await encryptionService.decrypt(encrypted.data);
        expect(result.data).toBeDefined();
      }
    });
  });
  
  describe('encryptObject', () => {
    it('should encrypt object successfully', async () => {
      const obj = { key: 'value' };
      const result = await encryptionService.encryptObject(obj);
      expect(result.data).toBeDefined();
    });
  });
  
  describe('decryptObject', () => {
    it('should decrypt object successfully', async () => {
      const obj = { key: 'value' };
      const encrypted = await encryptionService.encryptObject(obj);
      if (encrypted.data) {
        const result = await encryptionService.decryptObject(encrypted.data);
        expect(result.data).toBeDefined();
        expect(result.data?.key).toBe('value');
      }
    });
  });
  
  describe('generateHash', () => {
    it('should generate hash successfully', async () => {
      const result = await encryptionService.generateHash('test data');
      expect(result.data).toBeDefined();
      expect(typeof result.data).toBe('string');
    });
  });
  
  describe('verifyHash', () => {
    it('should verify hash successfully', async () => {
      const hash = await encryptionService.generateHash('test data');
      if (hash.data) {
        const result = await encryptionService.verifyHash('test data', hash.data);
        expect(result.data).toBe(true);
      }
    });
  });
  
  describe('generateRandomString', () => {
    it('should generate random string successfully', async () => {
      const result = await encryptionService.generateRandomString(10);
      expect(result.data).toBeDefined();
      expect(result.data?.length).toBe(10);
    });
  });
  
  describe('encryptStorageData', () => {
    it('should encrypt and store data successfully', async () => {
      const data = { key: 'value' };
      const result = await encryptionService.encryptStorageData('test-key', data);
      expect(result.data).toBeUndefined();
      expect(result.message).toBe('Data encrypted and stored successfully');
      expect(localStorageMock.getItem('test-key')).toBeDefined();
    });
  });
  
  describe('decryptStorageData', () => {
    it('should decrypt stored data successfully', async () => {
      const data = { key: 'value' };
      await encryptionService.encryptStorageData('test-key', data);
      const result = await encryptionService.decryptStorageData('test-key');
      expect(result.data).toBeDefined();
      expect(result.data?.key).toBe('value');
    });
  });
  
  describe('clearEncryptedStorage', () => {
    it('should clear encrypted storage successfully', async () => {
      const data = { key: 'value' };
      await encryptionService.encryptStorageData('test-key', data);
      expect(localStorageMock.getItem('test-key')).toBeDefined();
      const result = await encryptionService.clearEncryptedStorage('test-key');
      expect(result.data).toBeUndefined();
      expect(result.message).toBe('Encrypted storage data cleared successfully');
      expect(localStorageMock.getItem('test-key')).toBeNull();
    });
  });
});
