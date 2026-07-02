'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class SortieRequest extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  SortieRequest.init({
    sortie_id: DataTypes.INTEGER,
    request_id: DataTypes.INTEGER
  }, {
    sequelize,
    modelName: 'SortieRequest',
  });
  return SortieRequest;
};