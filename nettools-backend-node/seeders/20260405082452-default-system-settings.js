'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    /**
     * Add seed commands here. 
     * 
     * Example: 
     * await queryInterface.bulkInsert('People', [{  
     *   name: 'John Doe',
     *   isBetaMember: false
     * }], {});
    */
    await queryInterface.bulkInsert('SystemSettings', [
      {
        key: 'jwtSecret',
        value: 'your-secret-key',
        description: 'JWT secret key for authentication',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        key: 'jwtExpiration',
        value: '24h',
        description: 'JWT token expiration time',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        key: 'jwtExpirationRemember',
        value: '7d',
        description: 'JWT token expiration time when remember me is checked',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        key: 'maxFileSize',
        value: '10485760',
        description: 'Maximum file size for uploads (10MB)',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        key: 'allowedFileTypes',
        value: 'jpg,jpeg,png,gif,pdf,doc,docx,xls,xlsx,zip,rar',
        description: 'Allowed file types for uploads',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ], {});
  },

  async down (queryInterface, Sequelize) {
    /**
     * Add commands to revert seed here. 
     * 
     * Example: 
     * await queryInterface.bulkDelete('People', null, {});
    */
    await queryInterface.bulkDelete('SystemSettings', null, {});
  }
};
