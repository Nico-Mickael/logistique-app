'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Notification extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
    Notification.belongsTo(models.Employee, { foreignKey: 'user_id' });
  }
  }
  Notification.init({
    user_id: DataTypes.INTEGER,
    message: DataTypes.STRING,
    type: DataTypes.STRING,
    is_read: { type: DataTypes.BOOLEAN, defaultValue: false },
    // Traçabilité entité (typiquement sortie) : sert principalement à
    // garantir l'anti-doublon des notifications par événement métier.
    entity_type: DataTypes.STRING,
    entity_id: DataTypes.INTEGER,
  }, {
    sequelize,
    modelName: 'Notification',
  });
  return Notification;
};