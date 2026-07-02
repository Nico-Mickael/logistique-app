'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Sorties', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      vehicle_id: {
        type: Sequelize.INTEGER
      },
      driver_name: {
        type: Sequelize.STRING
      },
      destination: {
        type: Sequelize.STRING
      },
      departure_time: {
        type: Sequelize.DATE
      },
      status: {
        type: Sequelize.STRING
      },
      departure_km: {
        type: Sequelize.INTEGER
      },
      arrival_km: {
        type: Sequelize.INTEGER
      },
      distance_km: {
        type: Sequelize.INTEGER
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
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Sorties');
  }
};