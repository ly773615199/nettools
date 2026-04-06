import type { ApiResponse } from '../types';

// 加密选项接口
export interface EncryptionOptions {
  algorithm?: string;
  keyLength?: number;
  ivLength?: number;
}

// 加密服务类
export class EncryptionService {
  private key: Buffer;
  private algorithm: string;
  private keyLength: number;
  private ivLength: number;
  
  constructor(options: EncryptionOptions = {}) {
    this.algorithm = options.algorithm || 'aes-256-cbc';
    this.keyLength = options.keyLength || 32; // 256 bits
    this.ivLength = options.ivLength || 16; // 128 bits
    
    // 生成或加载密钥
    this.key = this.generateKey();
  }
  
  // 生成密钥
  private generateKey(): Buffer {
    try {
      // 在实际应用中，应该从安全的地方获取密钥，比如环境变量或密钥管理服务
      // 这里为了演示，生成一个随机密钥
      const crypto = require('crypto');
      return crypto.randomBytes(this.keyLength);
    } catch (error) {
      console.error('Error generating key:', error);
      //  fallback to a default key (not secure for production)
      return Buffer.from('default-secret-key-for-development-only', 'utf8');
    }
  }
  
  // 加密数据
  async encrypt(data: string): Promise<ApiResponse<string>> {
    try {
      const crypto = require('crypto');
      
      // 生成初始化向量
      const iv = crypto.randomBytes(this.ivLength);
      
      // 创建加密器
      const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
      
      // 加密数据
      let encrypted = cipher.update(data, 'utf8', 'base64');
      encrypted += cipher.final('base64');
      
      // 将初始化向量和加密数据组合
      const result = `${iv.toString('base64')}:${encrypted}`;
      
      return {
        data: result,
      };
    } catch (error) {
      console.error('Error encrypting data:', error);
      return {
        data: undefined,
        error: error instanceof Error ? error.message : 'Failed to encrypt data',
      };
    }
  }
  
  // 解密数据
  async decrypt(encryptedData: string): Promise<ApiResponse<string>> {
    try {
      const crypto = require('crypto');
      
      // 分离初始化向量和加密数据
      const parts = encryptedData.split(':');
      if (parts.length !== 2) {
        return {
          data: undefined,
          error: 'Invalid encrypted data format',
        };
      }
      
      const iv = Buffer.from(parts[0], 'base64');
      const encrypted = parts[1];
      
      // 创建解密器
      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
      
      // 解密数据
      let decrypted = decipher.update(encrypted, 'base64', 'utf8');
      decrypted += decipher.final('utf8');
      
      return {
        data: decrypted,
      };
    } catch (error) {
      console.error('Error decrypting data:', error);
      return {
        data: undefined,
        error: error instanceof Error ? error.message : 'Failed to decrypt data',
      };
    }
  }
  
  // 加密对象
  async encryptObject(obj: any): Promise<ApiResponse<string>> {
    try {
      // 将对象转换为JSON字符串
      const data = JSON.stringify(obj);
      // 加密JSON字符串
      return this.encrypt(data);
    } catch (error) {
      console.error('Error encrypting object:', error);
      return {
        data: undefined,
        error: error instanceof Error ? error.message : 'Failed to encrypt object',
      };
    }
  }
  
  // 解密对象
  async decryptObject(encryptedData: string): Promise<ApiResponse<any>> {
    try {
      // 解密数据
      const result = await this.decrypt(encryptedData);
      if (!result.data) {
        return {
          data: undefined,
          error: result.error || 'Failed to decrypt data',
        };
      }
      
      // 将JSON字符串转换为对象
      const obj = JSON.parse(result.data);
      return {
        data: obj,
      };
    } catch (error) {
      console.error('Error decrypting object:', error);
      return {
        data: undefined,
        error: error instanceof Error ? error.message : 'Failed to decrypt object',
      };
    }
  }
  
  // 生成哈希
  async generateHash(data: string): Promise<ApiResponse<string>> {
    try {
      const crypto = require('crypto');
      
      // 生成SHA-256哈希
      const hash = crypto.createHash('sha256');
      hash.update(data);
      const result = hash.digest('hex');
      
      return {
        data: result,
      };
    } catch (error) {
      console.error('Error generating hash:', error);
      return {
        data: undefined,
        error: error instanceof Error ? error.message : 'Failed to generate hash',
      };
    }
  }
  
  // 验证哈希
  async verifyHash(data: string, hash: string): Promise<ApiResponse<boolean>> {
    try {
      // 生成数据的哈希
      const result = await this.generateHash(data);
      if (!result.data) {
        return {
          data: undefined,
          error: result.error || 'Failed to generate hash',
        };
      }
      
      // 比较哈希
      const isMatch = result.data === hash;
      return {
        data: isMatch,
      };
    } catch (error) {
      console.error('Error verifying hash:', error);
      return {
        data: undefined,
        error: error instanceof Error ? error.message : 'Failed to verify hash',
      };
    }
  }
  
  // 生成随机字符串
  async generateRandomString(length: number): Promise<ApiResponse<string>> {
    try {
      const crypto = require('crypto');
      
      // 生成随机字符串
      const result = crypto.randomBytes(Math.ceil(length / 2))
        .toString('hex')
        .slice(0, length);
      
      return {
        data: result,
      };
    } catch (error) {
      console.error('Error generating random string:', error);
      return {
        data: undefined,
        error: error instanceof Error ? error.message : 'Failed to generate random string',
      };
    }
  }
  
  // 加密文件
  async encryptFile(filePath: string, outputPath: string): Promise<ApiResponse<void>> {
    try {
      const fs = require('fs');
      const crypto = require('crypto');
      
      // 生成初始化向量
      const iv = crypto.randomBytes(this.ivLength);
      
      // 创建加密器
      const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
      
      // 创建输入流和输出流
      const input = fs.createReadStream(filePath);
      const output = fs.createWriteStream(outputPath);
      
      // 写入初始化向量
      output.write(iv);
      
      // 管道加密
      input.pipe(cipher).pipe(output);
      
      return new Promise((resolve) => {
        output.on('finish', () => {
          resolve({
            data: undefined,
            message: 'File encrypted successfully',
          });
        });
        
        output.on('error', (error: Error) => {
          console.error('Error encrypting file:', error);
          resolve({
            data: undefined,
            error: error.message,
          });
        });
      });
    } catch (error) {
      console.error('Error encrypting file:', error);
      return {
        data: undefined,
        error: error instanceof Error ? error.message : 'Failed to encrypt file',
      };
    }
  }
  
  // 解密文件
  async decryptFile(filePath: string, outputPath: string): Promise<ApiResponse<void>> {
    try {
      const fs = require('fs');
      const crypto = require('crypto');
      
      // 读取初始化向量
      const iv = Buffer.alloc(this.ivLength);
      const input = fs.createReadStream(filePath);
      
      // 先读取初始化向量
      await new Promise((resolve, reject) => {
        input.on('data', (chunk: Buffer) => {
          chunk.copy(iv);
          input.pause();
          resolve(undefined);
        });
        
        input.on('error', (error: Error) => {
          reject(error);
        });
      });
      
      // 创建解密器
      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
      
      // 创建输出流
      const output = fs.createWriteStream(outputPath);
      
      // 管道解密
      input.pipe(decipher).pipe(output);
      
      return new Promise((resolve) => {
        output.on('finish', () => {
          resolve({
            data: undefined,
            message: 'File decrypted successfully',
          });
        });
        
        output.on('error', (error: Error) => {
          console.error('Error decrypting file:', error);
          resolve({
            data: undefined,
            error: error.message,
          });
        });
      });
    } catch (error) {
      console.error('Error decrypting file:', error);
      return {
        data: undefined,
        error: error instanceof Error ? error.message : 'Failed to decrypt file',
      };
    }
  }
  
  // 加密存储数据
  async encryptStorageData(key: string, data: any): Promise<ApiResponse<void>> {
    try {
      // 加密数据
      const result = await this.encryptObject(data);
      if (!result.data) {
        return {
          data: undefined,
          error: result.error || 'Failed to encrypt data',
        };
      }
      
      // 存储加密后的数据
      localStorage.setItem(key, result.data);
      
      return {
        data: undefined,
        message: 'Data encrypted and stored successfully',
      };
    } catch (error) {
      console.error('Error encrypting storage data:', error);
      return {
        data: undefined,
        error: error instanceof Error ? error.message : 'Failed to encrypt storage data',
      };
    }
  }
  
  // 解密存储数据
  async decryptStorageData(key: string): Promise<ApiResponse<any>> {
    try {
      // 获取加密后的数据
      const encryptedData = localStorage.getItem(key);
      if (!encryptedData) {
        return {
          data: undefined,
          error: 'No data found for the given key',
        };
      }
      
      // 解密数据
      const result = await this.decryptObject(encryptedData);
      if (!result.data) {
        return {
          data: undefined,
          error: result.error || 'Failed to decrypt data',
        };
      }
      
      return {
        data: result.data,
      };
    } catch (error) {
      console.error('Error decrypting storage data:', error);
      return {
        data: undefined,
        error: error instanceof Error ? error.message : 'Failed to decrypt storage data',
      };
    }
  }
  
  // 清除加密存储数据
  async clearEncryptedStorage(key: string): Promise<ApiResponse<void>> {
    try {
      // 清除存储的数据
      localStorage.removeItem(key);
      
      return {
        data: undefined,
        message: 'Encrypted storage data cleared successfully',
      };
    } catch (error) {
      console.error('Error clearing encrypted storage:', error);
      return {
        data: undefined,
        error: error instanceof Error ? error.message : 'Failed to clear encrypted storage',
      };
    }
  }
}

// 导出加密服务实例
export const encryptionService = new EncryptionService();
