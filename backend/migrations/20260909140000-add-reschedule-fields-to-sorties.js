'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Sorties', 'previous_departure_time', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn('Sorties', 'reschedule_reason', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('Sorties', 'rescheduled_by', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.addIndex('Sorties', ['rescheduled_by']);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('Sorties', ['rescheduled_by']);
    await queryInterface.removeColumn('Sorties', 'rescheduled_by');
    await queryInterface.removeColumn('Sorties', 'reschedule_reason');
    await queryInterface.removeColumn('Sorties', 'previous_departure_time');
  },
};