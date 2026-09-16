'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Employee extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
static associate(models) {
  Employee.hasMany(models.Request, { foreignKey: 'employee_id' });
  Employee.hasMany(models.Notification, { foreignKey: 'user_id' });
  Employee.belongsTo(models.Site, { foreignKey: 'site_id' });
}
  }
  Employee.init({
    nom: DataTypes.STRING,
    prenom: DataTypes.STRING,
    email: DataTypes.STRING,
    password: DataTypes.STRING,
    department: DataTypes.STRING,
    role: DataTypes.STRING,
    site_id: DataTypes.INTEGER,
    // Disponibilité professionnelle (distincte de l'état de connexion technique) :
    // 'available' (par défaut) | 'offline' | 'on_leave' | 'absent'.
    // La connexion/déconnexion à l'application ne modifie JAMAIS ce champ.
    availability_status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'available' },
    leave_start_date: { type: DataTypes.DATEONLY, allowNull: true },
    leave_end_date: { type: DataTypes.DATEONLY, allowNull: true },
    availability_updated_at: { type: DataTypes.DATE, allowNull: true },
  }, {
    sequelize,
    modelName: 'Employee',
  });
  return Employee;
};