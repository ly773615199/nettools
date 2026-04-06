/**
 * Google Drive 驱动
 * 基于 Google Drive API v3
 */
const { BaseDriver } = require('./interface');
const path = require('path');
const https = require('https');

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API_BASE = 'https://www.googleapis.com/drive/v3';

function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const reqOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: options.headers || {},
    };
    const req = https.request(reqOptions, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body), headers: res.headers });
        } catch {
          resolve({ status: res.statusCode, data: body, headers: res.headers });
        }
      });
    });
    req.on('error', reject);
    if (options.body) {
      if (typeof options.body === 'string') req.write(options.body);
      else req.write(options.body);
    }
    req.end();
  });
}

function multipartBody(metadata, content, boundary) {
  const parts = [];
  parts.push(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`);
  parts.push(`--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`);
  parts.push(content);
  parts.push(`\r\n--${boundary}--`);
  return Buffer.concat(parts.map(p => Buffer.isBuffer(p) ? p : Buffer.from(p)));
}

class GoogleDriveDriver extends BaseDriver {
  constructor(config = {}) {
    super(config);
    this.name = 'Google Drive';
    this.type = 'googledrive';
    this.accessToken = '';
    this.tokenExpire = 0;
  }

  async init() {
    if (!this.config.refreshToken && !this.config.serviceAccountKey) {
      throw new Error('GoogleDrive config error: refreshToken or serviceAccountKey is required');
    }
    if (this.config.refreshToken) {
      await this._refreshOAuthToken();
    } else {
      await this._refreshServiceAccountToken();
    }
  }

  async _refreshOAuthToken() {
    const resp = await request(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.config.clientId || '',
        client_secret: this.config.clientSecret || '',
        refresh_token: this.config.refreshToken,
        grant_type: 'refresh_token',
      }).toString(),
    });
    if (resp.status !== 200 || resp.data.error) {
      throw new Error(`GoogleDrive token refresh failed: ${resp.data.error_description || resp.data.error || 'unknown'}`);
    }
    this.accessToken = resp.data.access_token;
    this.tokenExpire = Date.now() + (resp.data.expires_in - 60) * 1000;
  }

  async _refreshServiceAccountToken() {
    const jwt = require('jsonwebtoken');
    const key = typeof this.config.serviceAccountKey === 'string'
      ? JSON.parse(this.config.serviceAccountKey)
      : this.config.serviceAccountKey;

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: key.client_email,
      scope: 'https://www.googleapis.com/auth/drive',
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    };
    const token = jwt.sign(payload, key.private_key, { algorithm: 'RS256' });

    const resp = await request(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: token,
      }).toString(),
    });

    if (resp.status !== 200 || resp.data.error) {
      throw new Error(`GoogleDrive service account token failed: ${resp.data.error_description || resp.data.error}`);
    }
    this.accessToken = resp.data.access_token;
    this.tokenExpire = Date.now() + (resp.data.expires_in - 60) * 1000;
  }

  async _ensureToken() {
    if (!this.accessToken || Date.now() >= this.tokenExpire) {
      if (this.config.refreshToken) await this._refreshOAuthToken();
      else await this._refreshServiceAccountToken();
    }
  }

  async _api(method, urlPath, body = null, extraHeaders = {}) {
    await this._ensureToken();
    const headers = {
      'Authorization': `Bearer ${this.accessToken}`,
      ...extraHeaders,
    };
    const opts = { method, headers };
    if (body) {
      if (typeof body === 'string') opts.body = body;
      else if (Buffer.isBuffer(body)) opts.body = body;
    }
    const resp = await request(`${API_BASE}${urlPath}`, opts);
    if (resp.status === 401) {
      if (this.config.refreshToken) await this._refreshOAuthToken();
      else await this._refreshServiceAccountToken();
      headers['Authorization'] = `Bearer ${this.accessToken}`;
      return (await request(`${API_BASE}${urlPath}`, { method, headers, body })).data;
    }
    if (resp.status >= 400) {
      throw new Error(`GoogleDrive API error: ${resp.data.error?.message || resp.status}`);
    }
    return resp.data;
  }

  /** 将用户路径解析为 file_id */
  async _getFileId(userPath) {
    if (!userPath || userPath === '/') return this.config.rootFolderId || 'root';
    const parts = userPath.split('/').filter(Boolean);
    let parentId = this.config.rootFolderId || 'root';

    for (const part of parts) {
      const resp = await this._api('GET',
        `/files?q=name='${encodeURIComponent(part)}' and '${parentId}' in parents and trashed=false&fields=files(id,name,mimeType)&pageSize=1`
      );
      if (!resp.files || resp.files.length === 0) {
        throw new Error(`Path not found: ${userPath}`);
      }
      parentId = resp.files[0].id;
    }
    return parentId;
  }

  async list(dirPath = '/') {
    let parentId;
    try {
      parentId = await this._getFileId(dirPath);
    } catch {
      return { data: [], total: 0 };
    }

    const resp = await this._api('GET',
      `/files?q='${parentId}' in parents and trashed=false&fields=files(id,name,mimeType,size,modifiedTime)&orderBy=folder,name&pageSize=100`
    );

    const items = (resp.files || []).map(f => ({
      name: f.name,
      type: f.mimeType === 'application/vnd.google-apps.folder' ? 'folder' : 'file',
      size: parseInt(f.size) || 0,
      modified: f.modifiedTime || null,
      path: path.posix.join(dirPath, f.name),
      extension: f.mimeType === 'application/vnd.google-apps.folder' ? null : path.extname(f.name).toLowerCase(),
    }));

    return { data: items, total: items.length };
  }

  async info(targetPath) {
    const fileId = await this._getFileId(targetPath);
    const f = await this._api('GET', `/files/${fileId}?fields=id,name,mimeType,size,createdTime,modifiedTime`);

    return {
      data: {
        name: f.name,
        type: f.mimeType === 'application/vnd.google-apps.folder' ? 'folder' : 'file',
        size: parseInt(f.size) || 0,
        created: f.createdTime || null,
        modified: f.modifiedTime || null,
        accessed: null,
        path: targetPath,
        permissions: null,
      },
    };
  }

  async link(filePath) {
    const fileId = await this._getFileId(filePath);
    // 直接下载链接
    const url = `${API_BASE}/files/${fileId}?alt=media`;
    await this._ensureToken();
    return { data: { url, headers: { 'Authorization': `Bearer ${this.accessToken}` } } };
  }

  async put(filePath, content, encoding) {
    const fileName = path.basename(filePath);
    let parentId;
    try {
      parentId = await this._getFileId(path.dirname(filePath));
    } catch {
      parentId = this.config.rootFolderId || 'root';
    }

    let body;
    if (typeof content === 'string') {
      body = Buffer.from(content, encoding || 'utf8');
    } else {
      body = Buffer.isBuffer(content) ? content : Buffer.from(content);
    }

    // 查找是否已有同名文件
    const existing = await this._api('GET',
      `/files?q=name='${encodeURIComponent(fileName)}' and '${parentId}' in parents and trashed=false&fields=files(id)&pageSize=1`
    );

    const boundary = 'nettools_boundary_' + Date.now();
    const metadata = existing.files?.length > 0
      ? {}
      : { name: fileName, parents: [parentId] };

    const uploadUrl = existing.files?.length > 0
      ? `/files/${existing.files[0].id}?uploadType=multipart&fields=id`
      : '/files?uploadType=multipart&fields=id';

    const multipart = multipartBody(metadata, body, boundary);

    await this._api('POST', `${uploadUrl}`, multipart, {
      'Content-Type': `multipart/related; boundary=${boundary}`,
    });

    return {
      message: 'File written successfully',
      data: { path: filePath, size: body.length },
    };
  }

  async readFile(filePath, encoding) {
    const linkResult = await this.link(filePath);
    const resp = await request(linkResult.data.url, { headers: linkResult.data.headers });
    const content = typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data);
    return { data: content, meta: { size: content.length, modified: null } };
  }

  async remove(targetPath) {
    const fileId = await this._getFileId(targetPath);
    await this._api('DELETE', `/files/${fileId}`);
    return { message: 'Deleted successfully' };
  }

  async rename(srcPath, dstPath) {
    const fileId = await this._getFileId(srcPath);
    const newName = path.basename(dstPath);
    await this._api('PATCH', `/files/${fileId}`, JSON.stringify({ name: newName }), {
      'Content-Type': 'application/json',
    });
    return { message: 'Renamed successfully', data: { from: srcPath, to: dstPath } };
  }

  async copy(srcPath, dstPath) {
    const fileId = await this._getFileId(srcPath);
    let parentId;
    try {
      parentId = await this._getFileId(path.dirname(dstPath));
    } catch {
      parentId = this.config.rootFolderId || 'root';
    }

    await this._api('POST', `/files/${fileId}/copy`, JSON.stringify({
      name: path.basename(dstPath),
      parents: [parentId],
    }), { 'Content-Type': 'application/json' });

    return { message: 'Copied successfully', data: { from: srcPath, to: dstPath } };
  }

  async mkdir(dirPath) {
    let parentId;
    try {
      parentId = await this._getFileId(path.dirname(dirPath));
    } catch {
      parentId = this.config.rootFolderId || 'root';
    }

    await this._api('POST', '/files', JSON.stringify({
      name: path.basename(dirPath),
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    }), { 'Content-Type': 'application/json' });

    return { message: 'Folder created successfully', data: { path: dirPath } };
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
    const resp = await this._api('GET',
      `/files?q=name contains '${encodeURIComponent(keyword)}' and trashed=false&fields=files(id,name,mimeType,size)&pageSize=100`
    );

    const items = (resp.files || []).map(f => ({
      name: f.name,
      type: f.mimeType === 'application/vnd.google-apps.folder' ? 'folder' : 'file',
      size: parseInt(f.size) || 0,
      path: '/' + f.name,
    }));

    return { data: items, total: items.length };
  }
}

GoogleDriveDriver.meta = {
  name: 'Google Drive',
  description: 'Google Drive API v3（OAuth2 或 Service Account）',
  configFields: [
    { name: 'clientId', label: 'Client ID', type: 'text', required: false },
    { name: 'clientSecret', label: 'Client Secret', type: 'password', required: false },
    { name: 'refreshToken', label: 'Refresh Token', type: 'textarea', required: false, help: 'OAuth2 refresh_token（与 Service Account 二选一）' },
    { name: 'serviceAccountKey', label: 'Service Account JSON', type: 'textarea', required: false, help: 'Service Account JSON 密钥（与 OAuth2 二选一）' },
    { name: 'rootFolderId', label: 'Root Folder ID', type: 'text', required: false, default: 'root', help: '根目录 ID（默认 root）' },
  ],
};

module.exports = { GoogleDriveDriver };
