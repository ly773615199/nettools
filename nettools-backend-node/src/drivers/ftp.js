/**
 * FTP 存储驱动
 */
const { BaseDriver } = require('./interface');
const ftp = require('basic-ftp');
const path = require('path');

class FTPDriver extends BaseDriver {
  constructor(config = {}) {
    super(config);
    this.name = 'FTP';
    this.type = 'ftp';
    this.client = null;
  }

  async init() {
    this.client = new ftp.Client();
    this.client.ftp.verbose = false;
    await this.client.access({
      host: this.config.host || 'localhost',
      port: Number(this.config.port) || 21,
      user: this.config.username || 'anonymous',
      password: this.config.password || '',
      secure: this.config.secure === true || this.config.secure === 'true',
    });
    this.basePath = this.config.basePath || '/';
    await this.client.cd(this.basePath);
  }

  async drop() {
    if (this.client) {
      this.client.close();
      this.client = null;
    }
  }

  _fullPath(userPath) {
    const p = (userPath || '/').replace(/^\/+/, '');
    return this.basePath + (this.basePath.endsWith('/') ? '' : '/') + p;
  }

  async list(dirPath = '/') {
    const fullPath = this._fullPath(dirPath);
    await this.client.cd(fullPath);
    const list = await this.client.list();
    const items = list.map(entry => ({
      name: entry.name,
      type: entry.type === ftp.EntryType.Directory ? 'folder' : 'file',
      size: entry.size || 0,
      modified: entry.modifiedAt ? entry.modifiedAt.toISOString() : null,
      path: path.posix.join(dirPath, entry.name),
      extension: entry.type === ftp.EntryType.File ? path.extname(entry.name).toLowerCase() : null,
    }));
    return { data: items, total: items.length };
  }

  async info(targetPath) {
    const dir = path.posix.dirname(targetPath);
    const name = path.posix.basename(targetPath);
    const fullPath = this._fullPath(dir);
    await this.client.cd(fullPath);
    const list = await this.client.list();
    const entry = list.find(e => e.name === name);
    if (!entry) throw new Error('File not found');
    return {
      data: {
        name: entry.name,
        type: entry.type === ftp.EntryType.Directory ? 'folder' : 'file',
        size: entry.size || 0,
        created: null,
        modified: entry.modifiedAt ? entry.modifiedAt.toISOString() : null,
        accessed: null,
        path: targetPath,
        permissions: null,
      },
    };
  }

  async link(filePath) {
    // FTP 文件无直接 URL，返回代理下载标识
    return {
      data: {
        url: `proxy:ftp:${this.config.host}:${filePath}`,
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
    await this.client.uploadFrom(stream, fullPath);
    return {
      message: 'File written successfully',
      data: { path: filePath, size: data.length },
    };
  }

  async readFile(filePath, encoding) {
    const fullPath = this._fullPath(filePath);
    const chunks = [];
    await this.client.downloadTo(
      require('stream').Writable({
        write(chunk, enc, cb) { chunks.push(chunk); cb(); }
      }),
      fullPath
    );
    const buffer = Buffer.concat(chunks);
    return {
      data: buffer.toString(encoding || 'utf8'),
      meta: { size: buffer.length, modified: null },
    };
  }

  async remove(targetPath) {
    const fullPath = this._fullPath(targetPath);
    // 尝试删除文件，失败则尝试删除目录
    try {
      await this.client.remove(fullPath);
    } catch {
      await this.client.removeDir(fullPath);
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
    // FTP 不原生支持 copy，需要下载再上传
    const fullSrc = this._fullPath(srcPath);
    const fullDst = this._fullPath(dstPath);
    const tmpPath = `/tmp/ftp-copy-${Date.now()}`;
    await this.client.downloadTo(tmpPath, fullSrc);
    await this.client.uploadFrom(tmpPath, fullDst);
    require('fs').unlinkSync(tmpPath);
    return { message: 'Copied successfully', data: { from: srcPath, to: dstPath } };
  }

  async mkdir(dirPath) {
    const fullPath = this._fullPath(dirPath);
    await this.client.ensureDir(fullPath);
    return { message: 'Folder created successfully', data: { path: dirPath } };
  }

  async exists(targetPath) {
    try {
      await this._fullPath(targetPath);
      const dir = path.posix.dirname(targetPath);
      const name = path.posix.basename(targetPath);
      await this.client.cd(this._fullPath(dir));
      const list = await this.client.list();
      return { data: { exists: list.some(e => e.name === name) } };
    } catch {
      return { data: { exists: false } };
    }
  }

  async search(dirPath, keyword) {
    const results = [];
    const kw = keyword.toLowerCase();

    const walk = async (dir) => {
      await this.client.cd(this._fullPath(dir));
      const list = await this.client.list();
      for (const entry of list) {
        if (entry.name === '.' || entry.name === '..') continue;
        if (entry.name.toLowerCase().includes(kw)) {
          results.push({
            name: entry.name,
            type: entry.type === ftp.EntryType.Directory ? 'folder' : 'file',
            size: entry.size || 0,
            path: path.posix.join(dir, entry.name),
          });
        }
        if (entry.type === ftp.EntryType.Directory) {
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

FTPDriver.meta = {
  name: 'FTP',
  description: '标准 FTP 文件传输协议',
  configFields: [
    { name: 'host', label: 'Host', type: 'text', required: true },
    { name: 'port', label: 'Port', type: 'number', required: false, default: 21 },
    { name: 'username', label: 'Username', type: 'text', required: false, default: 'anonymous' },
    { name: 'password', label: 'Password', type: 'password', required: false },
    { name: 'secure', label: 'FTPS (Secure)', type: 'boolean', required: false, default: false },
    { name: 'basePath', label: 'Base Path', type: 'text', required: false, default: '/' },
  ],
};

module.exports = { FTPDriver };
