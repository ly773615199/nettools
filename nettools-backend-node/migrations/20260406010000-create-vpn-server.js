'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('VpnServers', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      name: { type: Sequelize.STRING, allowNull: false },
      type: { type: Sequelize.ENUM('openvpn', 'wireguard', 'ikev2'), allowNull: false, defaultValue: 'wireguard' },
      host: { type: Sequelize.STRING, allowNull: false, defaultValue: '0.0.0.0' },
      port: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1194 },
      protocol: { type: Sequelize.ENUM('udp', 'tcp'), allowNull: false, defaultValue: 'udp' },
      config: { type: Sequelize.TEXT, allowNull: true, defaultValue: '{}' },
      status: { type: Sequelize.ENUM('running', 'stopped', 'error'), allowNull: false, defaultValue: 'stopped' },
      secret: { type: Sequelize.STRING, allowNull: true },
      subnet: { type: Sequelize.STRING, allowNull: true, defaultValue: '10.8.0.0/24' },
      dns: { type: Sequelize.STRING, allowNull: true, defaultValue: '8.8.8.8,8.8.4.4' },
      userId: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('VpnServers');
  }
};
