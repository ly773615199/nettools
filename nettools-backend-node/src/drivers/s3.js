/**
 * S3 存储驱动
 * 兼容 AWS S3、MinIO、阿里云 OSS、腾讯云 COS、Cloudflare R2
 */
const { BaseDriver } = require('./interface');
const {
  S3Client,
  ListObjectsV2Command,
  HeadObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  CopyObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const path = require('path');

const MULTIPART_THRESHOLD = 100 * 1024 * 1024; // 100MB
const PART_SIZE = 10 * 1024 * 1024; // 10MB per part

class S3Driver extends BaseDriver {
  constructor(config = {}) {
    super(config);
    this.name = 'S3';
    this.type = 's3';
    this.client = null;
    this.bucket = config.bucket || '';
    this.prefix = (config.root || config.prefix || '').replace(/^\/+|\/+$/g, '');
    this.region = config.region || 'us-east-1';
  }

  async init() {
    const { endpoint, accessKeyId, secretAccessKey, region, bucket } = this.config;
    if (!bucket) throw new Error('S3 config error: bucket is required');
    this.bucket = bucket;
    this.prefix = (this.config.root || this.config.prefix || '').replace(/^\/+|\/+$/g, '');
    this.region = region || 'us-east-1';

    const clientConfig = {
      region: this.region,
      credentials: {
        accessKeyId: accessKeyId || '',
        secretAccessKey: secretAccessKey || '',
      },
    };

    // 自定义 endpoint（MinIO/OSS/COS/R2）
    if (endpoint) {
      clientConfig.endpoint = endpoint;
      clientConfig.forcePathStyle = true; // 非 AWS 需要 path style
    }

    this.client = new S3Client(clientConfig);
  }

  async drop() {
    if (this.client) {
      this.client.destroy();
      this.client = null;
    }
  }

  /** 将用户路径转为 S3 key */
  _toKey(userPath) {
    const p = (userPath || '/').replace(/^\/+/, '');
    return this.prefix ? `${this.prefix}/${p}` : p;
  }

  /** 将 S3 key 转为用户路径 */
  _fromPath(key) {
    if (this.prefix && key.startsWith(this.prefix + '/')) {
      return '/' + key.slice(this.prefix.length + 1);
    }
    return '/' + key;
  }

  async list(dirPath = '/') {
    const prefix = this._toKey(dirPath === '/' ? '' : dirPath);
    const fullPrefix = prefix ? prefix + (prefix.endsWith('/') ? '' : '/') : '';

    const command = new ListObjectsV2Command({
      Bucket: this.bucket,
      Prefix: fullPrefix,
      Delimiter: '/',
      MaxKeys: 1000,
    });

    const response = await this.client.send(command);
    const items = [];

    // 目录（CommonPrefixes）
    if (response.CommonPrefixes) {
      for (const cp of response.CommonPrefixes) {
        const dirName = cp.Prefix.replace(fullPrefix, '').replace(/\/$/, '');
        if (dirName) {
          items.push({
            name: dirName,
            type: 'folder',
            size: 0,
            modified: null,
            path: path.posix.join(dirPath, dirName),
            extension: null,
          });
        }
      }
    }

    // 文件（Contents）
    if (response.Contents) {
      for (const obj of response.Contents) {
        if (obj.Key === fullPrefix) continue; // 跳过目录自身
        const fileName = obj.Key.replace(fullPrefix, '');
        if (!fileName || fileName.includes('/')) continue;
        items.push({
          name: fileName,
          type: 'file',
          size: obj.Size || 0,
          modified: obj.LastModified ? obj.LastModified.toISOString() : null,
          path: path.posix.join(dirPath, fileName),
          extension: path.extname(fileName).toLowerCase() || null,
        });
      }
    }

    return { data: items, total: items.length };
  }

  async info(targetPath) {
    const key = this._toKey(targetPath);
    try {
      const command = new HeadObjectCommand({ Bucket: this.bucket, Key: key });
      const response = await this.client.send(command);
      return {
        data: {
          name: path.basename(targetPath),
          type: 'file',
          size: response.ContentLength || 0,
          created: null,
          modified: response.LastModified ? response.LastModified.toISOString() : null,
          accessed: null,
          path: targetPath,
          permissions: null,
        },
      };
    } catch (err) {
      // 可能是目录，尝试 list
      const prefix = key.endsWith('/') ? key : key + '/';
      const listCmd = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
        MaxKeys: 1,
      });
      const listResp = await this.client.send(listCmd);
      if (listResp.Contents && listResp.Contents.length > 0) {
        return {
          data: {
            name: path.basename(targetPath),
            type: 'folder',
            size: 0,
            modified: null,
            path: targetPath,
          },
        };
      }
      throw new Error('File not found');
    }
  }

  async link(filePath) {
    const key = this._toKey(filePath);
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    const url = await getSignedUrl(this.client, command, { expiresIn: 3600 });
    return { data: { url, headers: {} } };
  }

  async put(filePath, content, encoding) {
    const key = this._toKey(filePath);
    let body;
    if (typeof content === 'string') {
      body = Buffer.from(content, encoding || 'utf8');
    } else {
      body = content;
    }

    // 大文件分片上传
    if (Buffer.isBuffer(body) && body.length > MULTIPART_THRESHOLD) {
      return await this._multipartUpload(key, body);
    }

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: body,
    });
    await this.client.send(command);
    return {
      message: 'File written successfully',
      data: { path: filePath, size: Buffer.isBuffer(body) ? body.length : 0 },
    };
  }

  async _multipartUpload(key, buffer) {
    const createCmd = new CreateMultipartUploadCommand({
      Bucket: this.bucket,
      Key: key,
    });
    const createResp = await this.client.send(createCmd);
    const uploadId = createResp.UploadId;

    try {
      const parts = [];
      const totalParts = Math.ceil(buffer.length / PART_SIZE);

      for (let i = 0; i < totalParts; i++) {
        const start = i * PART_SIZE;
        const end = Math.min(start + PART_SIZE, buffer.length);
        const partBody = buffer.slice(start, end);

        const uploadPartCmd = new UploadPartCommand({
          Bucket: this.bucket,
          Key: key,
          UploadId: uploadId,
          PartNumber: i + 1,
          Body: partBody,
        });
        const partResp = await this.client.send(uploadPartCmd);
        parts.push({ ETag: partResp.ETag, PartNumber: i + 1 });
      }

      const completeCmd = new CompleteMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: { Parts: parts },
      });
      await this.client.send(completeCmd);

      return {
        message: 'File written successfully (multipart)',
        data: { path: '/' + (this.prefix ? key.replace(this.prefix + '/', '') : key), size: buffer.length },
      };
    } catch (err) {
      const abortCmd = new AbortMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
      });
      await this.client.send(abortCmd).catch(() => {});
      throw err;
    }
  }

  async remove(targetPath) {
    const key = this._toKey(targetPath);

    // 先尝试作为文件删除
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
      return { message: 'Deleted successfully' };
    } catch (err) {
      // 可能是目录，批量删除
    }

    // 目录删除：列举所有前缀下的对象然后批量删除
    const prefix = key.endsWith('/') ? key : key + '/';
    let continuationToken;
    do {
      const listCmd = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      });
      const resp = await this.client.send(listCmd);
      if (resp.Contents) {
        for (const obj of resp.Contents) {
          await this.client.send(new DeleteObjectCommand({
            Bucket: this.bucket,
            Key: obj.Key,
          }));
        }
      }
      continuationToken = resp.NextContinuationToken;
    } while (continuationToken);

    return { message: 'Deleted successfully' };
  }

  async rename(srcPath, dstPath) {
    const srcKey = this._toKey(srcPath);
    const dstKey = this._toKey(dstPath);

    // S3 没有原生 rename，需要 copy + delete
    await this.client.send(new CopyObjectCommand({
      Bucket: this.bucket,
      Key: dstKey,
      CopySource: `${this.bucket}/${srcKey}`,
    }));
    await this.client.send(new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: srcKey,
    }));

    return { message: 'Renamed successfully', data: { from: srcPath, to: dstPath } };
  }

  async copy(srcPath, dstPath) {
    const srcKey = this._toKey(srcPath);
    const dstKey = this._toKey(dstPath);
    await this.client.send(new CopyObjectCommand({
      Bucket: this.bucket,
      Key: dstKey,
      CopySource: `${this.bucket}/${srcKey}`,
    }));
    return { message: 'Copied successfully', data: { from: srcPath, to: dstPath } };
  }

  async mkdir(dirPath) {
    const key = this._toKey(dirPath);
    const dirKey = key.endsWith('/') ? key : key + '/';
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: dirKey,
      Body: '',
    }));
    return { message: 'Folder created successfully', data: { path: dirPath } };
  }

  async exists(targetPath) {
    const key = this._toKey(targetPath);
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return { data: { exists: true } };
    } catch {
      // 检查是否为目录
      const prefix = key.endsWith('/') ? key : key + '/';
      const resp = await this.client.send(new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
        MaxKeys: 1,
      }));
      return { data: { exists: !!(resp.Contents && resp.Contents.length > 0) } };
    }
  }

  async search(dirPath, keyword) {
    const prefix = this._toKey(dirPath === '/' ? '' : dirPath);
    const results = [];
    let continuationToken;
    const kw = keyword.toLowerCase();

    do {
      const resp = await this.client.send(new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix || undefined,
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      }));
      if (resp.Contents) {
        for (const obj of resp.Contents) {
          const name = path.basename(obj.Key);
          if (name.toLowerCase().includes(kw)) {
            results.push({
              name,
              type: obj.Key.endsWith('/') ? 'folder' : 'file',
              size: obj.Size || 0,
              path: this._fromPath(obj.Key),
            });
          }
        }
      }
      continuationToken = resp.NextContinuationToken;
    } while (continuationToken);

    return { data: results, total: results.length };
  }

  // 兼容旧 API
  async writeFile(filePath, content, encoding) {
    return this.put(filePath, content, encoding);
  }

  async readFile(filePath) {
    const key = this._toKey(filePath);
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    const response = await this.client.send(command);
    const body = await response.Body.transformToString();
    return {
      data: body,
      meta: {
        size: response.ContentLength || 0,
        modified: response.LastModified ? response.LastModified.toISOString() : null,
      },
    };
  }
}

S3Driver.meta = {
  name: 'S3 / Object Storage',
  description: '兼容 AWS S3、MinIO、阿里云 OSS、腾讯云 COS、Cloudflare R2',
  configFields: [
    { name: 'endpoint', label: 'Endpoint', type: 'text', required: false, help: '自定义端点（如 MinIO: http://localhost:9000）' },
    { name: 'accessKeyId', label: 'Access Key ID', type: 'text', required: true },
    { name: 'secretAccessKey', label: 'Secret Access Key', type: 'password', required: true },
    { name: 'bucket', label: 'Bucket', type: 'text', required: true },
    { name: 'region', label: 'Region', type: 'text', required: false, default: 'us-east-1' },
    { name: 'prefix', label: 'Prefix', type: 'text', required: false, help: '存储前缀路径' },
  ],
};

module.exports = { S3Driver };
