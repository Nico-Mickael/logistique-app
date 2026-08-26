'use strict';

module.exports = (sequelize, DataTypes) => {
  const Session = sequelize.define('Session', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    refresh_token_hash: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    ip_address: {
      type: DataTypes.STRING,
    },
    user_agent: {
      type: DataTypes.TEXT,
    },
    device_info: {
      type: DataTypes.STRING,
    },
    last_active_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    revoked: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    revoked_at: {
      type: DataTypes.DATE,
    },
  }, {
    tableName: 'Sessions',
    timestamps: true,
  });

  Session.associate = (models) => {
    Session.belongsTo(models.Employee, { foreignKey: 'user_id', as: 'user' });
  };

  return Session;
};
