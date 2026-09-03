'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Sorties', 'fuel_litres', {
      type: Sequelize.DECIMAL(8, 2),
      allowNull: true,
    });
    await queryInterface.addColumn('Sorties', 'fuel_cost', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Sorties', 'fuel_cost');
    await queryInterface.removeColumn('Sorties', 'fuel_litres');
  },
};
