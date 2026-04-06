'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('proxy_groups', {
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
        type: Sequelize.ENUM('select', 'url-test', 'fallback', 'load-balance'),
        allowNull: false,
        defaultValue: 'select',
      },
      proxies: {
        type: Sequelize.TEXT,
        defaultValue: '[]',
      },
      url: {
        type: Sequelize.STRING,
        defaultValue: 'http://www.gstatic.com/generate_204',
      },
      interval: {
        type: Sequelize.INTEGER,
        defaultValue: 300,
      },
      enabled: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
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
    await queryInterface.dropTable('proxy_groups');
  }
};
