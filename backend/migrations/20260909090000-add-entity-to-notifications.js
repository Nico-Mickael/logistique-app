'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Colonnes de traçabilité "entité" pour permettre l'anti-doublon des
    // notifications liées à un objet métier (ex. une sortie) : entity_type
    // + entity_id + type identifient de façon unique un événement pour un user.
    await queryInterface.addColumn('Notifications', 'entity_type', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('Notifications', 'entity_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });

    // Index unique PARTIEL : garantit qu'un même événement (user_id, type,
    // entity_type, entity_id) n'est notifié qu'une seule fois. Les
    // notifications sans entité (entity_type NULL) ne sont pas contraintes.
    // Une entité "métier" (ex. une sortie) est identifiée de façon unique par
    // (entity_type, entity_id) ; pour une sortie on utilise entity_type='sortie'.
    await queryInterface.addIndex('Notifications', ['user_id', 'type', 'entity_type', 'entity_id'], {
      name: 'notifications_entity_unique',
      unique: true,
      where: {
        entity_type: { [Sequelize.Op.ne]: null },
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('Notifications', 'notifications_entity_unique');
    await queryInterface.removeColumn('Notifications', 'entity_id');
    await queryInterface.removeColumn('Notifications', 'entity_type');
  },
};
