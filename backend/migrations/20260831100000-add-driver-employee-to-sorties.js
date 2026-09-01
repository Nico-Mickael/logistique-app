'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Sorties', 'driver_employee_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.addColumn('Sorties', 'departed_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Sorties', 'departed_at');
    await queryInterface.removeColumn('Sorties', 'driver_employee_id');
  }
};
