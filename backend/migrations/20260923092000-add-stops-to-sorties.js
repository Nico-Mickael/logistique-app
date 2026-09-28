'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Itinéraire multi-étapes : liste ordonnée des lieux de passage avant la
    // destination finale (JSONB sur Postgres ; sérialisé en texte ailleurs).
    await queryInterface.addColumn('Sorties', 'stops', {
      type: Sequelize.JSONB,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Sorties', 'stops');
  },
};