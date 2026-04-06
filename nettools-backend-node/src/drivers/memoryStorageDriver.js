/**
 * 内存存储驱动 — 纯内存文件系统
 * 用于测试、演示和临时文件操作
 */
const path = require('path');

class MemoryStorageDriver {
  constructor() {
    this.name = 'Memory Storage';
    this.type = 'memory';
    this.id = 'memory-' + Date.now();
    this.files = new Map(); // path -> { content, modified, created }
    this.folders = new Set();
    this.folders.add('/');
  }

  _normalizePath(p) {
    return '/' + p.replace(/^\/+/, '').replace(/\/+$/, '').replace(/\\/g, '/');
  }

  _parentDir(p) {
    const parts = this._normalizePath(p).split('/').filter(Boolean);
    parts.pop();
    return '/' + parts.join('/');
  }

  async list(dirPath = '/') {
    const dir = this._normalizePath(dirPath);
    const items = [];
    const seen = new Set();

    for (const folder of this.folders) {
      if (folder === '/') continue;
      const parent = this._parentDir(folder);
      if (parent === dir && !seen.has(path.basename(folder))) {
        seen.add(path.basename(folder));
        items.push({
          name: path.basename(folder),
          type: 'folder',
          size: 0,
          modified: new Date().toISOString(),
          path: folder,
        });
      }
    }

    for (const [filePath, file] of this.files) {
      const parent = this._parentDir(filePath);
      if (parent === dir && !seen.has(path.basename(filePath))) {
        seen.add(path.basename(filePath));
        items.push({
          name: path.basename(filePath),
          type: 'file',
          size: Buffer.byteLength(file.content),
          modified: file.modified,
          path: filePath,
          extension: path.extname(filePath).toLowerCase(),
        });
      }
    }

    items.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return { data: items, total: items.length };
  }

  async writeFile(filePath, content) {
    const p = this._normalizePath(filePath);
    const dir = this._parentDir(p);
    this.folders.add(dir);
    this.files.set(p, {
      content: String(content),
      modified: new Date().toISOString(),
      created: new Date().toISOString(),
    });
    return { message: 'File written', data: { path: p, size: Buffer.byteLength(content) } };
  }

  async readFile(filePath) {
    const p = this._normalizePath(filePath);
    const file = this.files.get(p);
    if (!file) throw new Error('File not found');
    return { data: file.content, meta: { size: Buffer.byteLength(file.content), modified: file.modified } };
  }

  async delete(targetPath) {
    const p = this._normalizePath(targetPath);
    if (this.files.has(p)) {
      this.files.delete(p);
    } else if (this.folders.has(p)) {
      for (const key of [...this.files.keys()]) {
        if (key.startsWith(p + '/')) this.files.delete(key);
      }
      for (const key of [...this.folders]) {
        if (key.startsWith(p + '/')) this.folders.delete(key);
      }
      this.folders.delete(p);
    } else {
      throw new Error('Target not found');
    }
    return { message: 'Deleted' };
  }

  async rename(oldPath, newPath) {
    const old = this._normalizePath(oldPath);
    const New = this._normalizePath(newPath);
    if (this.files.has(old)) {
      const file = this.files.get(old);
      this.files.delete(old);
      this.files.set(New, file);
    } else if (this.folders.has(old)) {
      for (const key of [...this.files.keys()]) {
        if (key.startsWith(old + '/')) {
          const content = this.files.get(key);
          this.files.delete(key);
          this.files.set(New + key.slice(old.length), content);
        }
      }
      this.folders.delete(old);
      this.folders.add(New);
    } else {
      throw new Error('Source not found');
    }
    return { message: 'Renamed', data: { from: old, to: New } };
  }

  async createFolder(folderPath) {
    const p = this._normalizePath(folderPath);
    if (this.folders.has(p)) throw new Error('Folder exists');
    this.folders.add(p);
    return { message: 'Folder created', data: { path: p } };
  }

  async copy(source, destination) {
    const src = this._normalizePath(source);
    const dst = this._normalizePath(destination);
    if (this.files.has(src)) {
      this.files.set(dst, { ...this.files.get(src) });
    } else {
      throw new Error('Source not found');
    }
    return { message: 'Copied', data: { from: src, to: dst } };
  }

  async exists(targetPath) {
    const p = this._normalizePath(targetPath);
    return { data: { exists: this.files.has(p) || this.folders.has(p) } };
  }
}

module.exports = { MemoryStorageDriver };
