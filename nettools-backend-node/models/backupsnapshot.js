'use strict';

module.exports = (sequelize, DataTypes) => {
  const BackupSnapshot = sequelize.define('BackupSnapshot', {
    backupTaskId: { type: DataTypes.INTEGER, allowNull: false },
    snapshot: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: '{}',
      get() {
        const raw = this.getDataValue('snapshot');
        try { return JSON.parse(raw || '{}'); } catch { return {}; }
      },
      set(val) {
        this.setDataValue('snapshot', typeof val === 'string' ? val : JSON.stringify(val));
      },
    },
    fileCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    totalSize: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0 },
    duration: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }, // ms
  });

  BackupSnapshot.associate = (models) => {
    BackupSnapshot.belongsTo(models.BackupTask, { foreignKey: 'backupTaskId' });
  };

  return BackupSnapshot;
};
