// Rapport "qui était à bord ?" (Partie 2)
// Source unique des données : sorties RÉELLEMENT effectuées et demandes
// RÉELLEMENT validées — jamais les sorties planifiées ni les demandes rejetées.
//
// Le même service sert au contrôleur statsController (JSON) et au
// contrôleur exportController (xlsx/csv) : une seule requête, un seul mapping.

const { Op } = require('sequelize');

// Dépendances injectables (modèles) par défaut.
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

// Traite une heure "HH:mm" → "HH:mm" normalisé (heure de sortie dans la journée).
function parseTime(value, label) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(value).trim());
  if (!m) {
    const e = new Error(`${label} au format HH:mm requis`);
    e.status = 400;
    throw e;
  }
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  if (hours > 23 || minutes > 59) {
    const e = new Error(`${label} invalide (HH:mm, heure ≤ 23:59)`);
    e.status = 400;
    throw e;
  }
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Construit le `where` du rapport à partir des filtres de l'API.
 * Exportée pour être testée unitairement (pure, sans accès models).
 * Retourne { error?, where?, vehicleWhere? }.
 */
exports.buildFilters = (query) => {
  const { date, vehicle_id, vehicle_type, time_from, time_to } = query || {};

  if (!date) return { error: 'Le paramètre date est requis (format YYYY-MM-DD)' };

  const day = String(date);
  const where = {
    // Seules les sorties réellement effectuées : on exclut les planifiées.
    status: { [Op.ne]: 'planned' },
    departure_time: {
      [Op.gte]: new Date(`${day}T00:00:00`),
      [Op.lt]: new Date(`${day}T23:59:59.999`),
    },
  };

  if (vehicle_id) {
    const id = parseInt(vehicle_id, 10);
    if (Number.isNaN(id)) return { error: 'vehicle_id doit être un entier' };
    where.vehicle_id = id;
  }

  try {
    if (time_from) {
      where.departure_time[Op.gte] = new Date(`${day}T${parseTime(time_from, 'Heure de début')}:00`);
    }
    if (time_to) {
      where.departure_time[Op.lt] = new Date(`${day}T${parseTime(time_to, 'Heure de fin')}:00`);
    }
  } catch (err) {
    return { error: err.message, status: err.status || 400 };
  }

  let vehicleWhere;
  if (vehicle_type) {
    vehicleWhere = { type: String(vehicle_type).trim() };
  }

  return { where, vehicleWhere };
};

// Mappe une sortie Sequelize vers le DTO du rapport (consommé par stats + export).
function toReportRow(sortie) {
  const passengers = (sortie.Requests || [])
    // Demandes réellement validées uniquement (jamais de demande rejetée/annulée)
    .filter((r) => r.status === 'approved')
    .map((r) => ({
      request_id: r.id,
      employee: r.Employee
        ? { id: r.Employee.id, nom: r.Employee.nom, prenom: r.Employee.prenom, department: r.Employee.department }
        : null,
      destination: r.destination,
      motif: r.motif,
      nb_personnes: r.nb_personnes,
    }));

  return {
    id: sortie.id,
    destination: sortie.destination,
    motif: sortie.motif,
    status: sortie.status,
    departure_time: sortie.departure_time,
    departed_at: sortie.departed_at,
    returned_at: sortie.returned_at,
    departure_km: sortie.departure_km,
    arrival_km: sortie.arrival_km,
    distance_km: sortie.distance_km,
    driver_name: sortie.driver ? `${sortie.driver.prenom} ${sortie.driver.nom}` : sortie.driver_name,
    driver_department: sortie.driver ? sortie.driver.department : null,
    vehicle: sortie.Vehicle
      ? { id: sortie.Vehicle.id, name: sortie.Vehicle.name, type: sortie.Vehicle.type, capacity: sortie.Vehicle.capacity }
      : null,
    passengers,
    passenger_count: passengers.length,
  };
}

/**
 * Requête unique du rapport : sorties effectuées + passagers validés.
 * @returns {Promise<{error?, status?, data?}>}
 */
exports.findReport = async (query) => {
  const { models } = getDeps();
  const { Sortie, Vehicle, Employee, Request } = models;

  const { error, status, where, vehicleWhere } = exports.buildFilters(query);
  if (error) return { error, status: status || 400 };

  const vehicleInclude = { model: Vehicle, attributes: ['id', 'type', 'capacity', 'name'] };
  if (vehicleWhere) {
    // Filtre par type de véhicule directement dans le JOIN (une seule requête SQL)
    vehicleInclude.where = vehicleWhere;
  }

  const sorties = await Sortie.findAll({
    where,
    include: [
      vehicleInclude,
      { model: Employee, as: 'driver', attributes: ['id', 'nom', 'prenom', 'department'] },
      {
        model: Request,
        attributes: ['id', 'employee_id', 'status', 'destination', 'motif', 'nb_personnes'],
        include: [{ model: Employee, attributes: ['id', 'nom', 'prenom', 'department'] }],
        through: { attributes: [] },
      },
    ],
    order: [['departure_time', 'ASC']],
    subQuery: false,
  });

  return { data: sorties.map(toReportRow) };
};

module.exports.buildFilters = exports.buildFilters;
module.exports.findReport = exports.findReport;
module.exports.__setDeps = __setDeps;
module.exports.__resetDeps = __resetDeps;