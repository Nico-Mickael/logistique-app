const { Request, Employee, Vehicle, Sortie, SortieRequest } = require('../models');
const { Op } = require('sequelize');
const asyncHandler = require('../utils/asyncHandler');
const { ACTIVE_REQUEST_STATUSES } = require('../utils/constants');
const { createNotification } = require('./notificationController');
const { autoCreateSortie } = require('../services/sortieService');
const vehicleService = require('../services/vehicleService');

// Employé : créer une demande
exports.create = asyncHandler(async (req, res) => {
  const { destination, motif, date_souhaitee, nb_personnes, vehicle_id } = req.body;

  if (vehicle_id) {
    const vehicle = await Vehicle.findByPk(vehicle_id);
    if (!vehicle || vehicle.status !== 'available') {
      return res.status(400).json({ message: 'Véhicule indisponible' });
    }

    const requestedDate = new Date(date_souhaitee);
    const startOfDay = new Date(requestedDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(requestedDate);
    endOfDay.setHours(23, 59, 59, 999);

    const occupiedRequests = await Request.findAll({
      where: {
        vehicle_id,
        status: ACTIVE_REQUEST_STATUSES,
        date_souhaitee: { [Op.between]: [startOfDay, endOfDay] },
      },
      attributes: ['nb_personnes'],
    });
    const occupiedSeats = occupiedRequests.reduce((sum, r) => sum + (r.nb_personnes || 0), 0);
    if (occupiedSeats + nb_personnes > vehicle.capacity) {
      return res.status(400).json({ message: 'Pas assez de places disponibles dans ce véhicule pour cette date' });
    }
  }

  const request = await Request.create({
    employee_id: req.user.id,
    vehicle_id: vehicle_id || null,
    destination,
    motif,
    date_souhaitee,
    nb_personnes,
    status: 'pending',
  });

  res.status(201).json(request);
});

// Employé : voir ses propres demandes
exports.mine = asyncHandler(async (req, res) => {
  const requests = await Request.findAll({
    where: { employee_id: req.user.id },
    include: [
      { model: Vehicle, attributes: ['id', 'type', 'capacity'] },
      { model: Sortie, attributes: ['id', 'destination', 'status', 'departure_km', 'arrival_km', 'distance_km', 'return_km', 'returned_at', 'departure_time'], through: { attributes: [] } },
    ],
    order: [['createdAt', 'DESC']],
  });
  res.json(requests);
});

// Chef logistique : voir toutes les demandes avec filtres + pagination
exports.all = asyncHandler(async (req, res) => {
  const {
    page = 1, limit = 50,
    status, employee_id, destination,
    date_from, date_to,
  } = req.query;

  const where = {};
  if (status) where.status = status;
  if (employee_id) where.employee_id = parseInt(employee_id, 10);
  if (destination) where.destination = { [Op.iLike]: `%${destination}%` };
  if (date_from) where.date_souhaitee = { ...where.date_souhaitee, [Op.gte]: new Date(date_from) };
  if (date_to) where.date_souhaitee = { ...where.date_souhaitee, [Op.lte]: new Date(date_to) };

  const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const { count, rows } = await Request.findAndCountAll({
    where,
    include: [
      { model: Employee, attributes: ['id', 'nom', 'prenom', 'department'] },
      { model: Vehicle, attributes: ['id', 'type', 'capacity'] },
      { model: Sortie, attributes: ['id', 'destination', 'status', 'departure_km', 'arrival_km', 'distance_km', 'return_km', 'returned_at', 'departure_time'], through: { attributes: [] } },
    ],
    order: [['createdAt', 'DESC']],
    offset,
    limit: parseInt(limit, 10),
  });

  res.json({
    data: rows,
    total: count,
    page: parseInt(page, 10),
    totalPages: Math.ceil(count / parseInt(limit, 10)),
  });
});

// Chef logistique : valider / refuser / replanifier
exports.updateStatus = asyncHandler(async (req, res) => {
  const { status, new_date } = req.body;
  const request = await Request.findByPk(req.params.id);

  if (!request) {
    return res.status(404).json({ message: 'Demande introuvable' });
  }

  if (!['approved', 'rejected', 'rescheduled'].includes(status)) {
    return res.status(400).json({ message: 'Statut invalide' });
  }

  const allowedTransitions = { pending: ['approved', 'rejected', 'rescheduled'], rescheduled: ['approved', 'rejected'] };
  if (!allowedTransitions[request.status]?.includes(status)) {
    return res.status(400).json({ message: `Impossible de passer de "${request.status}" à "${status}"` });
  }

  request.status = status;
  if (status === 'rescheduled' && new_date) {
    request.date_souhaitee = new_date;
  }
  await request.save();

  if (status === 'approved') {
    await autoCreateSortie(request);
  }

  await createNotification({
    user_id: request.employee_id,
    message: `Votre demande vers ${request.destination} a été ${
      status === 'approved' ? 'validée' :
      status === 'rejected' ? 'refusée' : 'replanifiée'
    }`,
    type: status,
  });

  res.json(request);
});

// Employé : annuler sa propre demande (même validée)
exports.cancel = asyncHandler(async (req, res) => {
  const request = await Request.findByPk(req.params.id);

  if (!request) return res.status(404).json({ message: 'Demande introuvable' });
  if (request.employee_id !== req.user.id) {
    return res.status(403).json({ message: 'Action non autorisée' });
  }
  if (!['pending', 'approved', 'rescheduled'].includes(request.status)) {
    return res.status(400).json({ message: 'Cette demande ne peut plus être annulée' });
  }

  const wasApproved = request.status === 'approved';
  const vehicleId = request.vehicle_id;

  await SortieRequest.destroy({ where: { request_id: request.id } });

  request.status = 'cancelled';
  request.vehicle_id = null;
  await request.save();

  if (wasApproved && vehicleId) {
    await vehicleService.releaseIfIdle(vehicleId);
  }

  await createNotification({
    user_id: request.employee_id,
    message: `Votre demande vers ${request.destination} a été annulée`,
    type: 'cancelled',
  });

  res.json(request);
});

// Employé : modifier sa propre demande (uniquement si pending)
exports.update = asyncHandler(async (req, res) => {
  const request = await Request.findByPk(req.params.id);
  if (!request) return res.status(404).json({ message: 'Demande introuvable' });
  if (request.employee_id !== req.user.id) {
    return res.status(403).json({ message: 'Action non autorisée' });
  }
  if (request.status !== 'pending') {
    return res.status(400).json({ message: 'Seules les demandes en attente peuvent être modifiées' });
  }

  const { destination, motif, date_souhaitee, nb_personnes, vehicle_id } = req.body;
  if (destination !== undefined) request.destination = destination;
  if (motif !== undefined) request.motif = motif;
  if (date_souhaitee !== undefined) request.date_souhaitee = date_souhaitee;
  if (nb_personnes !== undefined) request.nb_personnes = nb_personnes;
  if (vehicle_id !== undefined) request.vehicle_id = vehicle_id;

  await request.save();
  res.json(request);
});

// Employé : répondre à une proposition de replanification
exports.respondReschedule = asyncHandler(async (req, res) => {
  const { accepted } = req.body;
  const request = await Request.findByPk(req.params.id);

  if (!request) return res.status(404).json({ message: 'Demande introuvable' });
  if (request.employee_id !== req.user.id) {
    return res.status(403).json({ message: 'Action non autorisée' });
  }
  if (request.status !== 'rescheduled') {
    return res.status(400).json({ message: 'Cette demande n\'est pas en attente de réponse' });
  }

  request.status = accepted ? 'approved' : 'rejected';
  await request.save();

  if (accepted) {
    await autoCreateSortie(request);
  }

  await createNotification({
    user_id: request.employee_id,
    message: accepted
      ? `Vous avez accepté la replanification pour ${request.destination}`
      : `Vous avez refusé la replanification pour ${request.destination}`,
    type: accepted ? 'approved' : 'rejected',
  });

  res.json(request);
});
