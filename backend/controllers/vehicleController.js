const { Vehicle, Request, Employee } = require('../models');
const { Op } = require('sequelize');

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
    const vehicles = await Vehicle.findAll();

    const allRequests = await Request.findAll({
      where: { status: ['pending', 'approved', 'rescheduled'] },
      include: [{ model: Employee, attributes: ['nom', 'prenom', 'department'] }],
    });

    const requestsByVehicle = {};
    for (const r of allRequests) {
      if (r.vehicle_id) {
        if (!requestsByVehicle[r.vehicle_id]) requestsByVehicle[r.vehicle_id] = [];
        requestsByVehicle[r.vehicle_id].push(r);
      }
    }

    const result = vehicles.map((vehicle) => {
      const requests = requestsByVehicle[vehicle.id] || [];
      const occupiedSeats = requests.reduce((sum, r) => sum + (r.nb_personnes || 0), 0);

      return {
        ...vehicle.toJSON(),
        occupiedSeats,
        availableSeats: Math.max(0, vehicle.capacity - occupiedSeats),
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
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const { type, capacity, status, maintenance_until } = req.body;
    const vehicle = await Vehicle.findByPk(req.params.id);

    if (!vehicle) {
      return res.status(404).json({ message: 'Véhicule introuvable' });
    }

    if (type) vehicle.type = type;
    if (capacity) vehicle.capacity = capacity;
    if (status) {
      const validStatuses = ['available', 'busy', 'maintenance', 'broken'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: 'Statut invalide' });
      }
      vehicle.status = status;
      if (status === 'available') vehicle.maintenance_until = null;
    }
    if (maintenance_until !== undefined) vehicle.maintenance_until = maintenance_until;
    await vehicle.save();

    res.json(vehicle);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const vehicle = await Vehicle.findByPk(req.params.id);

    if (!vehicle) {
      return res.status(404).json({ message: 'Véhicule introuvable' });
    }

    if (vehicle.status === 'busy') {
      return res.status(400).json({ message: 'Impossible de supprimer un véhicule en cours de sortie' });
    }

    const hasSorties = await vehicle.getSorties();
    if (hasSorties.length > 0) {
      return res.status(400).json({ message: 'Impossible de supprimer un véhicule ayant déjà des sorties enregistrées' });
    }

    await vehicle.destroy();
    res.json({ message: 'Véhicule supprimé' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};