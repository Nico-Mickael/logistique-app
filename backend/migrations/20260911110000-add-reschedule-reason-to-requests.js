'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Motif de replanification lors du report d'une demande (ValidateRequests → Replanifier).
    await queryInterface.addColumn('Requests', 'reschedule_reason', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Requests', 'reschedule_reason');
  },
};