/**
 * ProxyRule 模型 — 代理规则
 */
module.exports = (sequelize, DataTypes) => {
  const ProxyRule = sequelize.define('ProxyRule', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    type: {
      type: DataTypes.ENUM('DOMAIN-SUFFIX', 'DOMAIN-KEYWORD', 'DOMAIN', 'IP-CIDR', 'IP-CIDR6', 'GEOIP', 'PROCESS-NAME', 'MATCH'),
      allowNull: false,
      comment: '规则类型',
    },
    value: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: '匹配值',
    },
    proxy: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'DIRECT',
      comment: '代理目标 (代理名/DIRECT/REJECT)',
    },
    priority: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: '优先级（数字越大越优先）',
    },
    enabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: '是否启用',
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  }, {
    tableName: 'proxy_rules',
    timestamps: true,
    indexes: [
      { fields: ['userId'] },
      { fields: ['priority'] },
    ],
  });

  return ProxyRule;
};
