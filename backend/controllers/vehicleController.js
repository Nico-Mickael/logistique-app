const { Vehicle } = require('../models');

exports.getAll = async (req, res) => {
  try {
    const vehicles = await Vehicle.findAll();
    res.json(vehicles);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

exports.getAvailable = async (req, res) => {
  try {
    const vehicles = await Vehicle.findAll({ where: { status: 'available' } });
    res.json(vehicles);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { type, capacity } = req.body;
    const vehicle = await Vehicle.create({ type, capacity, status: 'available' });
    res.status(201).json(vehicle);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const { status, maintenance_until } = req.body;
    const vehicle = await Vehicle.findByPk(req.params.id);

    if (!vehicle) {
      return res.status(404).json({ message: 'Véhicule introuvable' });
    }

    if (status) vehicle.status = status;
    if (maintenance_until) vehicle.maintenance_until = maintenance_until;
    await vehicle.save();

    res.json(vehicle);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};