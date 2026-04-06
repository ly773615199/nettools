/**
 * 存储管理器
 * 管理存储实例的生命周期（创建、启用、禁用、删除）
 */

const registry = require('../drivers/registry');

// 活跃的驱动实例 Map: storageId -> driver instance
const activeDrivers = new Map();

/**
 * 根据 Storage 数据库记录创建并初始化驱动实例
 * @param {Object} storage - Storage 模型实例
 * @returns {Promise<BaseDriver>}
 */
async function createDriver(storage) {
  const config = typeof storage.config === 'string'
    ? JSON.parse(storage.config)
    : storage.config || {};

  const driver = registry.create(storage.type, config);
  await driver.init();

  activeDrivers.set(storage.id, driver);
  return driver;
}

/**
 * 获取驱动实例
 * @param {number|string} storageId
 * @returns {BaseDriver|null}
 */
function getDriver(storageId) {
  return activeDrivers.get(Number(storageId)) || null;
}

/**
 * 停用并销毁驱动实例
 * @param {number|string} storageId
 */
async function removeDriver(storageId) {
  const driver = activeDrivers.get(Number(storageId));
  if (driver) {
    try {
      await driver.drop();
    } catch (err) {
      console.error(`[StorageManager] Error dropping driver ${storageId}:`, err.message);
    }
    activeDrivers.delete(Number(storageId));
  }
}

/**
 * 启用存储（创建驱动实例）
 * @param {Object} storage - Storage 模型实例
 */
async function enable(storage) {
  if (activeDrivers.has(storage.id)) {
    await removeDriver(storage.id);
  }
  return createDriver(storage);
}

/**
 * 禁用存储
 * @param {number|string} storageId
 */
async function disable(storageId) {
  await removeDriver(storageId);
}

/**
 * 列出所有活跃的驱动
 * @returns {Array<{id: number, type: string}>}
 */
function listActive() {
  const result = [];
  for (const [id, driver] of activeDrivers) {
    result.push({ id, type: driver.type, name: driver.name });
  }
  return result;
}

/**
 * 初始化：根据数据库中所有启用的存储创建驱动实例
 * @param {Object} StorageModel - Storage Sequelize 模型
 */
async function initFromDatabase(StorageModel) {
  if (!StorageModel) return;
  try {
    const storages = await StorageModel.findAll({ where: { status: 'online' } });
    for (const storage of storages) {
      try {
        await createDriver(storage);
        console.log(`[StorageManager] Enabled storage: ${storage.name} (${storage.type})`);
      } catch (err) {
        console.error(`[StorageManager] Failed to enable storage ${storage.name}:`, err.message);
        await storage.update({ status: 'offline' });
      }
    }
  } catch (err) {
    console.error('[StorageManager] Error initializing from database:', err.message);
  }
}

module.exports = {
  createDriver,
  getDriver,
  removeDriver,
  enable,
  disable,
  listActive,
  initFromDatabase,
  activeDrivers,
};
