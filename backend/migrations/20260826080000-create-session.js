'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Sessions', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Employees', key: 'id' },
        onDelete: 'CASCADE',
      },
      refresh_token_hash: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      ip_address: {
        type: Sequelize.STRING,
      },
      user_agent: {
        type: Sequelize.TEXT,
      },
      device_info: {
        type: Sequelize.STRING,
      },
      last_active_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      revoked: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      revoked_at: {
        type: Sequelize.DATE,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    await queryInterface.addIndex('Sessions', ['user_id']);
    await queryInterface.addIndex('Sessions', ['refresh_token_hash']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('Sessions');
  },
};
