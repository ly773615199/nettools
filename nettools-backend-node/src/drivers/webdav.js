/**
 * WebDAV 存储驱动
 * 兼容 Nextcloud、ownCloud、坚果云等
 */
const { BaseDriver } = require('./interface');
const { createClient } = require('webdav');
const path = require('path');

class WebDAVDriver extends BaseDriver {
  constructor(config = {}) {
    super(config);
    this.name = 'WebDAV';
    this.type = 'webdav';
    this.client = null;
  }

  async init() {
    const { url, username, password } = this.config;
    if (!url) throw new Error('WebDAV config error: url is required');
    this.client = createClient(url, {
      username: username || '',
      password: password || '',
    });
    this.basePath = (this.config.root || this.config.basePath || '/').replace(/\/+$/, '') || '';
  }

  async drop() {
    this.client = null;
  }

  _fullPath(userPath) {
    const p = (userPath || '/').replace(/^\/+/, '');
    return this.basePath + '/' + p;
  }

  async list(dirPath = '/') {
    const fullPath = this._fullPath(dirPath);
    const contents = await this.client.getDirectoryContents(fullPath);
    const items = contents.map(item => ({
      name: item.basename,
      type: item.type === 'directory' ? 'folder' : 'file',
      size: item.size || 0,
      modified: item.lastmod ? new Date(item.lastmod).toISOString() : null,
      path: path.posix.join(dirPath, item.basename),
      extension: item.type === 'file' ? path.extname(item.basename).toLowerCase() : null,
    }));
    return { data: items, total: items.length };
  }

  async info(targetPath) {
    const fullPath = this._fullPath(targetPath);
    const stat = await this.client.stat(fullPath);
    return {
      data: {
        name: stat.basename,
        type: stat.type === 'directory' ? 'folder' : 'file',
        size: stat.size || 0,
        created: null,
        modified: stat.lastmod ? new Date(stat.lastmod).toISOString() : null,
        accessed: null,
        path: targetPath,
        permissions: null,
      },
    };
  }

  async link(filePath) {
    // WebDAV 直接 URL + Basic Auth header
    const fullPath = this._fullPath(filePath);
    const url = this.client.getFileDownloadLink(fullPath);
    const headers = {};
    if (this.config.username) {
      const auth = Buffer.from(`${this.config.username}:${this.config.password || ''}`).toString('base64');
      headers['Authorization'] = `Basic ${auth}`;
    }
    return { data: { url, headers } };
  }

  async put(filePath, content, encoding) {
    const fullPath = this._fullPath(filePath);
    let data;
    if (typeof content === 'string') {
      data = Buffer.from(content, encoding || 'utf8');
    } else {
      data = content;
    }
    await this.client.putFileContents(fullPath, data);
    return {
      message: 'File written successfully',
      data: { path: filePath, size: Buffer.isBuffer(data) ? data.length : 0 },
    };
  }

  async readFile(filePath, encoding) {
    const fullPath = this._fullPath(filePath);
    const buffer = await this.client.getFileContents(fullPath, { format: 'binary' });
    const stat = await this.client.stat(fullPath);
    return {
      data: Buffer.isBuffer(buffer) ? buffer.toString(encoding || 'utf8') : buffer,
      meta: {
        size: stat.size || 0,
        modified: stat.lastmod ? new Date(stat.lastmod).toISOString() : null,
      },
    };
  }

  async remove(targetPath) {
    const fullPath = this._fullPath(targetPath);
    await this.client.deleteFile(fullPath);
    return { message: 'Deleted successfully' };
  }

  async rename(srcPath, dstPath) {
    const fullSrc = this._fullPath(srcPath);
    const fullDst = this._fullPath(dstPath);
    await this.client.moveFile(fullSrc, fullDst);
    return { message: 'Renamed successfully', data: { from: srcPath, to: dstPath } };
  }

  async copy(srcPath, dstPath) {
    const fullSrc = this._fullPath(srcPath);
    const fullDst = this._fullPath(dstPath);
    await this.client.copyFile(fullSrc, fullDst);
    return { message: 'Copied successfully', data: { from: srcPath, to: dstPath } };
  }

  async mkdir(dirPath) {
    const fullPath = this._fullPath(dirPath);
    await this.client.createDirectory(fullPath);
    return { message: 'Folder created successfully', data: { path: dirPath } };
  }

  async exists(targetPath) {
    try {
      const fullPath = this._fullPath(targetPath);
      await this.client.stat(fullPath);
      return { data: { exists: true } };
    } catch {
      return { data: { exists: false } };
    }
  }

  async search(dirPath, keyword) {
    // WebDAV 没有原生搜索，递归 list
    const results = [];
    const kw = keyword.toLowerCase();

    const walk = async (dir) => {
      const contents = await this.client.getDirectoryContents(this._fullPath(dir));
      for (const item of contents) {
        if (item.basename.toLowerCase().includes(kw)) {
          results.push({
            name: item.basename,
            type: item.type === 'directory' ? 'folder' : 'file',
            size: item.size || 0,
            path: path.posix.join(dir, item.basename),
          });
        }
        if (item.type === 'directory') {
          await walk(path.posix.join(dir, item.basename));
        }
      }
    };

    try {
      await walk(dirPath);
    } catch (e) {}
    return { data: results, total: results.length };
  }
}

WebDAVDriver.meta = {
  name: 'WebDAV',
  description: '标准 WebDAV 协议（兼容 Nextcloud、ownCloud、坚果云等）',
  configFields: [
    { name: 'url', label: '服务器地址', type: 'text', required: true, help: 'WebDAV 服务器 URL，如 https://dav.jianguoyun.com/dav/' },
    { name: 'username', label: '用户名', type: 'text', required: false },
    { name: 'password', label: '密码', type: 'password', required: false },
    { name: 'basePath', label: '基础路径', type: 'text', required: false, default: '/', help: 'WebDAV 根目录' },
  ],
};

module.exports = { WebDAVDriver };
