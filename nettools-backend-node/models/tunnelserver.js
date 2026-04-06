/**
 * TunnelServer 模型 — Bore 隧道服务器配置
 */
module.exports = (sequelize, DataTypes) => {
  const TunnelServer = sequelize.define('TunnelServer', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: '服务器名称',
    },
    host: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: '0.0.0.0',
      comment: '绑定地址',
    },
    port: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 7835,
      comment: '控制端口',
    },
    secret: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: '认证密钥',
    },
    minPort: {
      type: DataTypes.INTEGER,
      defaultValue: 1024,
      comment: '最小隧道端口',
    },
    maxPort: {
      type: DataTypes.INTEGER,
      defaultValue: 65535,
      comment: '最大隧道端口',
    },
    status: {
      type: DataTypes.ENUM('running', 'stopped', 'error'),
      defaultValue: 'stopped',
      comment: '运行状态',
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '所属用户',
    },
  }, {
    tableName: 'tunnel_servers',
    timestamps: true,
  });

  return TunnelServer;
};
