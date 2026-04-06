/**
 * ProxyGroup 模型 — 代理组
 */
module.exports = (sequelize, DataTypes) => {
  const ProxyGroup = sequelize.define('ProxyGroup', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: '代理组名称',
    },
    type: {
      type: DataTypes.ENUM('select', 'url-test', 'fallback', 'load-balance'),
      allowNull: false,
      defaultValue: 'select',
      comment: '代理组类型',
    },
    proxies: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: '[]',
      comment: '代理名列表 JSON',
      get() {
        const raw = this.getDataValue('proxies');
        try { return JSON.parse(raw); } catch { return []; }
      },
      set(val) {
        this.setDataValue('proxies', JSON.stringify(val));
      },
    },
    url: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'http://www.gstatic.com/generate_204',
      comment: '健康检查 URL',
    },
    interval: {
      type: DataTypes.INTEGER,
      defaultValue: 300,
      comment: '检查间隔（秒）',
    },
    enabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  }, {
    tableName: 'proxy_groups',
    timestamps: true,
  });

  return ProxyGroup;
};
