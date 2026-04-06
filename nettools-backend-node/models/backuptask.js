'use strict';

module.exports = (sequelize, DataTypes) => {
  const BackupTask = sequelize.define('BackupTask', {
    name: { type: DataTypes.STRING, allowNull: false },
    sourceStorageId: { type: DataTypes.INTEGER, allowNull: false },
    targetStorageId: { type: DataTypes.INTEGER, allowNull: false },
    sourcePath: { type: DataTypes.STRING, allowNull: false, defaultValue: '/' },
    targetPath: { type: DataTypes.STRING, allowNull: false, defaultValue: '/' },
    schedule: { type: DataTypes.STRING, allowNull: true, defaultValue: null }, // cron 表达式
    mode: { type: DataTypes.ENUM('full', 'incremental'), allowNull: false, defaultValue: 'incremental' },
    lastRun: { type: DataTypes.DATE, allowNull: true },
    nextRun: { type: DataTypes.DATE, allowNull: true },
    status: {
      type: DataTypes.ENUM('idle', 'running', 'error', 'completed'),
      allowNull: false,
      defaultValue: 'idle',
    },
    userId: { type: DataTypes.INTEGER, allowNull: false },
  });

  BackupTask.associate = (models) => {
    BackupTask.belongsTo(models.User, { foreignKey: 'userId' });
    BackupTask.belongsTo(models.Storage, { foreignKey: 'sourceStorageId', as: 'sourceStorage' });
    BackupTask.belongsTo(models.Storage, { foreignKey: 'targetStorageId', as: 'targetStorage' });
  };

  return BackupTask;
};
