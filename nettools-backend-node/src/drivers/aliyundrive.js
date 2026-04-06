/**
 * 阿里云盘驱动
 * 基于阿里云盘 Open API
 * 文档: https://www.yuque.com/aliyundrive/zpfszx
 */
const { BaseDriver } = require('./interface');
const path = require('path');
const https = require('https');
const http = require('http');

const API_BASE = 'https://openapi.alipan.com';
const AUTH_API = 'https://auth.alipan.com';

/** 发送 HTTP 请求 */
function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const lib = parsedUrl.protocol === 'https:' ? https : http;
    const reqOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: options.headers || {},
    };
    const req = lib.request(reqOptions, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

class AliyunDriveDriver extends BaseDriver {
  constructor(config = {}) {
    super(config);
    this.name = 'Aliyun Drive';
    this.type = 'aliyundrive';
    this.accessToken = '';
    this.tokenExpire = 0;
    this.driveId = config.driveId || '';
  }

  async init() {
    if (!this.config.refreshToken) {
      throw new Error('AliyunDrive config error: refreshToken is required');
    }
    await this._refreshToken();
  }

  /** 刷新 access_token */
  async _refreshToken() {
    const resp = await request(`${AUTH_API}/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: this.config.clientId || '',
        client_secret: this.config.clientSecret || '',
        grant_type: 'refresh_token',
        refresh_token: this.config.refreshToken,
      }),
    });

    if (resp.status !== 200 || resp.data.error) {
      throw new Error(`AliyunDrive token refresh failed: ${resp.data.error_description || resp.data.error || 'unknown'}`);
    }

    this.accessToken = resp.data.access_token;
    this.tokenExpire = Date.now() + (resp.data.expires_in - 60) * 1000; // 提前60秒刷新
    this.driveId = resp.data.drive_id || this.driveId || '';
  }

  /** 确保 token 有效 */
  async _ensureToken() {
    if (!this.accessToken || Date.now() >= this.tokenExpire) {
      await this._refreshToken();
    }
  }

  /** 发送阿里云盘 API 请求 */
  async _api(method, path, body = null) {
    await this._ensureToken();
    const opts = {
      method,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
    };
    if (body) opts.body = JSON.stringify(body);
    const resp = await request(`${API_BASE}${path}`, opts);
    if (resp.status === 401) {
      // token 过期，重试一次
      await this._refreshToken();
      opts.headers['Authorization'] = `Bearer ${this.accessToken}`;
      const retry = await request(`${API_BASE}${path}`, opts);
      return retry.data;
    }
    if (resp.status >= 400) {
      throw new Error(`AliyunDrive API error: ${resp.data.message || resp.data.code || resp.status}`);
    }
    return resp.data;
  }

  /** 获取文件/目录的 file_id */
  async _getFileId(targetPath) {
    if (targetPath === '/' || !targetPath) return this.driveId + ':root';
    const parts = targetPath.replace(/^\/+|\/+$/g, '').split('/');
    let parentId = 'root';
    for (const part of parts) {
      const resp = await this._api('POST', '/adrive/v1.0/openFile/search', {
        drive_id: this.driveId,
        query: `name = "${part}" and parent_file_id = "${parentId}"`,
      });
      if (!resp.items || resp.items.length === 0) {
        throw new Error(`Path not found: ${targetPath}`);
      }
      const match = resp.items.find(i => i.name === part);
      if (!match) throw new Error(`Path not found: ${targetPath}`);
      parentId = match.file_id;
    }
    return parentId;
  }

  /** 获取父目录的 file_id */
  async _getParentId(dirPath) {
    if (dirPath === '/' || !dirPath || dirPath === '') return 'root';
    return this._getFileId(dirPath.replace(/\/+$/, ''));
  }

  async list(dirPath = '/') {
    let parentId;
    try {
      parentId = await this._getParentId(dirPath);
    } catch (e) {
      return { data: [], total: 0 };
    }

    const items = [];
    let marker;

    do {
      const body = {
        drive_id: this.driveId,
        parent_file_id: parentId,
        limit: 100,
      };
      if (marker) body.marker = marker;

      const resp = await this._api('POST', '/adrive/v1.0/openFile/list', body);

      if (resp.items) {
        for (const item of resp.items) {
          const isDir = item.type === 'folder';
          items.push({
            name: item.name,
            type: isDir ? 'folder' : 'file',
            size: item.size || 0,
            modified: item.updated_at || item.created_at || null,
            path: path.posix.join(dirPath, item.name),
            extension: isDir ? null : path.extname(item.name).toLowerCase() || null,
            fileId: item.file_id,
          });
        }
      }
      marker = resp.next_marker;
    } while (marker);

    return { data: items, total: items.length };
  }

  async info(targetPath) {
    const fileId = await this._getFileId(targetPath);
    const resp = await this._api('POST', '/adrive/v1.0/openFile/get', {
      drive_id: this.driveId,
      file_id: fileId,
    });

    return {
      data: {
        name: resp.name,
        type: resp.type === 'folder' ? 'folder' : 'file',
        size: resp.size || 0,
        created: resp.created_at || null,
        modified: resp.updated_at || null,
        accessed: null,
        path: targetPath,
        permissions: null,
      },
    };
  }

  async link(filePath) {
    const fileId = await this._getFileId(filePath);
    const resp = await this._api('POST', '/adrive/v1.0/openFile/getDownloadUrl', {
      drive_id: this.driveId,
      file_id: fileId,
    });
    return { data: { url: resp.url, headers: {} } };
  }

  async mkdir(dirPath) {
    const dirName = path.basename(dirPath);
    const parentPath = path.dirname(dirPath);
    let parentId;
    try {
      parentId = await this._getParentId(parentPath);
    } catch {
      parentId = 'root';
    }

    const resp = await this._api('POST', '/adrive/v1.0/openFile/create', {
      drive_id: this.driveId,
      parent_file_id: parentId,
      name: dirName,
      type: 'folder',
      check_name_mode: 'refuse',
    });

    return { message: 'Folder created successfully', data: { path: dirPath, fileId: resp.file_id } };
  }

  async put(filePath, content, encoding) {
    const fileName = path.basename(filePath);
    const parentPath = path.dirname(filePath);
    let parentId;
    try {
      parentId = await this._getParentId(parentPath);
    } catch {
      parentId = 'root';
    }

    let body;
    if (typeof content === 'string') {
      body = Buffer.from(content, encoding || 'utf8');
    } else {
      body = Buffer.isBuffer(content) ? content : Buffer.from(content);
    }

    // 计算 content_hash（SHA-1）
    const crypto = require('crypto');
    const contentHash = crypto.createHash('sha1').update(body).digest('hex');

    // 创建文件（检查秒传）
    const createResp = await this._api('POST', '/adrive/v1.0/openFile/create', {
      drive_id: this.driveId,
      parent_file_id: parentId,
      name: fileName,
      type: 'file',
      size: body.length,
      content_hash: contentHash,
      content_hash_name: 'sha1',
      check_name_mode: 'refuse',
    });

    // rapid upload (秒传)
    if (createResp.rapid_upload) {
      return {
        message: 'File uploaded (rapid)',
        data: { path: filePath, size: body.length },
      };
    }

    // 上传分片
    if (createResp.part_info_list && createResp.part_info_list.length > 0) {
      for (const part of createResp.part_info_list) {
        await request(part.upload_url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: body,
        });
      }
    } else if (createResp.upload_url) {
      // 单文件直接上传
      await request(createResp.upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: body,
      });
    }

    // 完成上传
    if (createResp.upload_id) {
      await this._api('POST', '/adrive/v1.0/openFile/complete', {
        drive_id: this.driveId,
        file_id: createResp.file_id,
        upload_id: createResp.upload_id,
      });
    }

    return {
      message: 'File written successfully',
      data: { path: filePath, size: body.length },
    };
  }

  async readFile(filePath, encoding) {
    const linkResult = await this.link(filePath);
    const resp = await request(linkResult.data.url);
    const content = typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data);
    return {
      data: content,
      meta: { size: content.length, modified: null },
    };
  }

  async remove(targetPath) {
    const fileId = await this._getFileId(targetPath);
    await this._api('POST', '/adrive/v1.0/openFile/recycle', {
      drive_id: this.driveId,
      file_id: fileId,
    });
    return { message: 'Deleted successfully (moved to recycle)' };
  }

  async rename(srcPath, dstPath) {
    const fileId = await this._getFileId(srcPath);
    const newName = path.basename(dstPath);
    await this._api('POST', '/adrive/v1.0/openFile/update', {
      drive_id: this.driveId,
      file_id: fileId,
      name: newName,
    });
    return { message: 'Renamed successfully', data: { from: srcPath, to: dstPath } };
  }

  async copy(srcPath, dstPath) {
    const fileId = await this._getFileId(srcPath);
    const dstDir = path.dirname(dstPath);
    let parentId;
    try {
      parentId = await this._getParentId(dstDir);
    } catch {
      parentId = 'root';
    }

    await this._api('POST', '/adrive/v1.0/openFile/copy', {
      drive_id: this.driveId,
      file_id: fileId,
      to_parent_file_id: parentId,
      to_drive_id: this.driveId,
    });
    return { message: 'Copied successfully', data: { from: srcPath, to: dstPath } };
  }

  async exists(targetPath) {
    try {
      await this._getFileId(targetPath);
      return { data: { exists: true } };
    } catch {
      return { data: { exists: false } };
    }
  }

  async search(dirPath, keyword) {
    const resp = await this._api('POST', '/adrive/v1.0/openFile/search', {
      drive_id: this.driveId,
      query: `name match "${keyword}"`,
      limit: 100,
    });

    const items = (resp.items || []).map(item => ({
      name: item.name,
      type: item.type === 'folder' ? 'folder' : 'file',
      size: item.size || 0,
      path: '/' + (item.name || ''),
    }));

    return { data: items, total: items.length };
  }
}

AliyunDriveDriver.meta = {
  name: 'Aliyun Drive (阿里云盘)',
  description: '阿里云盘 Open API 驱动',
  configFields: [
    { name: 'refreshToken', label: 'Refresh Token', type: 'textarea', required: true, help: '阿里云盘 OAuth2 refresh_token' },
    { name: 'clientId', label: 'Client ID', type: 'text', required: false, help: '应用 AppId（可选）' },
    { name: 'clientSecret', label: 'Client Secret', type: 'password', required: false, help: '应用 Secret（可选）' },
    { name: 'driveId', label: 'Drive ID', type: 'text', required: false, help: '资源库 ID（自动获取可留空）' },
  ],
};

module.exports = { AliyunDriveDriver };
