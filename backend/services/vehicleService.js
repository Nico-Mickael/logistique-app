const { Op } = require('sequelize');
const { ACTIVE_REQUEST_STATUSES, UNUSABLE_VEHICLE_STATUSES } = require('../utils/constants');

// Dépendances injectables (modèles) par défaut. Permet de tester le service
// en isolation en injectant des mocks (voir test/vehicleService.test.js).
function defaultDeps() {
  return { models: require('../models') };
}

let _deps = null;
function getDeps() {
  if (!_deps) _deps = defaultDeps();
  return _deps;
}

function __setDeps(deps) {
  _deps = deps;
}

function __resetDeps() {
  _deps = null;
}

/**
 * Passe un véhicule au statut "available" (s'il existe et n'y est pas déjà).
 */
exports.setAvailable = async (vehicleId) => {
  if (!vehicleId) return;
  const { Vehicle } = getDeps().models;
  const vehicle = await Vehicle.findByPk(vehicleId);
  if (vehicle && vehicle.status !== 'available') {
    vehicle.status = 'available';
    await vehicle.save();
  }
};

/**
 * Met à jour le kilométrage actuel d'un véhicule à partir d'un km d'arrivée.
 * Ne régresse jamais : n'écrase une valeur que si elle est supérieure.
 */
exports.syncKm = async (vehicleId, arrivalKm) => {
  if (vehicleId == null || arrivalKm == null) return;
  const { Vehicle } = getDeps().models;
  const vehicle = await Vehicle.findByPk(vehicleId);
  if (vehicle && (vehicle.current_km == null || vehicle.current_km < arrivalKm)) {
    vehicle.current_km = arrivalKm;
    await vehicle.save();
  }
};

const ACTIVE_STATUSES_SET = ACTIVE_REQUEST_STATUSES;

/**
 * Un véhicule peut-il encore recevoir une nouvelle demande ?
 *
 * Tant que ses sorties n'ont pas démarré (statut "planned") et qu'il lui reste
 * au moins une place libre, le véhicule reste affiché aux employés et
 * demandable : les demandes pourront être rattachées à la sortie planifiée.
 * Il cesse d'être demandable dès qu'une sortie est réellement démarrée
 * (ongoing / pending_return), que le véhicule est en maintenance / panne,
 * OÙ si ses places sont toutes occupées.
 *
 * @param {object|null} vehicle
 * @param {boolean} hasStartedSortie - une sortie du véhicule a-t-elle démarré ?
 * @param {boolean} isFull - toutes les places du véhicule sont-elles occupées ?
 * @returns {boolean}
 */
exports.isRequestable = (vehicle, hasStartedSortie = false, isFull = false) => {
  if (!vehicle) return false;
  if (UNUSABLE_VEHICLE_STATUSES.includes(vehicle.status)) return false;
  if (hasStartedSortie) return false;
  return !isFull;
};

/**
 * Libère un véhicule uniquement s'il n'a plus aucune sortie active
 * ni aucune demande active (non terminée) rattachée.
 *
 * Une demande "approved" dont la sortie liée est terminée ne bloque plus
 * le véhicule : elle appartient à l'historique et ne retient plus les places.
 */
exports.releaseIfIdle = async (vehicleId) => {
  if (!vehicleId) return;
  const { Vehicle, Request, Sortie } = getDeps().models;

  const activeSortieCount = await Sortie.count({
    where: { vehicle_id: vehicleId, status: { [Op.notIn]: ['finished'] } },
  });
  if (activeSortieCount > 0) return;

  const activeRequests = await Request.findAll({
    where: { vehicle_id: vehicleId, status: ACTIVE_STATUSES_SET },
    include: [
      { model: Sortie, attributes: ['id', 'status'], through: { attributes: [] } },
    ],
  });

  const retainsVehicle = activeRequests.some((r) => {
    // Sans sortie liée : la demande planifie encore le véhicule → il reste occupé.
    if (!r.Sorties || r.Sorties.length === 0) return true;
    // Avec au moins une sortie non terminée : la demande est encore active.
    if (r.Sorties.some((s) => s.status !== 'finished')) return true;
    // Sinon la demande est rattachée uniquement à des sorties terminées → elle libère.
    return false;
  });
  if (retainsVehicle) return;

  await exports.setAvailable(vehicleId);
};

module.exports.__setDeps = __setDeps;
module.exports.__resetDeps = __resetDeps;
