'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class MessageRead extends Model {
    static associate(models) {
      MessageRead.belongsTo(models.Message, { foreignKey: 'message_id' });
      MessageRead.belongsTo(models.Employee, { foreignKey: 'user_id' });
    }
  }
  MessageRead.init({
    message_id: { type: DataTypes.INTEGER, allowNull: false },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    read_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  }, {
    sequelize,
    modelName: 'MessageRead',
  });
  return MessageRead;
};