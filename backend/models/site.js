'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Site extends Model {
    static associate(models) {
      Site.hasMany(models.Employee, { foreignKey: 'site_id' });
      Site.hasMany(models.Vehicle, { foreignKey: 'site_id' });
      Site.hasMany(models.Request, { foreignKey: 'site_id' });
      Site.hasMany(models.Sortie, { foreignKey: 'site_id' });
    }
  }
  Site.init({
    name: { type: DataTypes.STRING, allowNull: false },
    code: { type: DataTypes.STRING, allowNull: false, unique: true },
    city: DataTypes.STRING,
    address: DataTypes.STRING,
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'active' },
  }, {
    sequelize,
    modelName: 'Site',
  });
  return Site;
};