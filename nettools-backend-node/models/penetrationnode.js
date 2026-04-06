'use strict';
const { DataTypes } = require('sequelize');

/**
 * PenetrationNode — 穿透节点模型
 * 代表一台可以部署穿透组件的设备（VPS/NAS/本地电脑）
 */
module.exports = (sequelize) => {
  const PenetrationNode = sequelize.define('PenetrationNode', {
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: '用户命名，如"阿里云VPS"、"家里NAS"',
    },
    nodeType: {
      type: DataTypes.ENUM('vps', 'nas', 'local', 'cloud'),
      allowNull: false,
      defaultValue: 'vps',
      comment: '节点类型',
    },

    // ---- 连接信息 ----
    host: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'localhost',
      comment: 'IP/域名，本地节点为 localhost',
    },
    sshPort: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 22,
    },
    sshUser: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'root',
    },
    sshAuth: {
      type: DataTypes.ENUM('key', 'password', 'none'),
      allowNull: false,
      defaultValue: 'key',
      comment: 'SSH 认证方式，本地节点为 none',
    },
    sshKeyPath: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'SSH 私钥路径',
    },
    sshPassword: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'SSH 密码（加密存储）',
    },

    // ---- 自动检测结果 ----
    osType: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'ubuntu / centos / debian / synology / qnap / alpine / macos / windows',
    },
    arch: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'x86_64 / aarch64 / armv7',
    },
    hasRoot: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      get() { return !!this.getDataValue('hasRoot'); },
      set(val) { this.setDataValue('hasRoot', val ? 1 : 0); },
    },
    hasDocker: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      get() { return !!this.getDataValue('hasDocker'); },
      set(val) { this.setDataValue('hasDocker', val ? 1 : 0); },
    },
    publicIp: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: '检测到的公网 IP',
    },
    pkgManager: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'apt / yum / apk / brew / choco / none',
    },

    // ---- 已安装组件 ----
    installed: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: '{}',
      comment: 'JSON: { wireguard: true, bore: true, frp: false, ... }',
      get() {
        const raw = this.getDataValue('installed');
        try { return JSON.parse(raw || '{}'); } catch { return {}; }
      },
      set(val) {
        this.setDataValue('installed', typeof val === 'string' ? val : JSON.stringify(val));
      },
    },

    // ---- 状态 ----
    status: {
      type: DataTypes.ENUM('unknown', 'reachable', 'unreachable'),
      allowNull: false,
      defaultValue: 'unknown',
    },
    lastSeenAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  });

  PenetrationNode.associate = (models) => {
    PenetrationNode.belongsTo(models.User, { foreignKey: 'userId' });
    PenetrationNode.hasMany(models.PenetrationInstance, { foreignKey: 'serverNodeId', as: 'serverInstances' });
    PenetrationNode.hasMany(models.PenetrationInstance, { foreignKey: 'clientNodeId', as: 'clientInstances' });
  };

  return PenetrationNode;
};
