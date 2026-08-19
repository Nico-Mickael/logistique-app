'use strict';

module.exports = {
  async up(queryInterface) {
    // Find the existing constraint name
    const constraints = await queryInterface.showConstraint('Sorties');
    const fk = constraints.find(
      (c) => c.constraintType === 'FOREIGN KEY' && c.columnName === 'vehicle_id'
    );

    if (fk) {
      await queryInterface.removeConstraint('Sorties', fk.constraintName);
    }

    await queryInterface.addConstraint('Sorties', {
      fields: ['vehicle_id'],
      type: 'foreign key',
      name: 'Sorties_vehicle_id_fkey',
      references: { table: 'Vehicles', field: 'id' },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });
  },

  async down(queryInterface) {
    const constraints = await queryInterface.showConstraint('Sorties');
    const fk = constraints.find(
      (c) => c.constraintType === 'FOREIGN KEY' && c.columnName === 'vehicle_id'
    );

    if (fk) {
      await queryInterface.removeConstraint('Sorties', fk.constraintName);
    }

    await queryInterface.addConstraint('Sorties', {
      fields: ['vehicle_id'],
      type: 'foreign key',
      name: 'Sorties_vehicle_id_fkey',
      references: { table: 'Vehicles', field: 'id' },
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE',
    });
  },
};
