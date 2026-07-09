const bcrypt = require('bcrypt');
const { Employee } = require('../models');

exports.list = async (req, res) => {
  try {
    const employees = await Employee.findAll({
      attributes: ['id', 'nom', 'prenom', 'email', 'department', 'role', 'createdAt', 'updatedAt'],
      order: [['createdAt', 'DESC']],
    });
    res.json(employees);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { nom, prenom, email, password, department, role } = req.body;
    if (!nom || !prenom || !email || !password) {
      return res.status(400).json({ message: 'Champs obligatoires : nom, prenom, email, password' });
    }
    const existing = await Employee.findOne({ where: { email } });
    if (existing) return res.status(400).json({ message: 'Cet email est déjà utilisé' });
    const hashedPassword = await bcrypt.hash(password, 10);
    const employee = await Employee.create({ nom, prenom, email, password: hashedPassword, department, role: role || 'employee' });
    res.status(201).json({ id: employee.id, nom: employee.nom, prenom: employee.prenom, email: employee.email, department: employee.department, role: employee.role });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const { nom, prenom, email, department, role, password } = req.body;
    const employee = await Employee.findByPk(req.params.id);
    if (!employee) return res.status(404).json({ message: 'Utilisateur introuvable' });
    if (nom !== undefined) employee.nom = nom;
    if (prenom !== undefined) employee.prenom = prenom;
    if (email !== undefined) employee.email = email;
    if (department !== undefined) employee.department = department;
    if (role !== undefined) employee.role = role;
    if (password) employee.password = await bcrypt.hash(password, 10);
    await employee.save();
    res.json({ id: employee.id, nom: employee.nom, prenom: employee.prenom, email: employee.email, department: employee.department, role: employee.role });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const employee = await Employee.findByPk(req.params.id);
    if (!employee) return res.status(404).json({ message: 'Utilisateur introuvable' });
    await employee.destroy();
    res.json({ message: 'Utilisateur supprimé' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};
