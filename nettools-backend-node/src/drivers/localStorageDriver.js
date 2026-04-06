/**
 * 本地存储驱动 — 真实文件系统操作
 * 提供目录浏览、文件上传/下载/删除/重命名/移动/复制/创建文件夹等操作
 */
const fs = require('fs');
const path = require('path');

class LocalStorageDriver {
  constructor(rootPath = '/') {
    this.root = path.resolve(rootPath);
    this.name = 'Local Storage';
    this.type = 'local';
    this.id = 'local-' + Date.now();
  }

  /** 安全解析路径，防止目录穿越 */
  _safePath(userPath) {
    const resolved = path.resolve(this.root, userPath.replace(/^\/+/, ''));
    if (!resolved.startsWith(this.root)) {
      throw new Error('Access denied: path outside root');
    }
    return resolved;
  }

  /** 列出目录内容 */
  async list(dirPath = '/') {
    const fullPath = this._safePath(dirPath);
    const entries = fs.readdirSync(fullPath, { withFileTypes: true });
    const items = entries.map(entry => {
      const itemPath = path.join(fullPath, entry.name);
      let stats;
      try { stats = fs.statSync(itemPath); } catch(e) { stats = null; }
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

  /** 获取文件/目录信息 */
  async info(filePath) {
    const fullPath = this._safePath(filePath);
    const stats = fs.statSync(fullPath);
    return {
      data: {
        name: path.basename(fullPath),
        type: stats.isDirectory() ? 'folder' : 'file',
        size: stats.size,
        created: stats.birthtime.toISOString(),
        modified: stats.mtime.toISOString(),
        accessed: stats.atime.toISOString(),
        path: filePath,
        permissions: '0' + (stats.mode & 0o777).toString(8),
      }
    };
  }

  /** 上传/写入文件 */
  async writeFile(filePath, content, encoding = 'utf8') {
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

  /** 读取文件内容 */
  async readFile(filePath, encoding = 'utf8') {
    const fullPath = this._safePath(filePath);
    if (!fs.existsSync(fullPath)) {
      throw new Error('File not found');
    }
    const content = fs.readFileSync(fullPath, encoding);
    const stats = fs.statSync(fullPath);
    return {
      data: content,
      meta: { size: stats.size, modified: stats.mtime.toISOString() }
    };
  }

  /** 删除文件或目录 */
  async delete(targetPath) {
    const fullPath = this._safePath(targetPath);
    if (!fs.existsSync(fullPath)) {
      throw new Error('Target not found');
    }
    const stats = fs.statSync(fullPath);
    if (stats.isDirectory()) {
      fs.rmSync(fullPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(fullPath);
    }
    return { message: 'Deleted successfully' };
  }

  /** 重命名/移动 */
  async rename(oldPath, newPath) {
    const fullOld = this._safePath(oldPath);
    const fullNew = this._safePath(newPath);
    if (!fs.existsSync(fullOld)) {
      throw new Error('Source not found');
    }
    const newDir = path.dirname(fullNew);
    if (!fs.existsSync(newDir)) {
      fs.mkdirSync(newDir, { recursive: true });
    }
    fs.renameSync(fullOld, fullNew);
    return { message: 'Renamed successfully', data: { from: oldPath, to: newPath } };
  }

  /** 复制文件或目录 */
  async copy(source, destination) {
    const fullSrc = this._safePath(source);
    const fullDst = this._safePath(destination);
    if (!fs.existsSync(fullSrc)) {
      throw new Error('Source not found');
    }
    const stats = fs.statSync(fullSrc);
    if (stats.isDirectory()) {
      fs.cpSync(fullSrc, fullDst, { recursive: true });
    } else {
      const dstDir = path.dirname(fullDst);
      if (!fs.existsSync(dstDir)) {
        fs.mkdirSync(dstDir, { recursive: true });
      }
      fs.copyFileSync(fullSrc, fullDst);
    }
    return { message: 'Copied successfully', data: { from: source, to: destination } };
  }

  /** 创建文件夹 */
  async createFolder(folderPath) {
    const fullPath = this._safePath(folderPath);
    if (fs.existsSync(fullPath)) {
      throw new Error('Folder already exists');
    }
    fs.mkdirSync(fullPath, { recursive: true });
    return { message: 'Folder created successfully', data: { path: folderPath } };
  }

  /** 检查是否存在 */
  async exists(targetPath) {
    const fullPath = this._safePath(targetPath);
    return { data: { exists: fs.existsSync(fullPath) } };
  }

  /** 搜索文件 */
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
            try { stats = fs.statSync(fullPath); } catch(e) { stats = null; }
            results.push({
              name: entry.name,
              type: entry.isDirectory() ? 'folder' : 'file',
              size: stats ? stats.size : 0,
              path: '/' + relPath.replace(/\\/g, '/'),
            });
          }
          if (entry.isDirectory()) {
            searchDir(fullPath);
          }
        }
      } catch(e) {}
    };
    searchDir(this._safePath(dirPath));
    return { data: results, total: results.length };
  }
}

module.exports = { LocalStorageDriver };
