'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Véhicules : type de carburant + kilométrage actuel (pour la maintenance préventive)
    await queryInterface.addColumn('Vehicles', 'fuel_type', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('Vehicles', 'current_km', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: 0,
    });

    // Historique / plan de maintenance
    await queryInterface.createTable('Maintenances', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      vehicle_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Vehicles', key: 'id' },
        onDelete: 'CASCADE',
      },
      type: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      cost: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      next_due_km: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      next_due_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'planned',
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    await queryInterface.addIndex('Maintenances', ['vehicle_id']);
    await queryInterface.addIndex('Maintenances', ['status']);
    await queryInterface.addIndex('Maintenances', ['next_due_date']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('Maintenances');
    await queryInterface.removeColumn('Vehicles', 'current_km');
    await queryInterface.removeColumn('Vehicles', 'fuel_type');
  },
};
