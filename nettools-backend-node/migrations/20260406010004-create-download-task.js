'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('download_tasks', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      url: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      targetPath: {
        type: Sequelize.STRING,
      },
      filename: {
        type: Sequelize.STRING,
      },
      filePath: {
        type: Sequelize.STRING,
      },
      size: {
        type: Sequelize.BIGINT,
        defaultValue: 0,
      },
      downloaded: {
        type: Sequelize.BIGINT,
        defaultValue: 0,
      },
      status: {
        type: Sequelize.ENUM('pending', 'downloading', 'completed', 'failed', 'cancelled'),
        defaultValue: 'pending',
      },
      progress: {
        type: Sequelize.FLOAT,
        defaultValue: 0,
      },
      speed: {
        type: Sequelize.STRING,
      },
      error: {
        type: Sequelize.TEXT,
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('download_tasks');
  }
};
