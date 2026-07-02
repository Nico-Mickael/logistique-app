const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Employee } = require('../models');

exports.register = async (req, res) => {
  try {
    const { nom, prenom, email, password, department, role } = req.body;

    const existing = await Employee.findOne({ where: { email } });
    if (existing) {
      return res.status(400).json({ message: 'Cet email est déjà utilisé' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const employee = await Employee.create({
      nom, prenom, email,
      password: hashedPassword,
      department,
      role: role || 'employee',
    });

    res.status(201).json({
      id: employee.id,
      nom: employee.nom,
      prenom: employee.prenom,
      email: employee.email,
      role: employee.role,
    });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

exports.login = async (req, res) => {
  try {
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
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

exports.me = async (req, res) => {
  try {
    const employee = await Employee.findByPk(req.user.id, {
      attributes: ['id', 'nom', 'prenom', 'email', 'department', 'role'],
    });
    res.json(employee);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};