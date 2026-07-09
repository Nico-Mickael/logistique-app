const { Vehicle, Request, Employee } = require('../models');

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

exports.getOccupancy = async (req, res) => {
  try {
    const { Op } = require('sequelize');
    const vehicles = await Vehicle.findAll();

    const result = await Promise.all(vehicles.map(async (vehicle) => {
      const requests = await Request.findAll({
        where: { vehicle_id: vehicle.id, status: ['pending', 'approved', 'rescheduled'] },
        include: [{ model: Employee, attributes: ['nom', 'prenom', 'department'] }],
      });

      const occupiedSeats = requests.reduce((sum, r) => sum + r.nb_personnes, 0);
      const hasPastApproved = requests.some(
        (r) => r.status === 'approved' && new Date(r.date_souhaitee).getTime() < Date.now()
      );

      return {
        ...vehicle.toJSON(),
        occupiedSeats,
        availableSeats: Math.max(0, vehicle.capacity - occupiedSeats),
        status: hasPastApproved ? 'busy' : vehicle.status,
        occupants: requests.map((r) => ({
          id: r.id,
          employee_id: r.employee_id,
          employee: r.Employee,
          nb_personnes: r.nb_personnes,
          status: r.status,
          destination: r.destination,
          date_souhaitee: r.date_souhaitee,
        })),
      };
    }));

    res.json(result);
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