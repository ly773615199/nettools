'use strict';

module.exports = (sequelize, DataTypes) => {
  const ServiceEvent = sequelize.define('ServiceEvent', {
    serviceType: {
      type: DataTypes.ENUM('clash', 'bore', 'vpn', 'fileServer', 'watchdog'),
      allowNull: false,
    },
    serviceId: { type: DataTypes.INTEGER, allowNull: true },
    eventType: {
      type: DataTypes.ENUM('start', 'stop', 'crash', 'restart', 'healthy', 'unhealthy'),
      allowNull: false,
    },
    message: { type: DataTypes.TEXT, allowNull: true },
    timestamp: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });

  return ServiceEvent;
};
