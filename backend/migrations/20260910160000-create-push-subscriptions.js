'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('PushSubscriptions', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Employees', key: 'id' },
        onDelete: 'CASCADE',
      },
      endpoint: { type: Sequelize.TEXT, allowNull: false },
      p256dh: { type: Sequelize.TEXT, allowNull: false },
      auth: { type: Sequelize.TEXT, allowNull: false },
      device: { type: Sequelize.STRING, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('PushSubscriptions', {
      name: 'push_subscriptions_user_endpoint_unique',
      fields: ['user_id', 'endpoint'],
      unique: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('PushSubscriptions');
  },
};