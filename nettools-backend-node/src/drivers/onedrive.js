/**
 * OneDrive 驱动
 * 基于 Microsoft Graph API
 */
const { BaseDriver } = require('./interface');
const path = require('path');
const https = require('https');
const http = require('http');

const AUTH_BASE = 'https://login.microsoftonline.com/common/oauth2/v2.0';
const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

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
          resolve({ status: res.statusCode, data: JSON.parse(body), headers: res.headers });
        } catch {
          resolve({ status: res.statusCode, data: body, headers: res.headers });
        }
      });
    });
    req.on('error', reject);
    if (options.body) {
      if (typeof options.body === 'string') req.write(options.body);
      else req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

class OneDriveDriver extends BaseDriver {
  constructor(config = {}) {
    super(config);
    this.name = 'OneDrive';
    this.type = 'onedrive';
    this.accessToken = '';
    this.tokenExpire = 0;
  }

  async init() {
    if (!this.config.refreshToken) {
      throw new Error('OneDrive config error: refreshToken is required');
    }
    await this._refreshToken();
  }

  async _refreshToken() {
    const resp = await request(`${AUTH_BASE}/token`, {
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
      throw new Error(`OneDrive token refresh failed: ${resp.data.error_description || resp.data.error || 'unknown'}`);
    }

    this.accessToken = resp.data.access_token;
    this.tokenExpire = Date.now() + (resp.data.expires_in - 60) * 1000;
  }

  async _ensureToken() {
    if (!this.accessToken || Date.now() >= this.tokenExpire) {
      await this._refreshToken();
    }
  }

  async _api(method, urlPath, body = null, extraHeaders = {}) {
    await this._ensureToken();
    const headers = {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
      ...extraHeaders,
    };
    const opts = { method, headers };
    if (body) opts.body = body;

    const resp = await request(`${GRAPH_BASE}${urlPath}`, opts);
    if (resp.status === 401) {
      await this._refreshToken();
      headers['Authorization'] = `Bearer ${this.accessToken}`;
      return (await request(`${GRAPH_BASE}${urlPath}`, { method, headers, body })).data;
    }
    if (resp.status >= 400) {
      throw new Error(`OneDrive API error: ${resp.data.error?.message || resp.status}`);
    }
    return resp.data;
  }

  _pathToApi(userPath) {
    if (!userPath || userPath === '/') return '/me/drive/root';
    const encoded = userPath.split('/').filter(Boolean).map(encodeURIComponent).join('/');
    return `/me/drive/root:/${encoded}`;
  }

  async list(dirPath = '/') {
    const basePath = this._pathToApi(dirPath);
    const resp = await this._api('GET', `${basePath}/children?$top=200`);

    const items = (resp.value || []).map(item => ({
      name: item.name,
      type: item.folder ? 'folder' : 'file',
      size: item.size || 0,
      modified: item.lastModifiedDateTime || null,
      path: path.posix.join(dirPath, item.name),
      extension: item.file ? path.extname(item.name).toLowerCase() : null,
    }));

    return { data: items, total: items.length };
  }

  async info(targetPath) {
    const apiPath = this._pathToApi(targetPath);
    const item = await this._api('GET', apiPath);

    return {
      data: {
        name: item.name,
        type: item.folder ? 'folder' : 'file',
        size: item.size || 0,
        created: item.createdDateTime || null,
        modified: item.lastModifiedDateTime || null,
        accessed: null,
        path: targetPath,
        permissions: null,
      },
    };
  }

  async link(filePath) {
    const apiPath = this._pathToApi(filePath);
    const resp = await this._api('GET', `${apiPath}/content`);
    // resp is a 302 redirect URL
    return { data: { url: resp, headers: {} } };
  }

  async put(filePath, content, encoding) {
    const apiPath = this._pathToApi(filePath);
    let body;
    if (typeof content === 'string') {
      body = Buffer.from(content, encoding || 'utf8');
    } else {
      body = Buffer.isBuffer(content) ? content : Buffer.from(content);
    }

    // 小文件 (< 4MB) 直接上传
    if (body.length < 4 * 1024 * 1024) {
      await this._ensureToken();
      const resp = await request(`${GRAPH_BASE}${apiPath}:/content`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/octet-stream',
        },
        body: body,
      });
      if (resp.status >= 400) {
        throw new Error(`OneDrive upload failed: ${resp.data.error?.message || resp.status}`);
      }
    } else {
      // 大文件上传会话
      const session = await this._api('POST', `${apiPath}/createUploadSession`);
      const uploadUrl = session.uploadUrl;
      const chunkSize = 320 * 1024; // 320KB

      for (let start = 0; start < body.length; start += chunkSize) {
        const end = Math.min(start + chunkSize, body.length);
        const chunk = body.slice(start, end);

        await request(uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Range': `bytes ${start}-${end - 1}/${body.length}`,
            'Content-Length': String(chunk.length),
          },
          body: chunk,
        });
      }
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
    return { data: content, meta: { size: content.length, modified: null } };
  }

  async remove(targetPath) {
    const apiPath = this._pathToApi(targetPath);
    await this._api('DELETE', apiPath);
    return { message: 'Deleted successfully' };
  }

  async rename(srcPath, dstPath) {
    const apiPath = this._pathToApi(srcPath);
    const newName = path.basename(dstPath);
    await this._api('PATCH', apiPath, { name: newName });
    return { message: 'Renamed successfully', data: { from: srcPath, to: dstPath } };
  }

  async copy(srcPath, dstPath) {
    const apiPath = this._pathToApi(srcPath);
    const dstDir = path.dirname(dstPath);
    const parentRef = dstDir === '/' ? '/me/drive/root' : this._pathToApi(dstDir);

    await this._api('POST', `${apiPath}/copy`, {
      parentReference: { path: parentRef },
      name: path.basename(dstPath),
    });
    return { message: 'Copied successfully', data: { from: srcPath, to: dstPath } };
  }

  async mkdir(dirPath) {
    const parentDir = path.dirname(dirPath);
    const dirName = path.basename(dirPath);
    const parentPath = parentDir === '/' ? '/me/drive/root' : this._pathToApi(parentDir);

    await this._api('POST', `${parentPath}/children`, {
      name: dirName,
      folder: {},
      '@microsoft.graph.conflictBehavior': 'fail',
    });
    return { message: 'Folder created successfully', data: { path: dirPath } };
  }

  async exists(targetPath) {
    try {
      await this._api('GET', this._pathToApi(targetPath));
      return { data: { exists: true } };
    } catch {
      return { data: { exists: false } };
    }
  }

  async search(dirPath, keyword) {
    const resp = await this._api('GET', `/me/drive/root/search(q='${encodeURIComponent(keyword)}')?$top=100`);

    const items = (resp.value || []).map(item => ({
      name: item.name,
      type: item.folder ? 'folder' : 'file',
      size: item.size || 0,
      path: item.parentReference?.path
        ? item.parentReference.path.replace('/drive/root:', '') + '/' + item.name
        : '/' + item.name,
    }));

    return { data: items, total: items.length };
  }
}

OneDriveDriver.meta = {
  name: 'OneDrive',
  description: 'Microsoft OneDrive（Microsoft Graph API）',
  configFields: [
    { name: 'clientId', label: 'Client ID (App ID)', type: 'text', required: true },
    { name: 'clientSecret', label: 'Client Secret', type: 'password', required: true },
    { name: 'refreshToken', label: 'Refresh Token', type: 'textarea', required: true },
  ],
};

module.exports = { OneDriveDriver };
