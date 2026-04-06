/**
 * better-sqlite3 → sqlite3 兼容适配层
 *
 * Sequelize 6 的 sqlite 方言依赖 sqlite3 的回调式 API。
 * 本文件将 better-sqlite3 的同步 API 包装为 Sequelize 所需的接口。
 *
 * 替换后的好处：
 *  - N-API 预编译，不依赖 node-gyp / C++ 编译工具链
 *  - 同步 API，性能更好
 *  - 活跃维护，更好的跨平台兼容性
 */

const BetterSqlite3 = require('better-sqlite3');

// ---- 常量：匹配 sqlite3 的 open mode ----
const OPEN_READONLY = 0x00000001;
const OPEN_READWRITE = 0x00000002;
const OPEN_CREATE = 0x00000004;

/**
 * 将 sqlite3 风格的参数和 SQL 转为 better-sqlite3 格式
 *
 * Sequelize 的 sqlite 方言用 $1, $2... 占位符 + { $1: val, $2: val } 对象
 * better-sqlite3 用 ? 占位符 + 数组参数
 *
 * @returns {{ sql: string, params: any[] }}
 */
function normalizeQuery(sql, params) {
  if (!params || typeof params !== 'object') {
    return { sql, params: [] };
  }
  const keys = Object.keys(params);
  if (keys.length === 0) {
    return { sql, params: [] };
  }

  // $1/$2 格式 → 替换为 ? + 数组
  if (keys.every(k => /^\$\d+$/.test(k))) {
    const sorted = keys.sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));
    const values = sorted.map(k => params[k]);
    // 将 SQL 中的 $1, $2... 替换为 ?
    const newSql = sql.replace(/\$\d+/g, '?');
    return { sql: newSql, params: values };
  }

  // :name 格式 → 去掉前缀保持对象
  const result = {};
  for (const [k, v] of Object.entries(params)) {
    result[k.replace(/^[$:]/, '')] = v;
  }
  return { sql, params: [result] };
}

/**
 * 安全执行查询 — better-sqlite3 的 .all() 对 DDL/写操作会抛错
 * sqlite3 不区分，任何 SQL 都能调 .all()
 */
function safeAll(stmt, params) {
  try {
    return stmt.all(...params);
  } catch (err) {
    if (err.message && err.message.includes('does not return data')) {
      stmt.run(...params);
      return [];
    }
    throw err;
  }
}

/**
 * sqlite3 兼容的 Database 包装类
 */
class Database {
  /**
   * @param {string} filename - 数据库路径或 ':memory:'
   * @param {number} mode - 打开模式位标志（可选）
   * @param {Function} callback - callback(err)（可选）
   */
  constructor(filename, mode, callback) {
    if (typeof mode === 'function') {
      callback = mode;
      mode = OPEN_READWRITE | OPEN_CREATE;
    }
    if (typeof callback !== 'function') {
      callback = () => {};
    }

    this.filename = filename;
    this._lastID = 0;
    this._changes = 0;

    try {
      const options = {};
      if (mode === OPEN_READONLY) {
        options.readonly = true;
      }
      this._db = new BetterSqlite3(filename, options);
      // WAL 模式提升并发性能
      this._db.pragma('journal_mode = WAL');
      process.nextTick(() => callback(null));
    } catch (err) {
      process.nextTick(() => callback(err));
    }
  }

  /**
   * 执行 SQL（INSERT/UPDATE/DELETE/DDL）
   * sqlite3: db.run(sql, params, callback)
   *   - callback(err) 中 this.lastID, this.changes 可用
   */
  run(sql, params, callback) {
    if (typeof params === 'function') { callback = params; params = []; }
    if (typeof callback !== 'function') callback = () => {};

    try {
      const { sql: newSql, params: p } = normalizeQuery(sql, params);
      const stmt = this._db.prepare(newSql);
      const info = stmt.run(...p);
      this._lastID = Number(info.lastInsertRowid);
      this._changes = info.changes;
      callback.call({ lastID: this._lastID, changes: this._changes }, null);
    } catch (err) {
      callback(err);
    }
    return this;
  }

  /**
   * 执行查询返回所有行
   * sqlite3: db.all(sql, params, callback)
   * 注意：better-sqlite3 的 .all() 对 DDL 会抛错，这里做兼容处理
   */
  all(sql, params, callback) {
    if (typeof params === 'function') { callback = params; params = []; }
    if (typeof callback !== 'function') callback = () => {};

    try {
      const { sql: newSql, params: p } = normalizeQuery(sql, params);
      const stmt = this._db.prepare(newSql);
      const rows = safeAll(stmt, p);
      callback(null, rows);
    } catch (err) {
      callback(err);
    }
    return this;
  }

  /**
   * 执行查询返回单行
   * sqlite3: db.get(sql, params, callback)
   */
  get(sql, params, callback) {
    if (typeof params === 'function') { callback = params; params = []; }
    if (typeof callback !== 'function') callback = () => {};

    try {
      const { sql: newSql, params: p } = normalizeQuery(sql, params);
      const stmt = this._db.prepare(newSql);
      const row = stmt.get(...p);
      callback(null, row || undefined);
    } catch (err) {
      callback(err);
    }
    return this;
  }

  /**
   * 序列化执行 — better-sqlite3 本身就是同步的
   * Sequelize 用 serialize 包裹事务逻辑，这里直接同步执行 callback
   */
  serialize(callback) {
    if (typeof callback === 'function') callback();
  }

  /**
   * 并行执行（sqlite3 兼容）
   */
  parallelize(callback) {
    if (typeof callback === 'function') callback();
  }

  /**
   * 关闭数据库连接
   */
  close(callback) {
    if (typeof callback !== 'function') callback = () => {};
    try {
      if (this._db && this._db.open) this._db.close();
      process.nextTick(() => callback(null));
    } catch (err) {
      process.nextTick(() => callback(err));
    }
  }
}

module.exports = {
  Database,
  OPEN_READONLY,
  OPEN_READWRITE,
  OPEN_CREATE,
};
