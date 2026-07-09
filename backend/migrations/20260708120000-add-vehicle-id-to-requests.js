'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Requests', 'vehicle_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'Vehicles', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('Requests', 'vehicle_id');
  }
};
