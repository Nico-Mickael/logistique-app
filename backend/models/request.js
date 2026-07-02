'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Request extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
  Request.belongsTo(models.Employee, { foreignKey: 'employee_id' });
  Request.belongsToMany(models.Sortie, { through: models.SortieRequest, foreignKey: 'request_id' });
}
  }
  Request.init({
    employee_id: DataTypes.INTEGER,
    destination: DataTypes.STRING,
    motif: DataTypes.STRING,
    date_souhaitee: DataTypes.DATE,
    nb_personnes: DataTypes.INTEGER,
    status: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'Request',
  });
  return Request;
};