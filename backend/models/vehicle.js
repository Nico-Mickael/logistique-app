'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Vehicle extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
  Vehicle.hasMany(models.Sortie, { foreignKey: 'vehicle_id' });
}
  }
  Vehicle.init({
    type: DataTypes.STRING,
    capacity: DataTypes.INTEGER,
    status: DataTypes.STRING,
    maintenance_until: DataTypes.DATE
  }, {
    sequelize,
    modelName: 'Vehicle',
  });
  return Vehicle;
};