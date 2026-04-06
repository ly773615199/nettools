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
    await queryInterface.bulkInsert('Users', [
      {
        username: 'admin',
        password: '$2b$10$e5p8J7ySgMZJ7eP1z5a34u5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e', // password: admin
        role: 'admin',
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
    await queryInterface.bulkDelete('Users', null, {});
  }
};
