'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // Sorties planifiées dépassées : détection "départ en retard" filtrée sur
    // status + departure_time (fetchOverdue de la page Sorties).
    await queryInterface.addIndex('Sorties', ['status', 'departure_time'], { name: 'sorties_status_departure_time' });

    // SortieRequests : une demande ne doit jamais être liée deux fois à une
    // même sortie (double occupation fantôme). On supprime d'abord les
    // éventuels doublons existants (on conserve le lien le plus ancien), puis
    // on pose la contrainte d'unicité.
    await queryInterface.sequelize.query(`
      DELETE FROM "SortieRequests" sr1
      USING "SortieRequests" sr2
      WHERE sr1."id" > sr2."id"
        AND sr1."request_id" = sr2."request_id"
        AND sr1."sortie_id" = sr2."sortie_id";
    `);
    await queryInterface.addConstraint('SortieRequests', {
      fields: ['sortie_id', 'request_id'],
      type: 'unique',
      name: 'sortierequests_sortie_request_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint('SortieRequests', 'sortierequests_sortie_request_unique');
    await queryInterface.removeIndex('Sorties', 'sorties_status_departure_time');
  },
};