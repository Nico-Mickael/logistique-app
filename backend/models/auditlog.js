'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class AuditLog extends Model {
    static associate(models) {
      AuditLog.belongsTo(models.Employee, { foreignKey: 'user_id', as: 'user' });
    }
  }
  AuditLog.init({
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    action: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    entity: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    entity_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    old_value: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    new_value: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    ip_address: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    user_agent: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    sequelize,
    modelName: 'AuditLog',
    tableName: 'AuditLogs',
  });
  return AuditLog;
};
