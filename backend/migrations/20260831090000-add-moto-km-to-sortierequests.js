'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('SortieRequests', 'departure_km', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.addColumn('SortieRequests', 'return_km', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.addColumn('SortieRequests', 'distance_km', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.addColumn('SortieRequests', 'status', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('SortieRequests', 'returned_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('SortieRequests', 'returned_at');
    await queryInterface.removeColumn('SortieRequests', 'status');
    await queryInterface.removeColumn('SortieRequests', 'distance_km');
    await queryInterface.removeColumn('SortieRequests', 'return_km');
    await queryInterface.removeColumn('SortieRequests', 'departure_km');
  }
};
