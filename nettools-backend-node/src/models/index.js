const { Sequelize } = require('sequelize');
const path = require('path');

// 使用 better-sqlite3 适配层（不依赖 node-gyp 编译）
const sqliteAdapter = require('../drivers/sqlite3-adapter');

// 创建数据库连接
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, '..', '..', 'database.sqlite'),
  dialectModule: sqliteAdapter,
  logging: process.env.NODE_ENV === 'development' ? console.log : false
});

// 测试数据库连接
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connection has been established successfully.');
  } catch (error) {
    console.error('Unable to connect to the database:', error);
  }
};

testConnection();

// 导入模型
const User = require('../../models/user.js')(sequelize, Sequelize.DataTypes);
const SystemSetting = require('../../models/systemsetting.js')(sequelize, Sequelize.DataTypes);
const File = require('../../models/file.js')(sequelize, Sequelize.DataTypes);
const Tunnel = require('../../models/tunnel.js')(sequelize, Sequelize.DataTypes);
const Proxy = require('../../models/proxy.js')(sequelize, Sequelize.DataTypes);
const Storage = require('../../models/storage.js')(sequelize, Sequelize.DataTypes);
const TunnelServer = require('../../models/tunnelserver.js')(sequelize, Sequelize.DataTypes);
const ProxyRule = require('../../models/proxyrule.js')(sequelize, Sequelize.DataTypes);
const ProxyGroup = require('../../models/proxygroup.js')(sequelize, Sequelize.DataTypes);
const DownloadTask = require('../../models/downloadtask.js')(sequelize, Sequelize.DataTypes);
const VpnServer = require('../../models/vpnserver.js')(sequelize, Sequelize.DataTypes);
const PenetrationNode = require('../../models/penetrationnode.js')(sequelize, Sequelize.DataTypes);
const PenetrationInstance = require('../../models/penetrationinstance.js')(sequelize, Sequelize.DataTypes);

// 同步数据库
const syncDatabase = async () => {
  try {
    await sequelize.sync({ force: false });
    console.log('Database synchronized successfully.');
  } catch (error) {
    console.error('Error synchronizing database:', error);
  }
};

syncDatabase();

// 导出模型和数据库连接
module.exports = {
  sequelize,
  User,
  SystemSetting,
  File,
  Tunnel,
  Proxy,
  Storage,
  TunnelServer,
  ProxyRule,
  ProxyGroup,
  DownloadTask,
  VpnServer,
  PenetrationNode,
  PenetrationInstance,
};
