const { Sortie, Request, Vehicle } = require('../models');
const { Op, fn, col } = require('sequelize');
const asyncHandler = require('../utils/asyncHandler');

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
