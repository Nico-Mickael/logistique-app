'use strict';
/**
 * Disponibilité professionnelle des employés/chauffeurs.
 *
 * Séparation claire entre :
 *  - l'état technique de connexion (sessions/sockets) — non utilisé ici ;
 *  - la disponibilité professionnelle (availability_status) qui seule
 *    détermine si un chauffeur peut être assigné à une sortie.
 *
 * Valeurs : 'available' (par défaut) | 'offline' | 'on_leave' | 'absent'.
 * Pendant un congé (on_leave), leave_start_date / leave_end_date bornent la
 * période ; au retour (jour >= leave_end_date) le statut repasse
 * automatiquement à 'available' (sauf modification manuelle entretemps).
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Employees', 'availability_status', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'available',
    });
    await queryInterface.addColumn('Employees', 'leave_start_date', {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });
    await queryInterface.addColumn('Employees', 'leave_end_date', {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });
    await queryInterface.addColumn('Employees', 'availability_updated_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    // Rétro-compatibilité : les comptes existants sont disponibles par défaut
    // (défaut de la colonne) ; on horodate la valeur initiale.
    await queryInterface.sequelize.query(
      'UPDATE "Employees" SET "availability_updated_at" = "updatedAt" WHERE "availability_updated_at" IS NULL'
    );
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Employees', 'availability_updated_at');
    await queryInterface.removeColumn('Employees', 'leave_end_date');
    await queryInterface.removeColumn('Employees', 'leave_start_date');
    await queryInterface.removeColumn('Employees', 'availability_status');
  },
};