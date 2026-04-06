'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const VpnServer = sequelize.define('VpnServer', {
    name: { type: DataTypes.STRING, allowNull: false },
    type: { type: DataTypes.ENUM('openvpn', 'wireguard', 'ikev2'), allowNull: false, defaultValue: 'wireguard' },
    host: { type: DataTypes.STRING, allowNull: false, defaultValue: '0.0.0.0' },
    port: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1194 },
    protocol: { type: DataTypes.ENUM('udp', 'tcp'), allowNull: false, defaultValue: 'udp' },
    config: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: '{}',
      get() {
        const raw = this.getDataValue('config');
        try { return JSON.parse(raw || '{}'); } catch { return {}; }
      },
      set(val) {
        this.setDataValue('config', typeof val === 'string' ? val : JSON.stringify(val));
      },
    },
    status: { type: DataTypes.ENUM('running', 'stopped', 'error'), allowNull: false, defaultValue: 'stopped' },
    secret: { type: DataTypes.STRING, allowNull: true },
    subnet: { type: DataTypes.STRING, allowNull: true, defaultValue: '10.8.0.0/24' },
    dns: { type: DataTypes.STRING, allowNull: true, defaultValue: '8.8.8.8,8.8.4.4' },
    userId: { type: DataTypes.INTEGER, allowNull: false },
  });

  VpnServer.associate = (models) => {
    VpnServer.belongsTo(models.User, { foreignKey: 'userId' });
  };

  return VpnServer;
};
