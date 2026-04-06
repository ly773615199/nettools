/**
 * 本地存储驱动 — 真实文件系统操作
 * 继承 BaseDriver，支持多实例
 */
const fs = require('fs');
const path = require('path');
const { BaseDriver } = require('./interface');

class LocalStorageDriver extends BaseDriver {
  constructor(config = {}) {
    super(config);
    this.name = 'Local Storage';
    this.type = 'local';
    this.root = config.root || config.rootPath || '/';
  }

  async init() {
    this.root = path.resolve(this.config.root || this.config.rootPath || '/');
    if (!fs.existsSync(this.root)) {
      fs.mkdirSync(this.root, { recursive: true });
    }
  }

  /** 安全解析路径，防止目录穿越 */
  _safePath(userPath) {
    const resolved = path.resolve(this.root, (userPath || '/').replace(/^\/+/, ''));
    if (!resolved.startsWith(this.root)) {
      throw new Error('Access denied: path outside root');
    }
    return resolved;
  }

  async list(dirPath = '/') {
    const fullPath = this._safePath(dirPath);
    const entries = fs.readdirSync(fullPath, { withFileTypes: true });
    const items = entries.map(entry => {
      const itemPath = path.join(fullPath, entry.name);
      let stats;
      try { stats = fs.statSync(itemPath); } catch (e) { stats = null; }
      return {
        name: entry.name,
        type: entry.isDirectory() ? 'folder' : 'file',
        size: stats ? stats.size : 0,
        modified: stats ? stats.mtime.toISOString() : null,
        path: path.join(dirPath, entry.name).replace(/\\/g, '/'),
        extension: entry.isFile() ? path.extname(entry.name).toLowerCase() : null,
      };
    });
    return { data: items, total: items.length };
  }

  async info(targetPath) {
    const fullPath = this._safePath(targetPath);
    const stats = fs.statSync(fullPath);
    return {
      data: {
        name: path.basename(fullPath),
        type: stats.isDirectory() ? 'folder' : 'file',
        size: stats.size,
        created: stats.birthtime.toISOString(),
        modified: stats.mtime.toISOString(),
        accessed: stats.atime.toISOString(),
        path: targetPath,
        permissions: '0' + (stats.mode & 0o777).toString(8),
      }
    };
  }

  async link(filePath) {
    // 本地文件直接返回下载路径（由上层 API 生成）
    return {
      data: {
        url: filePath,
        headers: {},
      }
    };
  }

  async put(filePath, content, encoding = 'utf8') {
    const fullPath = this._safePath(filePath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(fullPath, content, encoding);
    const stats = fs.statSync(fullPath);
    return {
      message: 'File written successfully',
      data: { path: filePath, size: stats.size }
    };
  }

  async readFile(filePath, encoding = 'utf8') {
    const fullPath = this._safePath(filePath);
    if (!fs.existsSync(fullPath)) throw new Error('File not found');
    const content = fs.readFileSync(fullPath, encoding);
    const stats = fs.statSync(fullPath);
    return {
      data: content,
      meta: { size: stats.size, modified: stats.mtime.toISOString() }
    };
  }

  async remove(targetPath) {
    const fullPath = this._safePath(targetPath);
    if (!fs.existsSync(fullPath)) throw new Error('Target not found');
    const stats = fs.statSync(fullPath);
    if (stats.isDirectory()) {
      fs.rmSync(fullPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(fullPath);
    }
    return { message: 'Deleted successfully' };
  }

  async rename(srcPath, dstPath) {
    const fullSrc = this._safePath(srcPath);
    const fullDst = this._safePath(dstPath);
    if (!fs.existsSync(fullSrc)) throw new Error('Source not found');
    const dstDir = path.dirname(fullDst);
    if (!fs.existsSync(dstDir)) fs.mkdirSync(dstDir, { recursive: true });
    fs.renameSync(fullSrc, fullDst);
    return { message: 'Renamed successfully', data: { from: srcPath, to: dstPath } };
  }

  async copy(srcPath, dstPath) {
    const fullSrc = this._safePath(srcPath);
    const fullDst = this._safePath(dstPath);
    if (!fs.existsSync(fullSrc)) throw new Error('Source not found');
    const stats = fs.statSync(fullSrc);
    if (stats.isDirectory()) {
      fs.cpSync(fullSrc, fullDst, { recursive: true });
    } else {
      const dstDir = path.dirname(fullDst);
      if (!fs.existsSync(dstDir)) fs.mkdirSync(dstDir, { recursive: true });
      fs.copyFileSync(fullSrc, fullDst);
    }
    return { message: 'Copied successfully', data: { from: srcPath, to: dstPath } };
  }

  async mkdir(dirPath) {
    const fullPath = this._safePath(dirPath);
    if (fs.existsSync(fullPath)) throw new Error('Folder already exists');
    fs.mkdirSync(fullPath, { recursive: true });
    return { message: 'Folder created successfully', data: { path: dirPath } };
  }

  async exists(targetPath) {
    const fullPath = this._safePath(targetPath);
    return { data: { exists: fs.existsSync(fullPath) } };
  }

  async search(dirPath, keyword) {
    const results = [];
    const searchDir = (dir) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const relPath = path.relative(this.root, fullPath);
          if (entry.name.toLowerCase().includes(keyword.toLowerCase())) {
            let stats;
            try { stats = fs.statSync(fullPath); } catch (e) { stats = null; }
            results.push({
              name: entry.name,
              type: entry.isDirectory() ? 'folder' : 'file',
              size: stats ? stats.size : 0,
              path: '/' + relPath.replace(/\\/g, '/'),
            });
          }
          if (entry.isDirectory()) searchDir(fullPath);
        }
      } catch (e) {}
    };
    searchDir(this._safePath(dirPath));
    return { data: results, total: results.length };
  }
}

// 驱动元信息（用于注册表）
LocalStorageDriver.meta = {
  name: 'Local Storage',
  description: '本地文件系统存储',
  configFields: [
    { name: 'rootPath', label: '根目录路径', type: 'text', required: true, default: '/', help: '存储的根目录绝对路径（也接受 root 字段）' },
  ],
};

module.exports = { LocalStorageDriver };
