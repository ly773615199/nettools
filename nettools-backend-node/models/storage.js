/**
 * Storage 模型 — 存储实例配置
 */
module.exports = (sequelize, DataTypes) => {
  const Storage = sequelize.define('Storage', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: '存储显示名称',
    },
    type: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: '驱动类型 (local, s3, webdav, ftp, sftp, smb, aliyundrive, onedrive, googledrive, baidu, jianguoyun)',
    },
    mountPath: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: '/',
      comment: '挂载路径',
    },
    rootFolder: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: '/',
      comment: '根目录',
    },
    status: {
      type: DataTypes.ENUM('online', 'offline'),
      defaultValue: 'offline',
      comment: '状态',
    },
    config: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: '{}',
      comment: '驱动配置 JSON',
      get() {
        const raw = this.getDataValue('config');
        try { return JSON.parse(raw); } catch { return {}; }
      },
      set(val) {
        this.setDataValue('config', JSON.stringify(val));
      },
    },
    order: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: '排序权重',
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '所属用户',
    },
  }, {
    tableName: 'storages',
    timestamps: true,
    indexes: [
      { fields: ['userId'] },
      { fields: ['type'] },
      { fields: ['mountPath'] },
      { fields: ['status'] },
    ],
  });

  return Storage;
};
