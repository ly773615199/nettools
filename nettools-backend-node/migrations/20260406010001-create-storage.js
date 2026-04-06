'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('storages', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      type: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      mountPath: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: '/',
      },
      rootFolder: {
        type: Sequelize.STRING,
        defaultValue: '/',
      },
      status: {
        type: Sequelize.ENUM('online', 'offline'),
        defaultValue: 'offline',
      },
      config: {
        type: Sequelize.TEXT,
        defaultValue: '{}',
      },
      order: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
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
    await queryInterface.addIndex('storages', ['userId']);
    await queryInterface.addIndex('storages', ['type']);
    await queryInterface.addIndex('storages', ['mountPath']);
    await queryInterface.addIndex('storages', ['status']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('storages');
  }
};
