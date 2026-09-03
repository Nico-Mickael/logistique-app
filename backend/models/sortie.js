'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Sortie extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
  Sortie.belongsTo(models.Vehicle, { foreignKey: 'vehicle_id' });
  Sortie.belongsTo(models.Employee, { as: 'driver', foreignKey: 'driver_employee_id' });
  Sortie.belongsToMany(models.Request, { through: models.SortieRequest, foreignKey: 'sortie_id' });
}
  }
  Sortie.init({
    vehicle_id: DataTypes.INTEGER,
    driver_employee_id: DataTypes.INTEGER,
    driver_name: DataTypes.STRING,
    destination: DataTypes.STRING,
    departure_time: DataTypes.DATE,
    status: DataTypes.STRING,
    departure_km: DataTypes.INTEGER,
    arrival_km: DataTypes.INTEGER,
    distance_km: DataTypes.INTEGER,
    return_km: DataTypes.INTEGER,
    returned_at: DataTypes.DATE,
    departed_at: DataTypes.DATE,
    fuel_litres: DataTypes.DECIMAL(8, 2),
    fuel_cost: DataTypes.DECIMAL(10, 2)
  }, {
    sequelize,
    modelName: 'Sortie',
  });
  return Sortie;
};