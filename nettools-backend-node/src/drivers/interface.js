/**
 * 存储驱动抽象接口
 * 所有存储驱动必须实现此接口定义的方法
 */

/**
 * @typedef {Object} Obj
 * @property {string} name - 文件/目录名
 * @property {string} type - 'file' | 'folder'
 * @property {number} size - 大小（字节）
 * @property {string|null} modified - 修改时间 ISO 字符串
 * @property {string} path - 相对路径
 * @property {string|null} extension - 文件扩展名（仅文件）
 */

/**
 * @typedef {Object} DriverConfig
 * @property {string} name - 驱动名称
 * @property {string} type - 驱动类型标识
 * @property {ConfigField[]} configFields - 配置字段定义
 */

/**
 * @typedef {Object} ConfigField
 * @property {string} name - 字段名
 * @property {string} label - 显示标签
 * @property {string} type - 输入类型 (text|password|number|boolean|select|textarea)
 * @property {boolean} required - 是否必填
 * @property {*} default - 默认值
 * @property {string} [help] - 帮助文本
 * @property {Array<{value: string, label: string}>} [options] - select 类型选项
 */

class BaseDriver {
  /**
   * @param {Object} config - 驱动配置
   */
  constructor(config = {}) {
    this.config = config;
    /** @type {string} 驱动名称 */
    this.name = 'Base';
    /** @type {string} 驱动类型 */
    this.type = 'base';
  }

  /** 初始化驱动 */
  async init() {
    throw new Error('Method not implemented: init()');
  }

  /** 销毁驱动（断开连接、释放资源） */
  async drop() {
    // 可选实现
  }

  /**
   * 列出目录内容
   * @param {string} dirPath - 目录路径
   * @returns {Promise<{data: Obj[], total: number}>}
   */
  async list(dirPath) {
    throw new Error('Method not implemented: list()');
  }

  /**
   * 获取文件/目录信息
   * @param {string} targetPath - 目标路径
   * @returns {Promise<{data: Obj}>}
   */
  async info(targetPath) {
    throw new Error('Method not implemented: info()');
  }

  /**
   * 获取文件下载链接
   * @param {string} filePath - 文件路径
   * @returns {Promise<{data: {url: string, headers?: Object}}>}
   */
  async link(filePath) {
    throw new Error('Method not implemented: link()');
  }

  /**
   * 创建目录
   * @param {string} dirPath - 目录路径
   * @returns {Promise<{message: string, data: {path: string}}>}
   */
  async mkdir(dirPath) {
    throw new Error('Method not implemented: mkdir()');
  }

  /**
   * 重命名/移动
   * @param {string} srcPath - 源路径
   * @param {string} dstPath - 目标路径
   * @returns {Promise<{message: string, data: {from: string, to: string}}>}
   */
  async rename(srcPath, dstPath) {
    throw new Error('Method not implemented: rename()');
  }

  /**
   * 复制
   * @param {string} srcPath - 源路径
   * @param {string} dstPath - 目标路径
   * @returns {Promise<{message: string, data: {from: string, to: string}}>}
   */
  async copy(srcPath, dstPath) {
    throw new Error('Method not implemented: copy()');
  }

  /**
   * 删除文件或目录
   * @param {string} targetPath - 目标路径
   * @returns {Promise<{message: string}>}
   */
  async remove(targetPath) {
    throw new Error('Method not implemented: remove()');
  }

  /**
   * 上传/写入文件
   * @param {string} filePath - 文件路径
   * @param {string|Buffer|ReadableStream} content - 内容
   * @param {string} [encoding] - 编码
   * @returns {Promise<{message: string, data: {path: string, size: number}}>}
   */
  async put(filePath, content, encoding) {
    throw new Error('Method not implemented: put()');
  }

  /**
   * 搜索文件
   * @param {string} dirPath - 搜索目录
   * @param {string} keyword - 关键词
   * @returns {Promise<{data: Obj[], total: number}>}
   */
  async search(dirPath, keyword) {
    throw new Error('Method not implemented: search()');
  }

  /**
   * 检查是否存在
   * @param {string} targetPath - 目标路径
   * @returns {Promise<{data: {exists: boolean}}>}
   */
  async exists(targetPath) {
    throw new Error('Method not implemented: exists()');
  }

  /**
   * 读取文件内容（文本文件）
   * @param {string} filePath - 文件路径
   * @param {string} [encoding] - 编码
   * @returns {Promise<{data: string, meta: {size: number, modified: string}}>}
   */
  async readFile(filePath, encoding) {
    throw new Error('Method not implemented: readFile()');
  }

  /**
   * 写入文件内容
   * @param {string} filePath - 文件路径
   * @param {string|Buffer} content - 内容
   * @param {string} [encoding] - 编码
   * @returns {Promise<{message: string, data: {path: string, size: number}}>}
   */
  writeFile(filePath, content, encoding) {
    return this.put(filePath, content, encoding);
  }

  /**
   * 创建文件夹（mkdir 别名）
   */
  createFolder(dirPath) {
    return this.mkdir(dirPath);
  }

  /**
   * 删除（remove 别名，兼容旧 API）
   */
  delete(targetPath) {
    return this.remove(targetPath);
  }
}

module.exports = { BaseDriver };
