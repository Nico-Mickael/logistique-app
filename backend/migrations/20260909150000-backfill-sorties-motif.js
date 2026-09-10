'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  // Les sorties créées automatiquement depuis une demande validée n'avaient
  // pas de motif. On le récupère depuis la première demande liée (la plus
  // ancienne) sans écraser un motif déjà renseigné.
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE "Sorties" s
      SET "motif" = backfill."motif"
      FROM (
        SELECT DISTINCT ON (sr."sortie_id")
               sr."sortie_id" AS "sortie_id",
               r."motif" AS "motif"
        FROM "SortieRequests" sr
        JOIN "Requests" r ON r."id" = sr."request_id"
        WHERE r."motif" IS NOT NULL AND r."motif" <> ''
        ORDER BY sr."sortie_id" ASC, sr."id" ASC
      ) backfill
      WHERE s."id" = backfill."sortie_id"
        AND (s."motif" IS NULL OR s."motif" = '')
    `);
  },

  async down() {
    // Donnée dérivée : aucun rollback possible sans casser un motif existant.
  },
};