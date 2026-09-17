'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Conversations', {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
      type: { allowNull: false, type: Sequelize.STRING },
      sortie_id: { type: Sequelize.INTEGER, allowNull: true },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE },
    });

    await queryInterface.createTable('ConversationMembers', {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
      conversation_id: { allowNull: false, type: Sequelize.INTEGER },
      user_id: { allowNull: false, type: Sequelize.INTEGER },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE },
    });

    await queryInterface.createTable('Messages', {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
      conversation_id: { allowNull: false, type: Sequelize.INTEGER },
      sender_id: { allowNull: false, type: Sequelize.INTEGER },
      content: { allowNull: false, type: Sequelize.TEXT },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE },
    });

    await queryInterface.createTable('MessageReads', {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
      message_id: { allowNull: false, type: Sequelize.INTEGER },
      user_id: { allowNull: false, type: Sequelize.INTEGER },
      read_at: { allowNull: false, type: Sequelize.DATE },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE },
    });

    await queryInterface.addIndex('Conversations', ['sortie_id'], { name: 'conversations_sortie_idx' });
    await queryInterface.addIndex('ConversationMembers', ['conversation_id', 'user_id'], { unique: true, name: 'conversation_members_unique' });
    await queryInterface.addIndex('Messages', ['conversation_id', 'id'], { name: 'messages_conversation_idx' });
    await queryInterface.addIndex('MessageReads', ['message_id', 'user_id'], { unique: true, name: 'message_reads_unique' });
    await queryInterface.addIndex('MessageReads', ['user_id'], { name: 'message_reads_user_idx' });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('MessageReads', 'message_reads_user_idx');
    await queryInterface.removeIndex('MessageReads', 'message_reads_unique');
    await queryInterface.removeIndex('Messages', 'messages_conversation_idx');
    await queryInterface.removeIndex('ConversationMembers', 'conversation_members_unique');
    await queryInterface.removeIndex('Conversations', 'conversations_sortie_idx');
    await queryInterface.dropTable('MessageReads');
    await queryInterface.dropTable('Messages');
    await queryInterface.dropTable('ConversationMembers');
    await queryInterface.dropTable('Conversations');
  },
};