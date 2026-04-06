'use strict';
const { DataTypes } = require('sequelize');

/**
 * PenetrationInstance — 穿透实例模型
 * 一个穿透任务，连接两个节点，定义端口映射规则
 */
module.exports = (sequelize) => {
  const PenetrationInstance = sequelize.define('PenetrationInstance', {
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: '用户命名，如"家里Web暴露到VPS"',
    },
    type: {
      type: DataTypes.ENUM('wireguard', 'bore', 'frp', 'ssh', 'cloudflare'),
      allowNull: false,
      comment: '穿透方法',
    },

    // ---- 参与节点 ----
    serverNodeId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: '服务端节点 ID (PenetrationNode)，Cloudflare 时为 null',
    },
    clientNodeId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: '客户端节点 ID，当前本机为 null',
    },
    role: {
      type: DataTypes.ENUM('server', 'client', 'both'),
      allowNull: false,
      defaultValue: 'client',
      comment: '当前机器在此实例中的角色',
    },

    // ---- 穿透映射规则 ----
    mappings: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: '[]',
      comment: 'JSON: [{ localPort, remotePort, protocol, domain? }]',
      get() {
        const raw = this.getDataValue('mappings');
        try { return JSON.parse(raw || '[]'); } catch { return []; }
      },
      set(val) {
        this.setDataValue('mappings', typeof val === 'string' ? val : JSON.stringify(val));
      },
    },

    // ---- 协议配置 ----
    config: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: '{}',
      comment: 'JSON: 按 type 不同内容不同 (WireGuard/FRP/Bore 配置)',
      get() {
        const raw = this.getDataValue('config');
        try { return JSON.parse(raw || '{}'); } catch { return {}; }
      },
      set(val) {
        this.setDataValue('config', typeof val === 'string' ? val : JSON.stringify(val));
      },
    },

    // ---- 运行状态 ----
    status: {
      type: DataTypes.ENUM('created', 'running', 'stopped', 'error'),
      allowNull: false,
      defaultValue: 'created',
    },
    pid: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: '本地进程 PID',
    },
    lastError: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    // ---- 流量统计 ----
    bytesUp: {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 0,
    },
    bytesDown: {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 0,
    },
    lastActiveAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  });

  PenetrationInstance.associate = (models) => {
    PenetrationInstance.belongsTo(models.User, { foreignKey: 'userId' });
    PenetrationInstance.belongsTo(models.PenetrationNode, { foreignKey: 'serverNodeId', as: 'serverNode' });
    PenetrationInstance.belongsTo(models.PenetrationNode, { foreignKey: 'clientNodeId', as: 'clientNode' });
  };

  return PenetrationInstance;
};
