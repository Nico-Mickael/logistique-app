const { Sortie, Vehicle, Request, SortieRequest, Employee } = require('../models');
const { Op } = require('sequelize');
const asyncHandler = require('../utils/asyncHandler');
const { SORTIE_STATUSES } = require('../utils/constants');
const sortieService = require('../services/sortieService');
const vehicleService = require('../services/vehicleService');
const { createNotification, notifyChiefsDb } = require('./notificationController');
const { notifyChiefs } = require('../services/socketService');

// Notifie (une seule fois chacun) les employés liés à une sortie.
const notifySortieEmployees = async (sortie, message, type) => {
  const links = await SortieRequest.findAll({ where: { sortie_id: sortie.id } });
  const notified = new Set();
  for (const link of links) {
    const request = await Request.findByPk(link.request_id);
    if (request && !notified.has(request.employee_id)) {
      notified.add(request.employee_id);
      await createNotification({ user_id: request.employee_id, message, type });
    }
  }
};

// Créer une sortie + assigner véhicule/conducteur
exports.create = asyncHandler(async (req, res) => {
  const { vehicle_id, driver_name, destination, departure_time, departure_km } = req.body;

  const vehicle = await Vehicle.findByPk(vehicle_id);
  if (!vehicle || vehicle.status !== 'available') {
    return res.status(400).json({ message: 'Véhicule indisponible' });
  }

  const sortie = await Sortie.create({
    vehicle_id, driver_name, destination, departure_time,
    departure_km: departure_km || null,
    status: 'planned',
  });

  vehicle.status = 'busy';
  await vehicle.save();

  notifyChiefs('sortie_created', sortie);
  await notifyChiefsDb({
    message: `Nouvelle sortie planifiée vers ${sortie.destination}`,
    type: 'sortie_created',
    excludeUserId: req.user.id,
  });

  res.status(201).json(sortie);
});

// Dernière sortie d'un véhicule (pour récupérer le return_km)
exports.lastForVehicle = asyncHandler(async (req, res) => {
  const { vehicleId } = req.params;
  const sortie = await Sortie.findOne({
    where: { vehicle_id: vehicleId },
    order: [['createdAt', 'DESC']],
  });
  res.json(sortie);
});

// Voir les demandes compatibles avec une sortie (avant de les ajouter)
exports.suggestions = asyncHandler(async (req, res) => {
  const sortie = await Sortie.findByPk(req.params.id, { include: Vehicle });
  if (!sortie) return res.status(404).json({ message: 'Sortie introuvable' });

  const compatible = await sortieService.findCompatibleRequests(
    sortie.id,
    sortie.destination,
    sortie.Vehicle.capacity,
    sortie.departure_time
  );

  res.json(compatible);
});

// Ajouter une demande à une sortie (regroupement)
exports.addRequest = asyncHandler(async (req, res) => {
  const { request_id } = req.body;
  const sortie = await Sortie.findByPk(req.params.id);
  if (!sortie) return res.status(404).json({ message: 'Sortie introuvable' });

  const exists = await SortieRequest.findOne({
    where: { sortie_id: sortie.id, request_id },
  });
  if (exists) {
    return res.status(400).json({ message: 'Cette demande est déjà liée à cette sortie' });
  }

  await SortieRequest.create({ sortie_id: sortie.id, request_id: request_id, status: 'pending' });

  const request = await Request.findByPk(request_id);
  if (request) {
    if (request.status === 'pending') {
      request.status = 'approved';
    }
    request.vehicle_id = sortie.vehicle_id;
    await request.save();
    await createNotification({
      user_id: request.employee_id,
      message: `Votre demande a été intégrée à une sortie vers ${sortie.destination}`,
      type: 'sortie_assignment',
    });
  }

  res.status(201).json({ message: 'Demande ajoutée à la sortie' });
});

// Changer le statut d'une sortie (planned → ongoing → pending_return → finished)
exports.updateStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!SORTIE_STATUSES.includes(status)) {
    return res.status(400).json({ message: 'Statut invalide' });
  }

  const sortie = await Sortie.findByPk(req.params.id);
  if (!sortie) return res.status(404).json({ message: 'Sortie introuvable' });

  const allowedTransitions = {
    planned: ['ongoing'],
    ongoing: ['pending_return', 'finished'],
    pending_return: ['finished'],
  };
  if (!allowedTransitions[sortie.status]?.includes(status)) {
    return res.status(400).json({ message: `Transition "${sortie.status}" → "${status}" non autorisée` });
  }

  sortie.status = status;
  await sortie.save();

  // Libère le véhicule quand la sortie est terminée
  if (status === 'finished') {
    await vehicleService.setAvailable(sortie.vehicle_id);
  }

  // Informe les employés liés à la sortie de l'évolution de son statut
  if (status === 'ongoing') {
    await notifySortieEmployees(sortie, `Votre sortie vers ${sortie.destination} a démarré`, 'sortie_ongoing');
  } else if (status === 'finished') {
    await notifySortieEmployees(sortie, `La sortie vers ${sortie.destination} est terminée`, 'sortie_finished');
  }

  res.json(sortie);
});

// Employé : voir les sorties liées à ses demandes
exports.mine = asyncHandler(async (req, res) => {
  const userRequests = await Request.findAll({
    where: { employee_id: req.user.id },
    attributes: ['id'],
  });
  const requestIds = userRequests.map((r) => r.id);

  const sortieRequests = await SortieRequest.findAll({
    where: { request_id: requestIds },
  });
  const sortieIds = sortieRequests.map((sr) => sr.sortie_id);

  const sorties = await Sortie.findAll({
    where: { id: sortieIds },
    include: [Vehicle, { model: Request, through: { attributes: ['departure_km', 'return_km', 'distance_km', 'status', 'returned_at'] }, include: [Employee] }],
    order: [['departure_time', 'DESC']],
  });

  res.json(sorties);
});

exports.getAll = asyncHandler(async (req, res) => {
  const {
    page = 1, limit = 50,
    status, vehicle_id, destination,
    date_from, date_to,
  } = req.query;

  const where = {};
  if (status) where.status = status;
  if (vehicle_id) where.vehicle_id = parseInt(vehicle_id, 10);
  if (destination) where.destination = { [Op.iLike]: `%${destination}%` };
  if (date_from) where.departure_time = { ...where.departure_time, [Op.gte]: new Date(date_from) };
  if (date_to) where.departure_time = { ...where.departure_time, [Op.lte]: new Date(date_to) };

  const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const { count, rows } = await Sortie.findAndCountAll({
    where,
    include: [Vehicle, { model: Request, through: { attributes: ['departure_km', 'return_km', 'distance_km', 'status', 'returned_at'] }, include: [Employee] }],
    order: [['departure_time', 'DESC']],
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

// Enregistrer le départ (km départ)
exports.depart = asyncHandler(async (req, res) => {
  const { departure_km } = req.body;
  const sortie = await Sortie.findByPk(req.params.id);
  if (!sortie) return res.status(404).json({ message: 'Sortie introuvable' });
  if (sortie.status !== 'planned') {
    return res.status(400).json({ message: 'Seules les sorties planifiées peuvent démarrer' });
  }

  sortie.departure_km = departure_km;
  sortie.status = 'ongoing';
  await sortie.save();

  // Synchronise les demandes liées : elles passent en cours
  await SortieRequest.update(
    { status: 'ongoing' },
    { where: { sortie_id: sortie.id } }
  );

  notifyChiefs('sortie_updated', sortie);

  res.json(sortie);
});

// Enregistrer l'arrivée (km arrivée) et terminer la sortie
exports.arrivee = asyncHandler(async (req, res) => {
  const { arrival_km } = req.body;
  const sortie = await Sortie.findByPk(req.params.id);
  if (!sortie) return res.status(404).json({ message: 'Sortie introuvable' });
  if (sortie.status !== 'ongoing') {
    return res.status(400).json({ message: 'Seules les sorties en cours peuvent enregistrer l\'arrivée' });
  }
  if (sortie.departure_km === null) {
    return res.status(400).json({ message: 'Le km de départ doit être renseigné' });
  }
  if (!arrival_km || arrival_km < sortie.departure_km) {
    return res.status(400).json({ message: 'Le km d\'arrivée ne peut pas être inférieur au km de départ' });
  }

  sortie.arrival_km = arrival_km;
  sortie.distance_km = arrival_km - sortie.departure_km;
  sortie.status = 'finished';
  await sortie.save();

  // Synchronise les demandes liées : elles sont terminées avec la sortie
  await SortieRequest.update(
    { status: 'finished' },
    { where: { sortie_id: sortie.id } }
  );

  // Libérer le véhicule
  await vehicleService.setAvailable(sortie.vehicle_id);

  await notifySortieEmployees(sortie, `La sortie vers ${sortie.destination} est terminée`, 'sortie_finished');

  notifyChiefs('sortie_updated', sortie);

  res.json(sortie);
});

// Modifier une sortie (uniquement si planifiée)
exports.update = asyncHandler(async (req, res) => {
  const sortie = await Sortie.findByPk(req.params.id);
  if (!sortie) return res.status(404).json({ message: 'Sortie introuvable' });
  if (sortie.status !== 'planned') {
    return res.status(400).json({ message: 'Seules les sorties planifiées peuvent être modifiées' });
  }

  const { destination, driver_name, departure_time, vehicle_id } = req.body;

  if (vehicle_id && vehicle_id !== sortie.vehicle_id) {
    const oldVehicle = await Vehicle.findByPk(sortie.vehicle_id);
    const newVehicle = await Vehicle.findByPk(vehicle_id);
    if (!newVehicle || newVehicle.status !== 'available') {
      return res.status(400).json({ message: 'Nouveau véhicule indisponible' });
    }
    if (oldVehicle) { oldVehicle.status = 'available'; await oldVehicle.save(); }
    newVehicle.status = 'busy'; await newVehicle.save();
    sortie.vehicle_id = vehicle_id;
  }

  if (destination !== undefined) sortie.destination = destination;
  if (driver_name !== undefined) sortie.driver_name = driver_name;
  if (departure_time !== undefined) sortie.departure_time = departure_time;

  await sortie.save();
  notifyChiefs('sortie_updated', sortie);
  res.json(sortie);
});

// Supprimer une sortie
exports.remove = asyncHandler(async (req, res) => {
  const sortie = await Sortie.findByPk(req.params.id);
  if (!sortie) return res.status(404).json({ message: 'Sortie introuvable' });
  if (sortie.status !== 'planned' && sortie.status !== 'finished') {
    return res.status(400).json({ message: 'Seules les sorties planifiées ou terminées peuvent être supprimées' });
  }

  await vehicleService.setAvailable(sortie.vehicle_id);

  await SortieRequest.destroy({ where: { sortie_id: sortie.id } });
  await sortie.destroy();

  notifyChiefs('sortie_updated', { id: sortie.id, deleted: true });
  res.json({ message: 'Sortie supprimée' });
});

// Employé moto : enregistrer ses propres km (départ + retour) à la remise du véhicule
exports.employeeReturn = asyncHandler(async (req, res) => {
  const { departure_km, return_km, returned_at } = req.body;
  const sortie = await Sortie.findByPk(req.params.id);
  if (!sortie) return res.status(404).json({ message: 'Sortie introuvable' });

  if (sortie.status !== 'ongoing') {
    return res.status(400).json({ message: 'Seules les sorties en cours peuvent être retournées' });
  }

  // Vérifier que l'employé fait partie de cette sortie (uniquement pour les motos,
  // chaque utilisateur dispose de sa propre moto et saisit ses propres kilomètres)
  const userRequests = await Request.findAll({
    where: { employee_id: req.user.id },
    attributes: ['id'],
  });
  const requestIds = userRequests.map((r) => r.id);
  const link = await SortieRequest.findOne({
    where: { sortie_id: sortie.id, request_id: requestIds },
  });
  if (!link) {
    return res.status(403).json({ message: 'Vous n\'êtes pas associé à cette sortie' });
  }

  if (!departure_km || departure_km <= 0) {
    return res.status(400).json({ message: 'Saisissez votre kilométrage de départ' });
  }
  if (!return_km || return_km < departure_km) {
    return res.status(400).json({ message: 'Le km de retour ne peut pas être inférieur au km de départ' });
  }

  link.departure_km = departure_km;
  link.return_km = return_km;
  link.distance_km = return_km - departure_km;
  link.status = 'finished';
  link.returned_at = returned_at ? new Date(returned_at) : new Date();
  await link.save();

  await createNotification({
    user_id: req.user.id,
    message: `Retour marqué pour la sortie vers ${sortie.destination} (${link.distance_km} km). En attente de validation.`,
    type: 'return_marked',
  });

  // Si toutes les motos de la sortie sont revenues, la sortie passe en attente de validation
  const pendingLinks = await SortieRequest.findAll({
    where: { sortie_id: sortie.id, status: { [Op.ne]: 'finished' } },
  });
  if (pendingLinks.length === 0 && sortie.status === 'ongoing') {
    sortie.status = 'pending_return';
    await sortie.save();
    await notifyChiefsDb({
      message: `Toutes les motos de la sortie vers ${sortie.destination} sont revenues. En attente de validation.`,
      type: 'return_marked',
      excludeUserId: req.user.id,
    });
  }

  notifyChiefs('sortie_updated', sortie);
  res.json({ link });
});

// Admin : valider le retour et clôturer la sortie
exports.validateReturn = asyncHandler(async (req, res) => {
  const sortie = await Sortie.findByPk(req.params.id);
  if (!sortie) return res.status(404).json({ message: 'Sortie introuvable' });

  if (sortie.status !== 'pending_return') {
    return res.status(400).json({ message: 'Seules les sorties en attente de retour peuvent être validées' });
  }

  await SortieRequest.update(
    { status: 'finished' },
    { where: { sortie_id: sortie.id } }
  );

  sortie.status = 'finished';
  await sortie.save();

  await vehicleService.setAvailable(sortie.vehicle_id);

  // Notifier les employés liés à la sortie
  await notifySortieEmployees(
    sortie,
    `La sortie vers ${sortie.destination} est terminée et validée.`,
    'sortie_finished'
  );

  notifyChiefs('sortie_updated', sortie);
  res.json(sortie);
});
