'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Message extends Model {
    static associate(models) {
      Message.belongsTo(models.Conversation, { foreignKey: 'conversation_id' });
      Message.belongsTo(models.Employee, { as: 'sender', foreignKey: 'sender_id' });
      Message.hasMany(models.MessageRead, { foreignKey: 'message_id' });
    }
  }
  Message.init({
    conversation_id: { type: DataTypes.INTEGER, allowNull: false },
    sender_id: { type: DataTypes.INTEGER, allowNull: false },
    content: { type: DataTypes.TEXT, allowNull: false },
  }, {
    sequelize,
    modelName: 'Message',
  });
  return Message;
};