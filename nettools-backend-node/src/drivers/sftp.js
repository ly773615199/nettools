/**
 * SFTP 存储驱动
 */
const { BaseDriver } = require('./interface');
const SftpClient = require('ssh2-sftp-client');
const path = require('path');

class SFTPDriver extends BaseDriver {
  constructor(config = {}) {
    super(config);
    this.name = 'SFTP';
    this.type = 'sftp';
    this.client = null;
  }

  async init() {
    this.client = new SftpClient();
    const connectConfig = {
      host: this.config.host || 'localhost',
      port: Number(this.config.port) || 22,
      username: this.config.username || 'root',
    };
    if (this.config.password) {
      connectConfig.password = this.config.password;
    }
    if (this.config.privateKey) {
      connectConfig.privateKey = this.config.privateKey;
    }
    await this.client.connect(connectConfig);
    this.basePath = this.config.root || this.config.basePath || '/';
  }

  async drop() {
    if (this.client) {
      await this.client.end();
      this.client = null;
    }
  }

  _fullPath(userPath) {
    const p = (userPath || '/').replace(/^\/+/, '');
    return this.basePath + (this.basePath.endsWith('/') ? '' : '/') + p;
  }

  async list(dirPath = '/') {
    const fullPath = this._fullPath(dirPath);
    const list = await this.client.list(fullPath);
    const items = list.map(entry => ({
      name: entry.name,
      type: entry.type === 'd' ? 'folder' : 'file',
      size: entry.size || 0,
      modified: entry.modifyTime ? new Date(entry.modifyTime).toISOString() : null,
      path: path.posix.join(dirPath, entry.name),
      extension: entry.type === '-' ? path.extname(entry.name).toLowerCase() : null,
    }));
    return { data: items, total: items.length };
  }

  async info(targetPath) {
    const fullPath = this._fullPath(targetPath);
    const stat = await this.client.stat(fullPath);
    return {
      data: {
        name: path.basename(targetPath),
        type: stat.isDirectory ? 'folder' : 'file',
        size: stat.size || 0,
        created: null,
        modified: stat.modifyTime ? new Date(stat.modifyTime).toISOString() : null,
        accessed: null,
        path: targetPath,
        permissions: stat.mode ? '0' + (stat.mode & 0o777).toString(8) : null,
      },
    };
  }

  async link(filePath) {
    return {
      data: {
        url: `proxy:sftp:${this.config.host}:${filePath}`,
        headers: {},
      },
    };
  }

  async put(filePath, content, encoding) {
    const fullPath = this._fullPath(filePath);
    let data;
    if (typeof content === 'string') {
      data = Buffer.from(content, encoding || 'utf8');
    } else {
      data = content;
    }
    const { Readable } = require('stream');
    const stream = Readable.from(data);
    await this.client.put(stream, fullPath);
    return {
      message: 'File written successfully',
      data: { path: filePath, size: data.length },
    };
  }

  async readFile(filePath, encoding) {
    const fullPath = this._fullPath(filePath);
    const chunks = [];
    const { Writable } = require('stream');
    const stream = new Writable({
      write(chunk, enc, cb) { chunks.push(chunk); cb(); }
    });
    await this.client.get(fullPath, stream);
    const buffer = Buffer.concat(chunks);
    const stat = await this.client.stat(fullPath);
    return {
      data: buffer.toString(encoding || 'utf8'),
      meta: { size: stat.size || 0, modified: stat.modifyTime ? new Date(stat.modifyTime).toISOString() : null },
    };
  }

  async remove(targetPath) {
    const fullPath = this._fullPath(targetPath);
    try {
      await this.client.delete(fullPath);
    } catch {
      await this.client.rmdir(fullPath, true);
    }
    return { message: 'Deleted successfully' };
  }

  async rename(srcPath, dstPath) {
    const fullSrc = this._fullPath(srcPath);
    const fullDst = this._fullPath(dstPath);
    await this.client.rename(fullSrc, fullDst);
    return { message: 'Renamed successfully', data: { from: srcPath, to: dstPath } };
  }

  async copy(srcPath, dstPath) {
    // SFTP 不原生支持 copy，用临时文件
    const fullSrc = this._fullPath(srcPath);
    const fullDst = this._fullPath(dstPath);
    const tmpPath = `/tmp/sftp-copy-${Date.now()}`;
    await this.client.fastGet(fullSrc, tmpPath);
    await this.client.fastPut(tmpPath, fullDst);
    require('fs').unlinkSync(tmpPath);
    return { message: 'Copied successfully', data: { from: srcPath, to: dstPath } };
  }

  async mkdir(dirPath) {
    const fullPath = this._fullPath(dirPath);
    await this.client.mkdir(fullPath, true);
    return { message: 'Folder created successfully', data: { path: dirPath } };
  }

  async exists(targetPath) {
    try {
      await this.client.stat(this._fullPath(targetPath));
      return { data: { exists: true } };
    } catch {
      return { data: { exists: false } };
    }
  }

  async search(dirPath, keyword) {
    const results = [];
    const kw = keyword.toLowerCase();

    const walk = async (dir) => {
      const fullPath = this._fullPath(dir);
      const list = await this.client.list(fullPath);
      for (const entry of list) {
        if (entry.name === '.' || entry.name === '..') continue;
        if (entry.name.toLowerCase().includes(kw)) {
          results.push({
            name: entry.name,
            type: entry.type === 'd' ? 'folder' : 'file',
            size: entry.size || 0,
            path: path.posix.join(dir, entry.name),
          });
        }
        if (entry.type === 'd') {
          await walk(path.posix.join(dir, entry.name));
        }
      }
    };

    try {
      await walk(dirPath);
    } catch (e) {}
    return { data: results, total: results.length };
  }
}

SFTPDriver.meta = {
  name: 'SFTP',
  description: 'SSH 文件传输协议',
  configFields: [
    { name: 'host', label: 'Host', type: 'text', required: true },
    { name: 'port', label: 'Port', type: 'number', required: false, default: 22 },
    { name: 'username', label: 'Username', type: 'text', required: true, default: 'root' },
    { name: 'password', label: 'Password', type: 'password', required: false },
    { name: 'privateKey', label: 'Private Key', type: 'textarea', required: false, help: 'SSH 私钥内容（可选，密码和私钥二选一）' },
    { name: 'basePath', label: 'Base Path', type: 'text', required: false, default: '/' },
  ],
};

module.exports = { SFTPDriver };
