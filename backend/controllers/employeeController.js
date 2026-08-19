const bcrypt = require('bcrypt');
const { Employee, Request, Notification, SortieRequest } = require('../models');

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
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'Format d\'email invalide' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Le mot de passe doit contenir au moins 6 caractères' });
    }
    const existing = await Employee.findOne({ where: { email } });
    if (existing) return res.status(400).json({ message: 'Cet email est déjà utilisé' });
    const hashedPassword = await bcrypt.hash(password, 10);
    const validRoles = ['employee', 'logistics_chief', 'admin'];
    const finalRole = validRoles.includes(role) ? role : 'employee';
    const employee = await Employee.create({ nom, prenom, email, password: hashedPassword, department, role: finalRole });
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
    if (email && email !== employee.email) {
      const existing = await Employee.findOne({ where: { email } });
      if (existing) return res.status(400).json({ message: 'Cet email est déjà utilisé' });
    }
    if (nom !== undefined) employee.nom = nom;
    if (prenom !== undefined) employee.prenom = prenom;
    if (email !== undefined) employee.email = email;
    if (department !== undefined) employee.department = department;
    if (role !== undefined) {
      const validRoles = ['employee', 'logistics_chief', 'admin', 'superadmin'];
      if (!validRoles.includes(role)) return res.status(400).json({ message: 'Rôle invalide' });
      employee.role = role;
    }
    if (password) {
      if (password.length < 6) return res.status(400).json({ message: 'Le mot de passe doit contenir au moins 6 caractères' });
      employee.password = await bcrypt.hash(password, 10);
    }
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

    const requests = await Request.findAll({ where: { employee_id: req.params.id }, attributes: ['id'] });
    const requestIds = requests.map((r) => r.id);

    if (requestIds.length > 0) {
      await SortieRequest.destroy({ where: { request_id: requestIds } });
    }
    await Request.destroy({ where: { employee_id: req.params.id } });
    await Notification.destroy({ where: { user_id: req.params.id } });
    await employee.destroy();

    res.json({ message: 'Utilisateur supprimé' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};
