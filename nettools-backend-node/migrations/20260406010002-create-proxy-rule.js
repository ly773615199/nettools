'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('proxy_rules', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      type: {
        type: Sequelize.ENUM('DOMAIN-SUFFIX', 'DOMAIN-KEYWORD', 'DOMAIN', 'IP-CIDR', 'IP-CIDR6', 'GEOIP', 'PROCESS-NAME', 'MATCH'),
        allowNull: false,
      },
      value: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      proxy: {
        type: Sequelize.STRING,
        defaultValue: 'DIRECT',
      },
      priority: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
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
    await queryInterface.addIndex('proxy_rules', ['userId']);
    await queryInterface.addIndex('proxy_rules', ['priority']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('proxy_rules');
  }
};
