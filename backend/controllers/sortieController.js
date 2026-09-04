const { Sortie, Vehicle, Request, SortieRequest, Employee } = require('../models');
const { Op } = require('sequelize');
const asyncHandler = require('../utils/asyncHandler');
const { SORTIE_STATUSES } = require('../utils/constants');
const sortieService = require('../services/sortieService');
const vehicleService = require('../services/vehicleService');
const { createNotification, notifyChiefsDb } = require('./notificationController');
const { notifyChiefs } = require('../services/socketService');
const { logAudit } = require('../services/auditService');

// Calcule le statut "affiché" dynamiquement à partir de la date de départ et du statut réel
function computeDisplayStatus(sortie) {
  const now = new Date();
  const departure = new Date(sortie.departure_time);
  const diffMs = departure.getTime() - now.getTime();
  const diffMin = Math.round(diffMs / 60000);

  if (sortie.status === 'finished') return { key: 'finished', label: 'Terminée', color: 'gray' };
  if (sortie.status === 'ongoing') return { key: 'ongoing', label: 'En cours', color: 'brand' };
  if (sortie.status === 'pending_return') return { key: 'pending_return', label: 'Retour à valider', color: 'orange' };

  // planned
  if (diffMin < 0) return { key: 'planned', label: 'Départ dépassé', color: 'red' };
  if (diffMin <= 30) return { key: 'imminent', label: 'Sortie dans quelques minutes', color: 'orange' };
  if (diffMin <= 60) return { key: 'soon', label: `Départ dans ${diffMin} min`, color: 'brandYellow' };
  return { key: 'planned', label: 'Prévue', color: 'gray' };
}

// Notifie tous les employés (sauf le créateur) lors de la création d'une sortie
async function notifyAllEmployees(sortie, vehicle, creatorId) {
  const employees = await Employee.findAll({
    where: { id: { [Op.ne]: creatorId } },
    attributes: ['id'],
  });
  const departureDate = new Date(sortie.departure_time).toLocaleDateString('fr-FR');
  const departureHour = new Date(sortie.departure_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const vehicleLabel = vehicle ? `${vehicle.type} (${vehicle.capacity} places)` : 'N/A';
  const message = `Une sortie est prévue le ${departureDate} à ${departureHour} — ${sortie.destination}. Véhicule: ${vehicleLabel}. Motif: ${sortie.motif || 'Non précisé'}`;

  await Promise.all(
    employees.map((emp) => createNotification({ user_id: emp.id, message, type: 'sortie_created' }))
  );
}

// Met à jour le kilométrage actuel d'un véhicule à partir du km d'arrivée.
async function syncVehicleKm(vehicleId, arrivalKm) {
  if (vehicleId == null || arrivalKm == null) return;
  const vehicle = await Vehicle.findByPk(vehicleId);
  if (vehicle && (vehicle.current_km == null || vehicle.current_km < arrivalKm)) {
    vehicle.current_km = arrivalKm;
    await vehicle.save();
  }
}

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
  const { vehicle_id, driver_name, destination, motif, departure_time, departure_km, driver_employee_id } = req.body;

  if (!motif) {
    return res.status(400).json({ message: 'Le motif de la sortie est obligatoire' });
  }

  const vehicle = await Vehicle.findByPk(vehicle_id);
  if (!vehicle || vehicle.status !== 'available') {
    return res.status(400).json({ message: 'Véhicule indisponible' });
  }

  if (driver_employee_id) {
    const driver = await Employee.findByPk(driver_employee_id);
    if (!driver || driver.role !== 'chauffeur') {
      return res.status(400).json({ message: 'Le chauffeur affecté doit être un compte avec le rôle chauffeur' });
    }
  }

  const sortie = await Sortie.create({
    vehicle_id, driver_name, destination, motif, departure_time,
    driver_employee_id: driver_employee_id || null,
    departure_km: departure_km || null,
    status: 'planned',
  });

  vehicle.status = 'busy';
  await vehicle.save();

  await logAudit({ userId: req.user.id, action: 'create', entity: 'Sortie', entityId: sortie.id, newValue: { vehicle_id, destination, motif, departure_time, driver_name }, req });

  // Notification détaillée à tous les employés
  await notifyAllEmployees(sortie, vehicle, req.user.id);

  notifyChiefs('sortie_created', sortie);
  await notifyChiefsDb({
    message: `Nouvelle sortie planifiée vers ${sortie.destination} — ${sortie.motif}`,
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
      await request.save();
    }
    await createNotification({
      user_id: request.employee_id,
      message: `Votre demande a été intégrée à une sortie vers ${sortie.destination}`,
      type: 'sortie_assignment',
    });
  }

  res.status(201).json({ message: 'Demande ajoutée à la sortie', sortie_id: sortie.id, request_id });
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

  const oldSortieStatus = sortie.status;
  sortie.status = status;
  await sortie.save();

  await logAudit({ userId: req.user.id, action: `status_${status}`, entity: 'Sortie', entityId: sortie.id, oldValue: { status: oldSortieStatus }, newValue: { status }, req });

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

  // Tient les chefs informés en temps réel de l'évolution du statut
  notifyChiefs('sortie_updated', sortie);

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
    include: [Vehicle, { model: Employee, as: 'driver' }, { model: Request, through: { attributes: ['departure_km', 'return_km', 'distance_km', 'status', 'returned_at'] }, include: [Employee] }],
    order: [['departure_time', 'DESC']],
  });

  res.json(sorties.map((s) => ({
    ...s.toJSON(),
    displayStatus: computeDisplayStatus(s),
  })));
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
    include: [Vehicle, { model: Employee, as: 'driver' }, { model: Request, through: { attributes: ['departure_km', 'return_km', 'distance_km', 'status', 'returned_at'] }, include: [Employee] }],
    order: [['departure_time', 'DESC']],
    offset,
    limit: parseInt(limit, 10),
  });

  res.json({
    data: rows.map((s) => ({
      ...s.toJSON(),
      displayStatus: computeDisplayStatus(s),
    })),
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

  await logAudit({ userId: req.user.id, action: 'depart', entity: 'Sortie', entityId: sortie.id, newValue: { departure_km }, req });

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

  await logAudit({ userId: req.user.id, action: 'arrivee', entity: 'Sortie', entityId: sortie.id, newValue: { arrival_km, distance_km: sortie.distance_km }, req });

  // Synchronise les demandes liées : elles sont terminées avec la sortie
  await SortieRequest.update(
    { status: 'finished' },
    { where: { sortie_id: sortie.id } }
  );

  // Libérer le véhicule + mettre à jour son kilométrage actuel
  await vehicleService.setAvailable(sortie.vehicle_id);
  await syncVehicleKm(sortie.vehicle_id, arrival_km);

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

  const { destination, driver_name, departure_time, vehicle_id, driver_employee_id, motif } = req.body;

  if (driver_employee_id !== undefined && driver_employee_id !== null) {
    const driver = await Employee.findByPk(driver_employee_id);
    if (!driver || driver.role !== 'chauffeur') {
      return res.status(400).json({ message: 'Le chauffeur affecté doit être un compte avec le rôle chauffeur' });
    }
    sortie.driver_employee_id = driver.id;
  }

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
  if (motif !== undefined) sortie.motif = motif;

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

  await logAudit({ userId: req.user.id, action: 'delete', entity: 'Sortie', entityId: sortie.id, oldValue: { destination: sortie.destination, status: sortie.status }, req });

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
  res.json(link);
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

  // Pour une sortie "moto", le km le plus élevé renseigné à la remise définit
  // le kilométrage actuel du véhicule.
  const links = await SortieRequest.findAll({
    where: { sortie_id: sortie.id },
    attributes: ['return_km'],
    raw: true,
  });
  const maxReturnKm = links.reduce((max, l) => Math.max(max, l.return_km || 0), 0);
  await syncVehicleKm(sortie.vehicle_id, maxReturnKm > 0 ? maxReturnKm : null);

  await logAudit({ userId: req.user.id, action: 'validate_return', entity: 'Sortie', entityId: sortie.id, req });

  // Notifier les employés liés à la sortie
  await notifySortieEmployees(
    sortie,
    `La sortie vers ${sortie.destination} est terminée et validée.`,
    'sortie_finished'
  );

  notifyChiefs('sortie_updated', sortie);
  res.json(sortie);
});

// Employé : voir les sorties planifiées disponibles pour rejoindre
exports.planned = asyncHandler(async (req, res) => {
  const sorties = await Sortie.findAll({
    where: { status: 'planned' },
    include: [
      { model: Vehicle, attributes: ['id', 'type', 'capacity'] },
      { model: Employee, as: 'driver', attributes: ['nom', 'prenom'] },
      {
        model: Request,
        attributes: ['id', 'nb_personnes'],
        through: { attributes: [] },
      },
    ],
    order: [['departure_time', 'ASC']],
  });

  const result = sorties.map((s) => {
    const occupiedSeats = (s.Requests || []).reduce((sum, r) => sum + (r.nb_personnes || 1), 0);
    const capacity = s.Vehicle?.capacity || 0;
    const displayStatus = computeDisplayStatus(s);

    return {
      id: s.id,
      destination: s.destination,
      motif: s.motif,
      departure_time: s.departure_time,
      driver_name: s.driver ? `${s.driver.prenom} ${s.driver.nom}` : s.driver_name,
      vehicle: s.Vehicle ? { id: s.Vehicle.id, type: s.Vehicle.type, capacity } : null,
      occupiedSeats,
      availableSeats: Math.max(0, capacity - occupiedSeats),
      displayStatus,
      passenger_count: (s.Requests || []).length,
    };
  });

  res.json(result);
});

// Employé : rejoindre une sortie planifiée (crée automatiquement une demande liée)
exports.join = asyncHandler(async (req, res) => {
  const sortie = await Sortie.findByPk(req.params.id, { include: [Vehicle] });
  if (!sortie) return res.status(404).json({ message: 'Sortie introuvable' });
  if (sortie.status !== 'planned') {
    return res.status(400).json({ message: 'Cette sortie n\'est plus disponible' });
  }

  // Vérifier si l'employé a déjà une demande liée à cette sortie
  const existingRequest = await Request.findOne({
    where: { employee_id: req.user.id },
    include: [{
      model: Sortie,
      where: { id: sortie.id },
      through: { attributes: [] },
    }],
  });
  if (existingRequest) {
    return res.status(400).json({ message: 'Vous avez déjà une demande pour cette sortie' });
  }

  // Vérifier la capacité
  const currentLinks = await SortieRequest.findAll({ where: { sortie_id: sortie.id } });
  const currentRequestIds = currentLinks.map((l) => l.request_id);
  const currentRequests = await Request.findAll({ where: { id: currentRequestIds }, attributes: ['nb_personnes'] });
  const occupiedSeats = currentRequests.reduce((sum, r) => sum + (r.nb_personnes || 1), 0);
  const capacity = sortie.Vehicle?.capacity || 0;
  const nbPersonnes = parseInt(req.body.nb_personnes, 10) || 1;

  if (occupiedSeats + nbPersonnes > capacity) {
    return res.status(400).json({ message: `Plus assez de places disponibles (${capacity - occupiedSeats} restante${capacity - occupiedSeats !== 1 ? 's' : ''})` });
  }

  // Créer la demande et la lier à la sortie
  const request = await Request.create({
    employee_id: req.user.id,
    vehicle_id: sortie.vehicle_id,
    destination: sortie.destination,
    motif: sortie.motif,
    date_souhaitee: sortie.departure_time,
    nb_personnes: nbPersonnes,
    status: 'approved',
  });

  await SortieRequest.create({ sortie_id: sortie.id, request_id: request.id, status: 'pending' });

  await createNotification({
    user_id: req.user.id,
    message: `Votre demande pour la sortie vers ${sortie.destination} le ${new Date(sortie.departure_time).toLocaleDateString('fr-FR')} a été approuvée.`,
    type: 'approved',
  });

  notifyChiefs('sortie_updated', sortie);

  res.status(201).json({ message: 'Demande créée et liée à la sortie', request_id: request.id, sortie_id: sortie.id });
});
