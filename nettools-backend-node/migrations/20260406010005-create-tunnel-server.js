'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tunnel_servers', {
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
      host: {
        type: Sequelize.STRING,
        defaultValue: '0.0.0.0',
      },
      port: {
        type: Sequelize.INTEGER,
        defaultValue: 7835,
      },
      secret: {
        type: Sequelize.STRING,
      },
      minPort: {
        type: Sequelize.INTEGER,
        defaultValue: 1024,
      },
      maxPort: {
        type: Sequelize.INTEGER,
        defaultValue: 65535,
      },
      status: {
        type: Sequelize.ENUM('running', 'stopped', 'error'),
        defaultValue: 'stopped',
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
    await queryInterface.dropTable('tunnel_servers');
  }
};
