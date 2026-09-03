'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Maintenance extends Model {
    static associate(models) {
      Maintenance.belongsTo(models.Vehicle, { foreignKey: 'vehicle_id', as: 'vehicle' });
    }
  }
  Maintenance.init({
    vehicle_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
    },
    cost: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    next_due_km: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    next_due_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'planned',
    },
  }, {
    sequelize,
    modelName: 'Maintenance',
    tableName: 'Maintenances',
  });
  return Maintenance;
};
