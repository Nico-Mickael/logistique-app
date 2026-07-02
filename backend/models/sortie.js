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
  Sortie.belongsToMany(models.Request, { through: models.SortieRequest, foreignKey: 'sortie_id' });
}
  }
  Sortie.init({
    vehicle_id: DataTypes.INTEGER,
    driver_name: DataTypes.STRING,
    destination: DataTypes.STRING,
    departure_time: DataTypes.DATE,
    status: DataTypes.STRING,
    departure_km: DataTypes.INTEGER,
    arrival_km: DataTypes.INTEGER,
    distance_km: DataTypes.INTEGER
  }, {
    sequelize,
    modelName: 'Sortie',
  });
  return Sortie;
};