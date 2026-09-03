const { Sortie, Request, Vehicle, SortieRequest, Maintenance } = require('../models');
const { Op, fn, col } = require('sequelize');
const asyncHandler = require('../utils/asyncHandler');
const { MAINTENANCE_HORIZON_MS } = require('../utils/constants');

const MONTH_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

function yearRange(year) {
  return [new Date(year, 0, 1), new Date(year + 1, 0, 1)];
}

function countByStatus(model, where = {}) {
  return model.findAll({
    where,
    attributes: ['status', [fn('COUNT', col('status')), 'count']],
    group: ['status'],
    raw: true,
  });
}

// GET /api/stats/overview?year=2026
exports.overview = asyncHandler(async (req, res) => {
  const year = parseInt(req.query.year, 10) || new Date().getFullYear();
  const [start, end] = yearRange(year);

  const [requestsByStatus, sortiesByStatus, vehiclesByStatus, sortiesOfYear] = await Promise.all([
    countByStatus(Request),
    countByStatus(Sortie),
    countByStatus(Vehicle),
    Sortie.findAll({
      where: { departure_time: { [Op.between]: [start, end] } },
      attributes: ['destination', 'status', 'distance_km', 'departure_time'],
      raw: true,
    }),
  ]);

  const toMap = (rows) => Object.fromEntries(rows.map((r) => [r.status, Number(r.count)]));

  // Km parcourus par mois (sorties terminées uniquement)
  const kmByMonth = MONTH_LABELS.map((month) => ({ month, km: 0 }));
  const destinationCounts = {};
  let totalKm = 0;

  for (const s of sortiesOfYear) {
    const km = Number(s.distance_km || 0);
    if (s.status === 'finished' && km > 0) {
      totalKm += km;
      kmByMonth[new Date(s.departure_time).getMonth()].km += km;
    }
    destinationCounts[s.destination] = (destinationCounts[s.destination] || 0) + 1;
  }

  const topDestinations = Object.entries(destinationCounts)
    .map(([destination, count]) => ({ destination, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  res.json({
    year,
    requests: toMap(requestsByStatus),
    sorties: toMap(sortiesByStatus),
    vehicles: toMap(vehiclesByStatus),
    totalKm,
    kmByMonth,
    topDestinations,
  });
});

// GET /api/stats/mine?year=2026 — statistiques personnelles de l'employé connecté
exports.mine = asyncHandler(async (req, res) => {
  const year = parseInt(req.query.year, 10) || new Date().getFullYear();
  const [start, end] = yearRange(year);

  const myRequests = await Request.findAll({
    where: { employee_id: req.user.id },
    attributes: ['id', 'status'],
    raw: true,
  });

  const requestsByStatus = {};
  for (const r of myRequests) {
    requestsByStatus[r.status] = (requestsByStatus[r.status] || 0) + 1;
  }

  // Sorties liées aux demandes de l'employé
  const links = myRequests.length
    ? await SortieRequest.findAll({ where: { request_id: myRequests.map((r) => r.id) }, attributes: ['sortie_id'], raw: true })
    : [];
  const sortieIds = [...new Set(links.map((l) => l.sortie_id))];

  const sorties = sortieIds.length
    ? await Sortie.findAll({
        where: { id: { [Op.in]: sortieIds } },
        attributes: ['destination', 'status', 'distance_km', 'departure_time'],
        raw: true,
      })
    : [];

  const kmByMonth = MONTH_LABELS.map((month) => ({ month, km: 0 }));
  const destinationCounts = {};
  let totalKm = 0;
  let sortiesOfYear = 0;

  for (const s of sorties) {
    const departure = new Date(s.departure_time);
    if (departure < start || departure >= end) continue;
    sortiesOfYear += 1;

    const km = Number(s.distance_km || 0);
    if (s.status === 'finished' && km > 0) {
      totalKm += km;
      kmByMonth[departure.getMonth()].km += km;
    }
    destinationCounts[s.destination] = (destinationCounts[s.destination] || 0) + 1;
  }

  const topDestinations = Object.entries(destinationCounts)
    .map(([destination, count]) => ({ destination, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  res.json({
    year,
    requests: requestsByStatus,
    totalSorties: sortiesOfYear,
    totalKm,
    kmByMonth,
    topDestinations,
  });
});

// GET /api/stats/kilometrage?year=2026&vehicle_id=2
exports.kilometrage = asyncHandler(async (req, res) => {
  const where = { status: 'finished', distance_km: { [Op.ne]: null } };

  const year = parseInt(req.query.year, 10);
  if (year) {
    const [start, end] = yearRange(year);
    where.departure_time = { [Op.between]: [start, end] };
  }
  if (req.query.vehicle_id) {
    where.vehicle_id = parseInt(req.query.vehicle_id, 10);
  }

  const sorties = await Sortie.findAll({
    where,
    include: [{ model: Vehicle, attributes: ['id', 'type'] }],
    order: [['departure_time', 'DESC']],
    limit: 500,
  });

  res.json(sorties);
});

// GET /api/stats/fleet — santé de la flotte (pour le dashboard chef)
exports.fleet = asyncHandler(async (req, res) => {
  const [vehicles, sortiesFinished, dueList, fuelStats] = await Promise.all([
    Vehicle.findAll({ raw: true }),
    Sortie.findAll({
      where: { status: 'finished', fuel_cost: { [Op.ne]: null } },
      attributes: ['fuel_cost', 'distance_km'],
      raw: true,
    }),
    Maintenance.findAll({
      where: { status: { [Op.ne]: 'done' } },
      attributes: ['id', 'type', 'next_due_km', 'next_due_date', 'status'],
      include: [{ model: Vehicle, as: 'vehicle', attributes: ['id', 'type', 'current_km'] }],
      raw: true,
      nest: true,
    }),
    Sortie.findAll({
      where: { status: 'finished' },
      attributes: [
        [fn('SUM', col('fuel_cost')), 'totalFuelCost'],
        [fn('SUM', col('fuel_litres')), 'totalFuelLitres'],
        [fn('SUM', col('distance_km')), 'totalDistanceKm'],
      ],
      raw: true,
    }),
  ]);

  const byStatus = {};
  for (const v of vehicles) byStatus[v.status] = (byStatus[v.status] || 0) + 1;

  const now = new Date();
  const horizon = new Date(now.getTime() + MAINTENANCE_HORIZON_MS);
  const maintenanceDue = dueList.filter((m) => {
    const kmDue = m.next_due_km != null && m.vehicle?.current_km != null && m.vehicle.current_km >= m.next_due_km;
    const dateDue = m.next_due_date != null && new Date(m.next_due_date) <= horizon;
    return kmDue || dateDue;
  });

  const totalFuelCost = Number(fuelStats[0]?.totalFuelCost || 0);
  const totalFuelLitres = Number(fuelStats[0]?.totalFuelLitres || 0);
  const totalDistanceKm = Number(fuelStats[0]?.totalDistanceKm || 0);

  res.json({
    vehicles: { total: vehicles.length, byStatus },
    maintenanceDue: maintenanceDue.map((m) => ({
      id: m.id, type: m.type, status: m.status,
      next_due_km: m.next_due_km, next_due_date: m.next_due_date,
      vehicle: m.vehicle,
    })),
    fuel: {
      totalCost: totalFuelCost,
      totalLitres: totalFuelLitres,
      costPerKm: totalDistanceKm > 0 ? totalFuelCost / totalDistanceKm : 0,
    },
  });
});
