/**
 * SMB (Windows 共享) 存储驱动
 *
 * ⚠️ 实验性功能 — 依赖 @aspectus/smb2 或 smb2 库
 * 已知限制：
 *  - SMB2 协议不原生支持 rename/copy，用 read+write+delete 替代
 *  - 大文件操作性能有限（全部加载到内存）
 *  - 目录检测依赖文件名启发式（无 stat 接口）
 *  - search 通过递归 list 实现，深度受限
 *
 * 安装依赖：npm install @aspectus/smb2
 */
const { BaseDriver } = require('./interface');
const path = require('path');

class SMBDriver extends BaseDriver {
  constructor(config = {}) {
    super(config);
    this.name = 'SMB (Experimental)';
    this.type = 'smb';
    this.client = null;
    this._smbModule = null;
  }

  async init() {
    // 动态加载 SMB2 库
    try {
      this._smbModule = require('@aspectus/smb2');
    } catch {
      try {
        this._smbModule = require('smb2');
      } catch {
        throw new Error(
          'SMB driver requires @aspectus/smb2 package. Install: npm install @aspectus/smb2\n' +
          'Note: This is an experimental driver with known limitations.'
        );
      }
    }

    const { share, domain, username, password } = this.config;
    if (!share) throw new Error('SMB config error: share is required (e.g. \\\\server\\share)');

    this.client = new this._smbModule({
      share,
      domain: domain || '',
      username: username || '',
      password: password || '',
      autoCloseTimeout: 0,
    });
    this.basePath = this.config.basePath || '/';
  }

  async drop() {
    if (this.client) {
      try { this.client.close(); } catch {}
      this.client = null;
    }
  }

  _fullPath(userPath) {
    const p = (userPath || '/').replace(/^\/+/, '');
    return this.basePath + (this.basePath.endsWith('/') ? '' : '/') + p;
  }

  /** 将回调式 SMB2 方法包装为 Promise */
  _call(method, ...args) {
    return new Promise((resolve, reject) => {
      if (!this.client) return reject(new Error('SMB client not connected'));
      this.client[method](...args, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
  }

  /**
   * 检测条目是否为目录
   * SMB2 的 readdir 返回字符串数组时无法区分，尝试用 stat 补充判断
   */
  async _detectType(fullPath, entryName) {
    // 尝试 stat（某些 SMB2 库支持）
    try {
      const stat = await this._call('stat', fullPath + '/' + entryName);
      if (stat && stat.isDirectory) return 'folder';
      return 'file';
    } catch {}
    // 启发式：无扩展名或以 / 结尾视为目录
    if (!path.extname(entryName)) {
      try {
        await this._call('readdir', fullPath + '/' + entryName);
        return 'folder';
      } catch {}
    }
    return 'file';
  }

  async list(dirPath = '/') {
    const fullPath = this._fullPath(dirPath);
    const entries = await this._call('readdir', fullPath);
    const items = [];

    for (const entry of entries) {
      const name = typeof entry === 'string' ? entry : entry.filename;
      // 跳过 . 和 ..
      if (name === '.' || name === '..') continue;

      const itemType = await this._detectType(fullPath, name);
      const ext = itemType === 'file' ? (path.extname(name).toLowerCase() || null) : null;

      items.push({
        name,
        type: itemType,
        size: 0,  // SMB2 库不直接提供大小
        modified: null,
        path: path.posix.join(dirPath, name),
        extension: ext,
      });
    }

    return { data: items, total: items.length };
  }

  async info(targetPath) {
    const fullPath = this._fullPath(targetPath);
    let fileType = 'file';
    try {
      const stat = await this._call('stat', fullPath);
      if (stat && stat.isDirectory) fileType = 'folder';
    } catch {
      // fallback：尝试 readdir
      try {
        await this._call('readdir', fullPath);
        fileType = 'folder';
      } catch {}
    }

    return {
      data: {
        name: path.basename(targetPath),
        type: fileType,
        size: 0,
        created: null,
        modified: null,
        accessed: null,
        path: targetPath,
        permissions: null,
      },
    };
  }

  async link(filePath) {
    return {
      data: {
        url: `proxy:smb:${this.config.share}:${filePath}`,
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
      data = Buffer.isBuffer(content) ? content : Buffer.from(content);
    }
    await this._call('writeFile', fullPath, data);
    return {
      message: 'File written successfully',
      data: { path: filePath, size: data.length },
    };
  }

  async readFile(filePath, encoding) {
    const fullPath = this._fullPath(filePath);
    const buffer = await this._call('readFile', fullPath);
    const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
    return {
      data: buf.toString(encoding || 'utf8'),
      meta: { size: buf.length, modified: null },
    };
  }

  async remove(targetPath) {
    const fullPath = this._fullPath(targetPath);
    // 先尝试删除文件，失败则尝试删除目录
    try {
      await this._call('unlink', fullPath);
    } catch {
      await this._call('rmdir', fullPath);
    }
    return { message: 'Deleted successfully' };
  }

  async rename(srcPath, dstPath) {
    const fullSrc = this._fullPath(srcPath);
    const fullDst = this._fullPath(dstPath);
    // SMB2 库可能不支持 rename，用 copy + delete 代替
    try {
      await this._call('rename', fullSrc, fullDst);
    } catch {
      const content = await this._call('readFile', fullSrc);
      await this._call('writeFile', fullDst, content);
      await this._call('unlink', fullSrc);
    }
    return { message: 'Renamed successfully', data: { from: srcPath, to: dstPath } };
  }

  async copy(srcPath, dstPath) {
    const fullSrc = this._fullPath(srcPath);
    const fullDst = this._fullPath(dstPath);
    const content = await this._call('readFile', fullSrc);
    await this._call('writeFile', fullDst, content);
    return { message: 'Copied successfully', data: { from: srcPath, to: dstPath } };
  }

  async mkdir(dirPath) {
    const fullPath = this._fullPath(dirPath);
    await this._call('mkdir', fullPath);
    return { message: 'Folder created successfully', data: { path: dirPath } };
  }

  async exists(targetPath) {
    const fullPath = this._fullPath(targetPath);
    try {
      await this._call('readFile', fullPath);
      return { data: { exists: true } };
    } catch {
      try {
        await this._call('readdir', fullPath);
        return { data: { exists: true } };
      } catch {
        return { data: { exists: false } };
      }
    }
  }

  async search(dirPath, keyword) {
    const results = [];
    const kw = keyword.toLowerCase();
    const maxDepth = 5;

    const walk = async (dir, depth) => {
      if (depth > maxDepth) return;
      let entries;
      try {
        entries = await this._call('readdir', this._fullPath(dir));
      } catch { return; }

      for (const entry of entries) {
        const name = typeof entry === 'string' ? entry : entry.filename;
        if (name === '.' || name === '..') continue;
        const relPath = path.posix.join(dir, name);

        if (name.toLowerCase().includes(kw)) {
          results.push({
            name,
            type: 'file', // 启发式，不做额外检测以提升搜索性能
            size: 0,
            path: relPath,
          });
        }

        // 尝试递归子目录
        if (!path.extname(name)) {
          try {
            await this._call('readdir', this._fullPath(relPath));
            await walk(relPath, depth + 1);
          } catch { /* 不是目录，跳过 */ }
        }
      }
    };

    try { await walk(dirPath, 0); } catch {}
    return { data: results, total: results.length };
  }
}

SMBDriver.meta = {
  name: 'SMB / Windows Share (Experimental)',
  description: 'Windows SMB/CIFS 共享文件夹（实验性 — 依赖 @aspectus/smb2）',
  configFields: [
    { name: 'share', label: 'Share Path', type: 'text', required: true, help: '如 \\\\server\\share' },
    { name: 'domain', label: 'Domain', type: 'text', required: false },
    { name: 'username', label: 'Username', type: 'text', required: false },
    { name: 'password', label: 'Password', type: 'password', required: false },
    { name: 'basePath', label: 'Base Path', type: 'text', required: false, default: '/' },
  ],
};

module.exports = { SMBDriver };
