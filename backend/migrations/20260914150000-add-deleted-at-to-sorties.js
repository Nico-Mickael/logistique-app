'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Sorties', 'deleted_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addIndex('Sorties', ['deleted_at'], { where: { deleted_at: null }, name: 'sorties_active_idx' });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('Sorties', 'sorties_active_idx');
    await queryInterface.removeColumn('Sorties', 'deleted_at');
  },
};