const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Employee } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { ALL_ROLES } = require('../utils/constants');

exports.register = asyncHandler(async (req, res) => {
  const { nom, prenom, email, password, department, role } = req.body;

  if (!nom || !prenom || !email || !password) {
    return res.status(400).json({ message: 'Champs obligatoires : nom, prenom, email, password' });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ message: 'Format d\'email invalide' });
  }

  if (password.length < 4) {
    return res.status(400).json({ message: 'Le mot de passe doit contenir au moins 4 caractères' });
  }

  const existing = await Employee.findOne({ where: { email } });
  if (existing) {
    return res.status(400).json({ message: 'Cet email est déjà utilisé' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const finalRole = ALL_ROLES.includes(role) ? role : 'employee';

  const employee = await Employee.create({
    nom, prenom, email,
    password: hashedPassword,
    department,
    role: finalRole,
  });

  res.status(201).json({
    id: employee.id,
    nom: employee.nom,
    prenom: employee.prenom,
    email: employee.email,
    role: employee.role,
  });
});

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const employee = await Employee.findOne({ where: { email } });
  if (!employee) {
    return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
  }

  const valid = await bcrypt.compare(password, employee.password);
  if (!valid) {
    return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
  }

  const token = jwt.sign(
    { id: employee.id, role: employee.role },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );

  res.json({
    token,
    user: {
      id: employee.id,
      nom: employee.nom,
      prenom: employee.prenom,
      email: employee.email,
      role: employee.role,
    },
  });
});

exports.me = asyncHandler(async (req, res) => {
  const employee = await Employee.findByPk(req.user.id, {
    attributes: ['id', 'nom', 'prenom', 'email', 'department', 'role'],
  });
  if (!employee) {
    return res.status(404).json({ message: 'Utilisateur introuvable' });
  }
  res.json(employee);
});
