'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class PushSubscription extends Model {
    static associate(models) {
      PushSubscription.belongsTo(models.Employee, { foreignKey: 'user_id' });
    }
  }
  PushSubscription.init({
    user_id: DataTypes.INTEGER,
    endpoint: DataTypes.TEXT,
    p256dh: DataTypes.TEXT,
    auth: DataTypes.TEXT,
    device: DataTypes.STRING,
  }, {
    sequelize,
    modelName: 'PushSubscription',
    tableName: 'PushSubscriptions',
    indexes: [
      { unique: true, fields: ['user_id', 'endpoint'] },
    ],
  });
  return PushSubscription;
};