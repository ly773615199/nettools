/**
 * 百度网盘驱动
 * 基于百度网盘开放平台 API
 */
const { BaseDriver } = require('./interface');
const path = require('path');
const https = require('https');

const API_BASE = 'https://pan.baidu.com/rest/2.0/xpan';
const OAUTH_URL = 'https://openapi.baidu.com/oauth/2.0/token';

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
    if (options.body) req.write(options.body);
    req.end();
  });
}

class BaiduNetDiskDriver extends BaseDriver {
  constructor(config = {}) {
    super(config);
    this.name = 'Baidu NetDisk';
    this.type = 'baidu';
    this.accessToken = '';
    this.tokenExpire = 0;
  }

  async init() {
    if (!this.config.refreshToken) {
      throw new Error('BaiduNetDisk config error: refreshToken is required');
    }
    await this._refreshToken();
  }

  async _refreshToken() {
    const resp = await request(`${OAUTH_URL}?${new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: this.config.refreshToken,
      client_id: this.config.clientId || '',
      client_secret: this.config.clientSecret || '',
    }).toString()}`);

    if (resp.data.error) {
      throw new Error(`BaiduNetDisk token refresh failed: ${resp.data.error_description || resp.data.error}`);
    }

    this.accessToken = resp.data.access_token;
    this.tokenExpire = Date.now() + (resp.data.expires_in - 60) * 1000;
  }

  async _ensureToken() {
    if (!this.accessToken || Date.now() >= this.tokenExpire) {
      await this._refreshToken();
    }
  }

  async _api(method, urlPath, params = {}, body = null) {
    await this._ensureToken();
    const searchParams = new URLSearchParams({ ...params, access_token: this.accessToken });
    const url = `${API_BASE}${urlPath}?${searchParams.toString()}`;
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const resp = await request(url, opts);
    if (resp.data.errno !== undefined && resp.data.errno !== 0) {
      throw new Error(`BaiduNetDisk API error: errno=${resp.data.errno}, ${resp.data.error_msg || 'unknown'}`);
    }
    return resp.data;
  }

  async list(dirPath = '/') {
    const resp = await this._api('GET', '/file', {
      method: 'list',
      dir: dirPath || '/',
      order: 'name',
      limit: 1000,
    });

    const items = (resp.list || []).map(item => ({
      name: item.server_filename || item.path.split('/').pop(),
      type: item.isdir === 1 ? 'folder' : 'file',
      size: item.size || 0,
      modified: item.server_mtime ? new Date(item.server_mtime * 1000).toISOString() : null,
      path: item.path,
      extension: item.isdir === 1 ? null : path.extname(item.server_filename || '').toLowerCase(),
      fsId: item.fs_id,
    }));

    return { data: items, total: items.length };
  }

  async info(targetPath) {
    const resp = await this._api('GET', '/file', {
      method: 'meta',
      fsids: JSON.stringify([targetPath]),
      path: targetPath,
    });

    const item = (resp.list || [])[0];
    if (!item) throw new Error('File not found');

    return {
      data: {
        name: item.server_filename || targetPath.split('/').pop(),
        type: item.isdir === 1 ? 'folder' : 'file',
        size: item.size || 0,
        created: null,
        modified: item.server_mtime ? new Date(item.server_mtime * 1000).toISOString() : null,
        accessed: null,
        path: targetPath,
        permissions: null,
      },
    };
  }

  async link(filePath) {
    const resp = await this._api('GET', '/multimedia/file', {
      method: 'filemetas',
      dlink: 1,
      fsids: JSON.stringify([await this._getFsId(filePath)]),
    });

    const meta = (resp.list || [])[0];
    if (!meta || !meta.dlink) throw new Error('Cannot get download link');

    // dlink 需要重定向一次获取真实 URL
    const dlinkUrl = `${meta.dlink}&access_token=${this.accessToken}`;
    return { data: { url: dlinkUrl, headers: {} } };
  }

  async _getFsId(userPath) {
    const resp = await this._api('GET', '/file', {
      method: 'list',
      dir: path.dirname(userPath),
      limit: 1000,
    });
    const name = path.basename(userPath);
    const item = (resp.list || []).find(i => (i.server_filename || i.path.split('/').pop()) === name);
    if (!item) throw new Error('File not found');
    return item.fs_id;
  }

  async put(filePath, content, encoding) {
    let body;
    if (typeof content === 'string') {
      body = Buffer.from(content, encoding || 'utf8');
    } else {
      body = Buffer.isBuffer(content) ? content : Buffer.from(content);
    }

    // 预上传
    const crypto = require('crypto');
    const blockList = [crypto.createHash('md5').update(body).digest('hex')];
    const precreateResp = await this._api('POST', '/file', {
      method: 'precreate',
    }, {
      path: filePath,
      size: body.length,
      isdir: 0,
      autoinit: 1,
      block_list: JSON.stringify(blockList),
    });

    if (!precreateResp.uploadid) {
      throw new Error('BaiduNetDisk precreate failed');
    }

    // 分片上传
    const uploadUrl = `https://d.pcs.baidu.com/rest/2.0/pcs/superfile2?method=upload&access_token=${this.accessToken}&type=tmpfile&path=${encodeURIComponent(filePath)}&uploadid=${precreateResp.uploadid}&partseq=0`;
    await request(uploadUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: body,
    });

    // 创建文件
    await this._api('POST', '/file', {
      method: 'create',
    }, {
      path: filePath,
      size: body.length,
      isdir: 0,
      uploadid: precreateResp.uploadid,
      block_list: JSON.stringify(blockList),
    });

    return {
      message: 'File written successfully',
      data: { path: filePath, size: body.length },
    };
  }

  async readFile(filePath, encoding) {
    const linkResult = await this.link(filePath);
    const resp = await request(linkResult.data.url, {
      headers: { 'User-Agent': 'pan.baidu.com' },
    });
    const content = typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data);
    return { data: content, meta: { size: content.length, modified: null } };
  }

  async remove(targetPath) {
    await this._api('POST', '/file', {
      method: 'delete',
    }, {
      filelist: [targetPath],
    });
    return { message: 'Deleted successfully' };
  }

  async rename(srcPath, dstPath) {
    await this._api('POST', '/file', {
      method: 'rename',
    }, {
      filelist: [{ path: srcPath, newname: path.basename(dstPath) }],
    });
    return { message: 'Renamed successfully', data: { from: srcPath, to: dstPath } };
  }

  async copy(srcPath, dstPath) {
    await this._api('POST', '/file', {
      method: 'copy',
    }, {
      filelist: [{ path: srcPath, dest: path.dirname(dstPath), newname: path.basename(dstPath) }],
    });
    return { message: 'Copied successfully', data: { from: srcPath, to: dstPath } };
  }

  async mkdir(dirPath) {
    await this._api('POST', '/file', {
      method: 'create',
    }, {
      path: dirPath,
      isdir: 1,
      size: 0,
    });
    return { message: 'Folder created successfully', data: { path: dirPath } };
  }

  async exists(targetPath) {
    try {
      await this.info(targetPath);
      return { data: { exists: true } };
    } catch {
      return { data: { exists: false } };
    }
  }

  async search(dirPath, keyword) {
    const resp = await this._api('GET', '/file', {
      method: 'search',
      key: keyword,
      dir: dirPath || '/',
      recursion: 1,
      page: 1,
      num: 100,
    });

    const items = (resp.list || []).map(item => ({
      name: item.server_filename || item.path.split('/').pop(),
      type: item.isdir === 1 ? 'folder' : 'file',
      size: item.size || 0,
      path: item.path,
    }));

    return { data: items, total: items.length };
  }
}

BaiduNetDiskDriver.meta = {
  name: 'Baidu NetDisk (百度网盘)',
  description: '百度网盘开放平台 API',
  configFields: [
    { name: 'clientId', label: 'App Key', type: 'text', required: true },
    { name: 'clientSecret', label: 'Secret Key', type: 'password', required: true },
    { name: 'refreshToken', label: 'Refresh Token', type: 'textarea', required: true },
  ],
};

module.exports = { BaiduNetDiskDriver };
