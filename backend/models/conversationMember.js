'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class ConversationMember extends Model {
    static associate(models) {
      ConversationMember.belongsTo(models.Conversation, { foreignKey: 'conversation_id' });
      ConversationMember.belongsTo(models.Employee, { foreignKey: 'user_id' });
    }
  }
  ConversationMember.init({
    conversation_id: { type: DataTypes.INTEGER, allowNull: false },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
  }, {
    sequelize,
    modelName: 'ConversationMember',
  });
  return ConversationMember;
};