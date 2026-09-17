'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Conversation extends Model {
    static associate(models) {
      Conversation.hasMany(models.ConversationMember, { foreignKey: 'conversation_id' });
      Conversation.hasMany(models.Message, { foreignKey: 'conversation_id' });
      Conversation.belongsTo(models.Sortie, { foreignKey: 'sortie_id' });
    }
  }
  Conversation.init({
    type: { type: DataTypes.STRING, allowNull: false },
    sortie_id: { type: DataTypes.INTEGER, allowNull: true },
  }, {
    sequelize,
    modelName: 'Conversation',
  });
  return Conversation;
};