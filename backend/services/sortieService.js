const { Op } = require('sequelize');
const { ASSIGNABLE_TO_SORTIE_STATUSES } = require('../utils/constants');

// Critère de regroupement du cahier des charges : écart horaire ≤ 30 min
const COMPAT_WINDOW_MS = 30 * 60 * 1000;

// Dépendances injectables (modèles + socket) par défaut. Permet de tester
// le service en isolation en injectant des mocks (voir test/sortieService.test.js).
function defaultDeps() {
  return {
    models: require('../models'),
    notifyChiefs: require('./socketService').notifyChiefs,
    releaseIfIdle: require('./vehicleService').releaseIfIdle,
  };
}

// Erreur métier transportant un code HTTP (exploitée par le middleware d'erreurs)
function apiError(status, message) {
  return Object.assign(new Error(message), { status });
}

let _deps = null;
function getDeps() {
  if (!_deps) _deps = defaultDeps();
  return _deps;
}

// Réservé aux tests : remplace les dépendances du service.
function __setDeps(deps) {
  _deps = deps;
}

function __resetDeps() {
  _deps = null;
}

// Trouve les demandes compatibles avec une sortie (même destination,
// écart horaire ≤ 30 min, capacité respectée)
exports.findCompatibleRequests = async (sortieId, destination, vehicleCapacity, departureTime) => {
  const { models } = getDeps();
  const { Request, SortieRequest, Employee } = models;

  const linkedRequestIds = (await SortieRequest.findAll({ attributes: ['request_id'] })).map((sr) => sr.request_id);

  const departure = departureTime ? new Date(departureTime) : null;

  const candidates = await Request.findAll({
    where: {
      destination: { [Op.iLike]: destination },
      status: { [Op.in]: ASSIGNABLE_TO_SORTIE_STATUSES },
      id: { [Op.notIn]: linkedRequestIds },
      ...(departure && !isNaN(departure.getTime())
        ? {
            date_souhaitee: {
              [Op.between]: [
                new Date(departure.getTime() - COMPAT_WINDOW_MS),
                new Date(departure.getTime() + COMPAT_WINDOW_MS),
              ],
            },
          }
        : {}),
    },
    include: [Employee],
    order: [['date_souhaitee', 'ASC']],
  });

  // Places déjà occupées par les demandes déjà liées à cette sortie
  const existing = await SortieRequest.findAll({ where: { sortie_id: sortieId } });
  const existingIds = existing.map((sr) => sr.request_id);
  const existingRequests = await Request.findAll({ where: { id: { [Op.in]: existingIds } } });
  let occupied = existingRequests.reduce((sum, r) => sum + (r.nb_personnes || 0), 0);

  // Filtre selon la capacité restante du véhicule
  const compatible = [];
  for (const req of candidates) {
    if (occupied + (req.nb_personnes || 0) <= vehicleCapacity) {
      compatible.push(req);
      occupied += req.nb_personnes || 0;
    }
  }
  return compatible;
};

/**
 * Attache une demande à une sortie (regroupement compatible).
 *
 * Garantit qu'une demande regroupée ne peut JAMAIS être perdue :
 * - elle conserve son propre id, son employé, son motif et son statut
 * - elle ne peut être liée qu'à UNE seule sortie "vivante" (planned/ongoing) ;
 *   si elle était déjà sur une autre sortie planifiée, elle y est DÉPLACÉE
 *   (l'ancienne sortie vidée est supprimée, son véhicule libéré si inactif)
 * - une demande déjà partie (sortie en cours/terminée) ne peut pas être déplacée
 * - la compatibilité est revalidée : statut, destination, fenêtre ±30 min, capacité
 *
 * @returns {Promise<{request, sortie, status: 'added'|'already_linked'}>}
 * @throws {Error} avec `.status` (400/404) si la liaison est impossible
 */
exports.attachRequestToSortie = async ({ sortieId, requestId }) => {
  const { models, releaseIfIdle, notifyChiefs } = getDeps();
  const { Sortie, Request, SortieRequest, Vehicle } = models;

  const sortie = await Sortie.findByPk(sortieId);
  if (!sortie) throw apiError(404, 'Sortie introuvable');

  const request = await Request.findByPk(requestId);
  if (!request) throw apiError(404, 'Demande introuvable');
  if (!ASSIGNABLE_TO_SORTIE_STATUSES.includes(request.status)) {
    throw apiError(400, `Cette demande (statut "${request.status}") ne peut pas être intégrée à une sortie`);
  }

  // Compatibilité : même destination (insensible à la casse)
  if (sortie.destination && request.destination &&
      String(sortie.destination).toLowerCase() !== String(request.destination).toLowerCase()) {
    throw apiError(400, 'La destination de la demande ne correspond pas à celle de la sortie');
  }

  // Compatibilité : fenêtre horaire ±30 min
  const reqTime = new Date(request.date_souhaitee);
  const depTime = new Date(sortie.departure_time);
  if (!isNaN(reqTime.getTime()) && !isNaN(depTime.getTime()) &&
      Math.abs(reqTime.getTime() - depTime.getTime()) > COMPAT_WINDOW_MS) {
    throw apiError(400, 'La demande ne se situe pas à proximité de la sortie (écart supérieur à 30 minutes)');
  }

  // Déjà liée à CETTE sortie → pas de doublon
  const existingLink = await SortieRequest.findOne({ where: { sortie_id: sortie.id, request_id: request.id } });
  if (existingLink) return { request, sortie, status: 'already_linked' };

  // Capacité restante du véhicule de la sortie
  const vehicle = await Vehicle.findByPk(sortie.vehicle_id);
  const capacity = vehicle ? vehicle.capacity : null;
  const links = await SortieRequest.findAll({ where: { sortie_id: sortie.id } });
  const linkedIds = links.map((l) => l.request_id);
  const linked = linkedIds.length > 0
    ? await Request.findAll({ where: { id: { [Op.in]: linkedIds } } })
    : [];
  const occupied = linked.reduce((sum, r) => sum + (r.nb_personnes || 0), 0);
  if (capacity !== null && capacity !== undefined && occupied + (request.nb_personnes || 0) > capacity) {
    throw apiError(400, `Capacité insuffisante : il reste ${Math.max(0, capacity - occupied)} place(s) pour ${request.nb_personnes || 0} personne(s)`);
  }

  // Déjà liée à une AUTRE sortie → on garantit l'unicité du groupe
  const otherLink = await SortieRequest.findOne({ where: { request_id: request.id, sortie_id: { [Op.ne]: sortie.id } } });
  if (otherLink) {
    const otherSortie = await Sortie.findByPk(otherLink.sortie_id);
    if (otherSortie && ['ongoing', 'pending_return', 'finished'].includes(otherSortie.status)) {
      throw apiError(400, 'Cette demande est déjà liée à une sortie en cours ou terminée et ne peut pas être déplacée');
    }
    await SortieRequest.destroy({ where: { id: otherLink.id } });
    if (otherSortie) {
      const remaining = await SortieRequest.count({ where: { sortie_id: otherSortie.id } });
      if (remaining === 0 && otherSortie.status === 'planned') {
        const wasVehicleId = otherSortie.vehicle_id;
        await otherSortie.destroy();
        notifyChiefs('sortie_updated', { id: otherSortie.id, deleted: true });
        if (wasVehicleId) await releaseIfIdle(wasVehicleId);
      }
    }
  }

  await SortieRequest.create({ sortie_id: sortie.id, request_id: request.id, status: 'pending' });
  if (request.status === 'pending') {
    request.status = 'approved';
    await request.save();
  }

  return { request, sortie, status: 'added' };
};

/**
 * Crée automatiquement une sortie quand une demande est approuvée avec véhicule :
 * - réutilise une sortie existante au même créneau (écart ≤ 30 min) sur le même
 *   véhicule, même destination, si la capacité le permet (regroupement)
 * - sinon crée la sortie, lie la demande et occupe le véhicule
 */
exports.autoCreateSortie = async (request) => {
  const { models, notifyChiefs } = getDeps();
  const { Sortie, SortieRequest, Employee, Vehicle } = models;

  if (!request.vehicle_id) return;

  const emp = await Employee.findByPk(request.employee_id);
  const vehicle = await Vehicle.findByPk(request.vehicle_id);
  const isMoto = vehicle ? vehicle.type === 'moto' : false;

  const requestTime = new Date(request.date_souhaitee);
  const existingSortie = !isNaN(requestTime.getTime()) ? await Sortie.findOne({
    where: {
      vehicle_id: request.vehicle_id,
      status: 'planned',
      destination: request.destination,
      departure_time: {
        [Op.between]: [
          new Date(requestTime.getTime() - COMPAT_WINDOW_MS),
          new Date(requestTime.getTime() + COMPAT_WINDOW_MS),
        ],
      },
    },
  }) : null;

  if (existingSortie) {
    // Regroupement : la demande rejoint la sortie compatible existante sans être
    // perdue (même id, employé, motif, statut) ; unicité garantie côté service.
    try {
      await exports.attachRequestToSortie({ sortieId: existingSortie.id, requestId: request.id });
    } catch (err) {
      // Capacité insuffisante ou sortie non regroupable : on ne force pas,
      // la demande reste approuvée et le chef logistique la traite manuellement.
      return;
    }
    return;
  }

  // Si le véhicule demandé n'est plus disponible (occupé, en panne, maintenance)
  // et qu'aucune sortie compatible n'existe pour y regrouper la demande, on ne
  // crée pas de sortie : la demande reste approuvée et le chef logistique
  // l'affectera/regroupera manuellement sur un autre véhicule.
  if (vehicle && vehicle.status !== 'available') {
    return;
  }

  // Pour une moto, l'employé conduit lui-même : on renseigne son nom comme
  // conducteur. Pour une voiture, le chauffeur (un compte avec le rôle
  // chauffeur) est affecté par le chef logistique après la création.
  const sortie = await Sortie.create({
    vehicle_id: request.vehicle_id,
    driver_name: isMoto ? (emp ? `${emp.prenom} ${emp.nom}` : 'Chauffeur') : null,
    destination: request.destination,
    motif: request.motif || null,
    departure_time: request.date_souhaitee,
    status: 'planned',
  });
  await SortieRequest.create({ sortie_id: sortie.id, request_id: request.id, status: 'pending' });

  if (vehicle && vehicle.status === 'available') {
    vehicle.status = 'busy';
    await vehicle.save();
  }

  notifyChiefs('sortie_created', sortie);
};

// Helpers de test (non utilisés en production)
module.exports.__setDeps = __setDeps;
module.exports.__resetDeps = __resetDeps;
module.exports.COMPAT_WINDOW_MS = COMPAT_WINDOW_MS;
