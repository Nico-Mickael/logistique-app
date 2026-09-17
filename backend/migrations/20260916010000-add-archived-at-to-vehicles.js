'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Vehicles', 'archived_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addIndex('Vehicles', ['archived_at'], { where: { archived_at: null }, name: 'vehicles_active_idx' });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('Vehicles', 'vehicles_active_idx');
    await queryInterface.removeColumn('Vehicles', 'archived_at');
  },
};