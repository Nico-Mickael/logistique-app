const { Vehicle, Request, Employee } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { VEHICLE_STATUSES } = require('../utils/constants');
const { notifyChiefsDb } = require('./notificationController');

exports.getAll = asyncHandler(async (req, res) => {
  const vehicles = await Vehicle.findAll();
  res.json(vehicles);
});

exports.getAvailable = asyncHandler(async (req, res) => {
  const vehicles = await Vehicle.findAll({ where: { status: 'available' } });
  res.json(vehicles);
});

exports.create = asyncHandler(async (req, res) => {
  const { type, capacity } = req.body;
  const vehicle = await Vehicle.create({ type, capacity, status: 'available' });
  res.status(201).json(vehicle);
});

exports.getOccupancy = asyncHandler(async (req, res) => {
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
});

exports.update = asyncHandler(async (req, res) => {
  const { type, capacity, status, maintenance_until } = req.body;
  const vehicle = await Vehicle.findByPk(req.params.id);

  if (!vehicle) {
    return res.status(404).json({ message: 'Véhicule introuvable' });
  }

  if (type) vehicle.type = type;
  if (capacity) vehicle.capacity = capacity;
  const previousStatus = vehicle.status;
  if (status) {
    if (!VEHICLE_STATUSES.includes(status)) {
      return res.status(400).json({ message: 'Statut invalide' });
    }
    vehicle.status = status;
    if (status === 'available') vehicle.maintenance_until = null;
  }
  if (maintenance_until !== undefined) vehicle.maintenance_until = maintenance_until;

  await vehicle.save();

  // Alerte les chefs quand un véhicule devient indisponible (panne / maintenance)
  if (status && status !== previousStatus && ['broken', 'maintenance'].includes(status)) {
    await notifyChiefsDb({
      message: `Véhicule #${vehicle.id} (${vehicle.type}) ${
        status === 'broken' ? 'en panne' : 'en maintenance'
      }`,
      type: 'vehicle_alert',
      excludeUserId: req.user.id,
    });
  }

  res.json(vehicle);
});

exports.remove = asyncHandler(async (req, res) => {
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
});
