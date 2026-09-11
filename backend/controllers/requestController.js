const { Request, Employee, Vehicle, Sortie, SortieRequest, sequelize } = require('../models');
const { Op } = require('sequelize');
const asyncHandler = require('../utils/asyncHandler');
const { ACTIVE_REQUEST_STATUSES, CHIEF_ROLES, STARTED_SORTIE_STATUSES } = require('../utils/constants');
const { createNotification, notifyChiefsDb } = require('./notificationController');
const { notifyChiefs } = require('../services/socketService');
const { autoCreateSortie, isSameCalendarDay, normalizeDestination } = require('../services/sortieService');
const vehicleService = require('../services/vehicleService');
const { logAudit } = require('../services/auditService');

// Employé : créer une demande
exports.create = asyncHandler(async (req, res) => {
  const { destination, motif, date_souhaitee, nb_personnes, vehicle_id } = req.body;

  if (vehicle_id) {
    const vehicle = await Vehicle.findByPk(vehicle_id);
    // Tant que la sortie n'a pas démarré, le véhicule reste demandable même si
    // une sortie est déjà planifiée dessus (le véhicule est alors "busy").
    const startedSortie = vehicle
      ? await Sortie.findOne({
          where: { vehicle_id: vehicle.id, status: { [Op.in]: STARTED_SORTIE_STATUSES } },
          attributes: ['id'],
        })
      : null;
    if (!vehicleService.isRequestable(vehicle, !!startedSortie)) {
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

  const creator = await Employee.findByPk(req.user.id, { attributes: ['id', 'nom', 'prenom'] });
  await notifyChiefsDb({
    message: `Nouvelle demande de ${creator ? `${creator.prenom} ${creator.nom}` : 'un employé'} vers ${request.destination}`,
    type: 'new_request',
    excludeUserId: req.user.id,
  });

  await logAudit({ userId: req.user.id, action: 'create', entity: 'Request', entityId: request.id, newValue: { destination, motif, date_souhaitee, nb_personnes, vehicle_id }, req });

  res.status(201).json(request);
});

// Employé : voir ses propres demandes
exports.mine = asyncHandler(async (req, res) => {
  const requests = await Request.findAll({
    where: { employee_id: req.user.id },
    include: [
      { model: Vehicle, attributes: ['id', 'type', 'capacity', 'name'] },
      { model: Sortie, attributes: ['id', 'destination', 'status', 'motif', 'departure_km', 'arrival_km', 'distance_km', 'return_km', 'returned_at', 'departure_time'], through: { attributes: [] } },
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
      { model: Vehicle, attributes: ['id', 'type', 'capacity', 'name'] },
      { model: Sortie, attributes: ['id', 'destination', 'status', 'motif', 'departure_km', 'arrival_km', 'distance_km', 'return_km', 'returned_at', 'departure_time'], through: { attributes: [] } },
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

// Chef logistique : demandes VALIDÉES sans sortie (le véhicule demandé était
// déjà occupé et aucune destination compatible ne permettait le regroupement).
// Pour chaque demande, on renseigne `conflict` = la sortie planifiée la plus
// proche du jour sur le véhicule demandé → le chef voit quand le conflit est
// une question d'heure et peut proposer une replanification.
exports.toProcess = asyncHandler(async (req, res) => {
  const requests = await Request.findAll({
    where: {
      status: 'approved',
      id: { [Op.notIn]: sequelize.literal('(SELECT "request_id" FROM "SortieRequests")') },
    },
    include: [
      { model: Employee, attributes: ['id', 'nom', 'prenom', 'department'] },
      { model: Vehicle, attributes: ['id', 'type', 'capacity', 'name'] },
    ],
    order: [['date_souhaitee', 'ASC']],
  });

  const vehicleIds = [...new Set(requests.map((r) => r.vehicle_id).filter(Boolean))];
  const planned = vehicleIds.length > 0
    ? await Sortie.findAll({
        where: { vehicle_id: { [Op.in]: vehicleIds }, status: 'planned' },
        attributes: ['id', 'vehicle_id', 'destination', 'departure_time'],
      })
    : [];

  const result = requests.map((r) => {
    const json = r.toJSON();
    const reqTime = new Date(r.date_souhaitee);
    let conflict = null;
    if (r.vehicle_id && !isNaN(reqTime.getTime())) {
      let best = null;
      let bestGap = Infinity;
      for (const s of planned) {
        if (s.vehicle_id !== r.vehicle_id) continue;
        const dep = new Date(s.departure_time);
        if (isNaN(dep.getTime()) || !isSameCalendarDay(dep, reqTime)) continue;
        const gap = Math.abs(dep.getTime() - reqTime.getTime());
        if (gap < bestGap) {
          bestGap = gap;
          best = s;
        }
      }
      if (best) conflict = { departure_time: best.departure_time, destination: best.destination };
    }
    json.conflict = conflict;
    return json;
  });

  res.json(result);
});

// Chef logistique : affecter un autre véhicule à une demande validée sans
// sortie → crée une sortie (ou regroupe dans une sortie compatible du jour).
exports.assignVehicle = asyncHandler(async (req, res) => {
  const { vehicle_id } = req.body;
  const request = await Request.findByPk(req.params.id);
  if (!request) return res.status(404).json({ message: 'Demande introuvable' });
  if (request.status !== 'approved') {
    return res.status(400).json({ message: 'Seules les demandes validées peuvent être réaffectées' });
  }
  if (!vehicle_id) return res.status(400).json({ message: 'Véhicule requis' });

  const vehicle = await Vehicle.findByPk(vehicle_id);
  if (!vehicle) return res.status(404).json({ message: 'Véhicule introuvable' });

  // Même garde que la création de demande : pas de sortie démarrée, pas de
  // panne/maintenance, pas de places complètes pour la date.
  const startedSortie = await Sortie.findOne({
    where: { vehicle_id: vehicle.id, status: { [Op.in]: STARTED_SORTIE_STATUSES } },
    attributes: ['id'],
  });
  if (!vehicleService.isRequestable(vehicle, !!startedSortie)) {
    return res.status(400).json({ message: 'Véhicule indisponible' });
  }

  const requestedDate = new Date(request.date_souhaitee);
  const startOfDay = new Date(requestedDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(requestedDate);
  endOfDay.setHours(23, 59, 59, 999);

  const occupiedRequests = await Request.findAll({
    where: {
      id: { [Op.ne]: request.id },
      vehicle_id: vehicle.id,
      status: ACTIVE_REQUEST_STATUSES,
      date_souhaitee: { [Op.between]: [startOfDay, endOfDay] },
    },
    attributes: ['nb_personnes'],
  });
  const occupiedSeats = occupiedRequests.reduce((sum, r) => sum + (r.nb_personnes || 0), 0);
  if (occupiedSeats + (request.nb_personnes || 0) > vehicle.capacity) {
    return res.status(400).json({ message: 'Pas assez de places dans ce véhicule pour cette date' });
  }

  // Véhicule déjà occupé sans sortie compatible (même destination, synonymes
  // inclus, même jour) : aucune sortie ne pourra être créée/rejointe → on
  // prévient avant d'affecter.
  const sameDayPlanned = await Sortie.findAll({
    where: {
      vehicle_id: vehicle.id,
      status: 'planned',
      departure_time: { [Op.between]: [startOfDay, endOfDay] },
    },
    attributes: ['id', 'destination'],
  });
  const targetDest = normalizeDestination(request.destination);
  const groupable = sameDayPlanned.find((s) => normalizeDestination(s.destination) === targetDest);
  if (vehicle.status !== 'available' && !groupable) {
    return res.status(400).json({ message: 'Ce véhicule est déjà occupé à cette date (autre destination). Choisissez un véhicule disponible.' });
  }

  const oldVehicleId = request.vehicle_id;
  request.vehicle_id = vehicle.id;
  await request.save();

  await logAudit({
    userId: req.user.id, action: 'assign_vehicle', entity: 'Request', entityId: request.id,
    oldValue: { vehicle_id: oldVehicleId }, newValue: { vehicle_id: vehicle.id }, req,
  });

  await autoCreateSortie(request);

  const link = await SortieRequest.findOne({ where: { request_id: request.id } });
  if (link) {
    const sortie = await Sortie.findByPk(link.sortie_id, {
      include: [{ model: Vehicle, attributes: ['id', 'type', 'capacity', 'name'] }],
    });
    const vehicleLabel = vehicle.name || (vehicle.type === 'moto' ? 'une moto' : `le véhicule #${vehicle.id}`);
    await createNotification({
      user_id: request.employee_id,
      message: `Votre demande vers ${request.destination} est affectée à ${vehicleLabel} prévue le ${new Date(request.date_souhaitee).toLocaleString('fr-FR')}`,
      type: 'approved',
    });
    return res.json({ request, sortie });
  }

  return res.json({ request, sortie: null, message: 'Véhicule affecté mais aucune sortie créée (regroupement impossible)' });
});

// Chef logistique : valider / refuser / replanifier
exports.updateStatus = asyncHandler(async (req, res) => {
  const { status, new_date, reschedule_reason } = req.body;
  const request = await Request.findByPk(req.params.id);

  if (!request) {
    return res.status(404).json({ message: 'Demande introuvable' });
  }

  if (!['approved', 'rejected', 'rescheduled'].includes(status)) {
    return res.status(400).json({ message: 'Statut invalide' });
  }

  const allowedTransitions = {
    pending: ['approved', 'rejected', 'rescheduled'],
    rescheduled: ['approved', 'rejected'],
    // Une demande validée SANS sortie (résolue via "À traiter") peut être
    // replanifiée : l'heure souhaitée ne collait pas avec la sortie planifiée.
    approved: ['rescheduled'],
  };
  if (!allowedTransitions[request.status]?.includes(status)) {
    return res.status(400).json({ message: `Impossible de passer de "${request.status}" à "${status}"` });
  }

  // Une demande déjà rattachée à une sortie ne peut PAS être replanifiée :
  // il faudrait d'abord retirer la sortie (chauffeur, capacités, autres
  // demandes regroupées).
  if (status === 'rescheduled' && request.status === 'approved') {
    const existingLink = await SortieRequest.findOne({ where: { request_id: request.id } });
    if (existingLink) {
      return res.status(400).json({ message: 'Cette demande est déjà rattachée à une sortie et ne peut pas être replanifiée' });
    }
  }

  const oldStatus = request.status;
  request.status = status;
  if (status === 'rescheduled' && new_date) {
    request.date_souhaitee = new_date;
    request.reschedule_reason = reschedule_reason || null;
  }
  await request.save();

  await logAudit({ userId: req.user.id, action: `status_${status}`, entity: 'Request', entityId: request.id, oldValue: { status: oldStatus }, newValue: { status, date_souhaitee: request.date_souhaitee, reschedule_reason: request.reschedule_reason }, req });

  if (status === 'approved') {
    await autoCreateSortie(request);
  }

  await createNotification({
    user_id: request.employee_id,
    message: `Votre demande vers ${request.destination} a été ${
      status === 'approved' ? 'validée' :
      status === 'rejected' ? 'refusée' : `replanifiée au ${new Date(request.date_souhaitee).toLocaleString('fr-FR')}`
    }${status === 'rescheduled' && request.reschedule_reason ? ` — Motif: ${request.reschedule_reason}` : ''}`,
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
  if (!ACTIVE_REQUEST_STATUSES.includes(request.status)) {
    return res.status(400).json({ message: 'Cette demande ne peut plus être annulée' });
  }

  const wasApproved = request.status === 'approved';
  const vehicleId = request.vehicle_id;

  await logAudit({ userId: req.user.id, action: 'cancel', entity: 'Request', entityId: request.id, oldValue: { status: request.status }, newValue: { status: 'cancelled' }, req });

  const sortieIds = wasApproved
    ? [...new Set((await SortieRequest.findAll({ where: { request_id: request.id }, attributes: ['sortie_id'] })).map((l) => l.sortie_id))]
    : [];

  await SortieRequest.destroy({ where: { request_id: request.id } });

  request.status = 'cancelled';
  request.vehicle_id = null;
  await request.save();

  // Si l'annulation vide la seule/dernière sortie liée, on la supprime (sortie planifiée)
  // et on libère le véhicule. Sinon on ne libère que si le véhicule n'a plus d'activité.
  if (wasApproved && vehicleId) {
    for (const sortieId of sortieIds) {
      const remaining = await SortieRequest.count({ where: { sortie_id: sortieId } });
      if (remaining === 0) {
        const sortie = await Sortie.findByPk(sortieId);
        if (sortie && sortie.status === 'planned') {
          await sortie.destroy();
          notifyChiefs('sortie_updated', { id: sortie.id, deleted: true });
        }
      }
    }
    await vehicleService.releaseIfIdle(vehicleId);
  }

  await createNotification({
    user_id: request.employee_id,
    message: `Votre demande vers ${request.destination} a été annulée`,
    type: 'cancelled',
  });

  await notifyChiefsDb({
    message: `Demande vers ${request.destination} annulée par un employé`,
    type: 'cancelled',
    excludeUserId: req.user.id,
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

  const oldData = { destination: request.destination, motif: request.motif, date_souhaitee: request.date_souhaitee, nb_personnes: request.nb_personnes, vehicle_id: request.vehicle_id };

  const { destination, motif, date_souhaitee, nb_personnes, vehicle_id } = req.body;
  if (destination !== undefined) request.destination = destination;
  if (motif !== undefined) request.motif = motif;
  if (date_souhaitee !== undefined) request.date_souhaitee = date_souhaitee;
  if (nb_personnes !== undefined) request.nb_personnes = nb_personnes;
  if (vehicle_id !== undefined) request.vehicle_id = vehicle_id;

  await request.save();

  await logAudit({ userId: req.user.id, action: 'update', entity: 'Request', entityId: request.id, oldValue: oldData, newValue: { destination: request.destination, motif: request.motif, date_souhaitee: request.date_souhaitee, nb_personnes: request.nb_personnes, vehicle_id: request.vehicle_id }, req });

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

  const oldStatus = request.status;
  request.status = accepted ? 'approved' : 'rejected';
  await request.save();

  await logAudit({ userId: req.user.id, action: `reschedule_${accepted ? 'accepted' : 'refused'}`, entity: 'Request', entityId: request.id, oldValue: { status: oldStatus }, newValue: { status: request.status }, req });

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

// Supprimer une demande (propriétaire ou chef)
// Si la demande est validée : met à jour la sortie liée (supprimée si elle
// n'emporte plus personne) et libère le véhicule.
exports.remove = asyncHandler(async (req, res) => {
  const request = await Request.findByPk(req.params.id);
  if (!request) return res.status(404).json({ message: 'Demande introuvable' });

  const isOwner = request.employee_id === req.user.id;
  const isChief = CHIEF_ROLES.includes(req.user.role);
  if (!isOwner && !isChief) {
    return res.status(403).json({ message: 'Action non autorisée' });
  }

  if (request.status === 'approved') {
    const links = await SortieRequest.findAll({ where: { request_id: request.id } });
    const sortieIds = [...new Set(links.map((l) => l.sortie_id))];

    for (const sortieId of sortieIds) {
      const remaining = await SortieRequest.count({
        where: { sortie_id: sortieId, request_id: { [Op.ne]: request.id } },
      });
      await SortieRequest.destroy({ where: { sortie_id: sortieId, request_id: request.id } });
      if (remaining === 0) {
        const sortie = await Sortie.findByPk(sortieId);
        if (sortie && ['planned', 'ongoing', 'pending_return'].includes(sortie.status)) {
          const wasVehicleId = sortie.vehicle_id;
          await sortie.destroy();
          await vehicleService.releaseIfIdle(wasVehicleId);
          notifyChiefs('sortie_updated', { id: sortie.id, deleted: true });
        }
      }
    }
  }

  await SortieRequest.destroy({ where: { request_id: request.id } });
  await request.destroy();

  await logAudit({ userId: req.user.id, action: 'delete', entity: 'Request', entityId: request.id, oldValue: { destination: request.destination, status: request.status }, req });

  if (isOwner && !isChief) {
    await notifyChiefsDb({
      message: `Demande vers ${request.destination} supprimée par un employé`,
      type: 'deleted',
      excludeUserId: req.user.id,
    });
  } else if (isChief && !isOwner) {
    await createNotification({
      user_id: request.employee_id,
      message: `Votre demande vers ${request.destination} a été supprimée par la logistique`,
      type: 'deleted',
    });
  }

  res.json({ message: 'Demande supprimée' });
});
