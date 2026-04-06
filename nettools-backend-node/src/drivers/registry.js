/**
 * 驱动注册表
 * 管理所有存储驱动的注册、实例化和查询
 */

const registeredDrivers = new Map();

/**
 * 注册一个驱动类型
 * @param {string} type - 驱动类型标识（如 's3', 'webdav', 'ftp'）
 * @param {Function} DriverClass - 驱动类（必须继承 BaseDriver）
 * @param {Object} meta - 驱动元信息
 * @param {string} meta.name - 显示名称
 * @param {string} meta.description - 描述
 * @param {Array} meta.configFields - 配置字段定义
 */
function register(type, DriverClass, meta = {}) {
  if (registeredDrivers.has(type)) {
    console.warn(`[DriverRegistry] Driver type "${type}" already registered, overwriting.`);
  }
  registeredDrivers.set(type, {
    type,
    DriverClass,
    name: meta.name || type,
    description: meta.description || '',
    configFields: meta.configFields || [],
  });
}

/**
 * 创建驱动实例
 * @param {string} type - 驱动类型
 * @param {Object} config - 驱动配置
 * @returns {BaseDriver}
 */
function create(type, config = {}) {
  const entry = registeredDrivers.get(type);
  if (!entry) {
    throw new Error(`Unknown driver type: ${type}`);
  }
  return new entry.DriverClass(config);
}

/**
 * 获取驱动类型列表
 * @returns {Array<{type: string, name: string, description: string, configFields: Array}>}
 */
function listTypes() {
  const result = [];
  for (const [type, entry] of registeredDrivers) {
    result.push({
      type: entry.type,
      name: entry.name,
      description: entry.description,
      configFields: entry.configFields,
    });
  }
  return result;
}

/**
 * 获取驱动类型信息
 * @param {string} type
 * @returns {Object|null}
 */
function getType(type) {
  return registeredDrivers.get(type) || null;
}

/**
 * 检查驱动类型是否已注册
 * @param {string} type
 * @returns {boolean}
 */
function has(type) {
  return registeredDrivers.has(type);
}

module.exports = { register, create, listTypes, getType, has, registeredDrivers };
