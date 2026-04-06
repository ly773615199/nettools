/**
 * DownloadTask 模型 — 离线下载任务
 */
module.exports = (sequelize, DataTypes) => {
  const DownloadTask = sequelize.define('DownloadTask', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    url: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: '下载 URL',
    },
    targetPath: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: '目标存储路径',
    },
    filename: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: '文件名',
    },
    filePath: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: '本地文件路径',
    },
    size: {
      type: DataTypes.BIGINT,
      defaultValue: 0,
      comment: '文件总大小',
    },
    downloaded: {
      type: DataTypes.BIGINT,
      defaultValue: 0,
      comment: '已下载大小',
    },
    status: {
      type: DataTypes.ENUM('pending', 'downloading', 'completed', 'failed', 'cancelled'),
      defaultValue: 'pending',
      comment: '任务状态',
    },
    progress: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
      comment: '进度百分比',
    },
    speed: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: '下载速度',
    },
    error: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '错误信息',
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  }, {
    tableName: 'download_tasks',
    timestamps: true,
  });

  return DownloadTask;
};
