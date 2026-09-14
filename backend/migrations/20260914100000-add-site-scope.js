'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Table des sites (agences)
    await queryInterface.createTable('Sites', {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
      name: { type: Sequelize.STRING, allowNull: false },
      code: { type: Sequelize.STRING, allowNull: false, unique: true },
      city: { type: Sequelize.STRING },
      address: { type: Sequelize.STRING },
      status: { type: Sequelize.STRING, allowNull: false, defaultValue: 'active' },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE },
    });

    // 2. Site par défaut "Tana" (Antananarivo) — rattache les données existantes
    await queryInterface.bulkInsert('Sites', [{
      id: 1,
      name: 'Tana',
      code: 'TANA',
      city: 'Antananarivo',
      address: null,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    }], {});

    // La séquence doit dépasser l'id explicite inséré, sinon le prochain
    // INSERT sans id retomberait sur un id déjà utilisé (23505).
    await queryInterface.sequelize.query('SELECT setval(\'"Sites_id_seq"\', COALESCE((SELECT MAX(id) FROM "Sites"), 1))');

    // 3. Colonne site_id sur les tables métier (FK → Sites)
    const tables = ['Employees', 'Vehicles', 'Requests', 'Sorties'];
    for (const table of tables) {
      await queryInterface.addColumn(table, 'site_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'Sites', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      });
    }

    // 4. Backfill : TOUT l'existant appartient au site par défaut Tana (aucune suppression)
    for (const table of tables) {
      await queryInterface.sequelize.query(`UPDATE "${table}" SET "site_id" = 1 WHERE "site_id" IS NULL`);
    }

    // 5. NOT NULL + index (l'isolation est garantie par la structure, pas par le code)
    for (const table of tables) {
      await queryInterface.changeColumn(table, 'site_id', {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Sites', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      });
      await queryInterface.addIndex(table, ['site_id']);
    }
  },

  async down(queryInterface, Sequelize) {
    const tables = ['Employees', 'Vehicles', 'Requests', 'Sorties'];
    for (const table of tables) {
      await queryInterface.removeIndex(table, `${table.toLowerCase()}_site_id`).catch(() => {});
      await queryInterface.changeColumn(table, 'site_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'Sites', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      });
      await queryInterface.removeColumn(table, 'site_id');
    }
    await queryInterface.dropTable('Sites');
  },
};