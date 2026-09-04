const XLSX = require('xlsx');
const { Vehicle, Sortie, Employee, Request, SortieRequest } = require('../models');
const { Op } = require('sequelize');
const asyncHandler = require('../utils/asyncHandler');

const STATUS_LABELS = {
  available: 'Disponible', busy: 'En cours', maintenance: 'Maintenance', broken: 'En panne', retired: 'Retiré',
};
const SORTIE_STATUS_LABELS = {
  planned: 'Planifiée', ongoing: 'En cours', pending_return: 'Retour à valider', finished: 'Terminée', cancelled: 'Annulée',
};

// Construit un .xlsx (ou .csv) à partir d'un tableau d'en-têtes + de lignes
function buildWorkbook(sheetName, headers, rows, res, req, filename) {
  const format = (req.query.format || 'xlsx').toLowerCase();
  const data = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  if (format === 'csv') {
    const csv = XLSX.utils.sheet_to_csv(ws);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
    return res.send('\uFEFF' + csv); // BOM pour Excel
  }

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
  res.send(buf);
}

// GET /api/export/fleet?format=xlsx|csv
// Rapport par véhicule : km, carburant, maintenance, statut, coût/km
exports.fleetReport = asyncHandler(async (req, res) => {
  const vehicles = await Vehicle.findAll({
    attributes: ['id', 'type', 'capacity', 'status', 'maintenance_until', 'fuel_type', 'current_km'],
    order: [['type', 'ASC']],
  });
  const ids = vehicles.map((v) => v.id);
  const sortiesAll = await Sortie.findAll({ where: { vehicle_id: { [Op.in]: ids }, status: 'finished' }, attributes: ['vehicle_id', 'distance_km', 'fuel_cost', 'fuel_litres'], raw: true });

  const rows = vehicles.map((v) => {
    const sorties = sortiesAll.filter((s) => s.vehicle_id === v.id);
    const km = sorties.reduce((sum, s) => sum + (Number(s.distance_km) || 0), 0);
    const fuelCost = sorties.reduce((sum, s) => sum + (Number(s.fuel_cost) || 0), 0);
    const litres = sorties.reduce((sum, s) => sum + (Number(s.fuel_litres) || 0), 0);
    return [
      v.type,
      STATUS_LABELS[v.status] || v.status,
      v.capacity,
      v.fuel_type || '—',
      v.current_km ?? 0,
      km,
      litres.toFixed(2),
      fuelCost.toFixed(2),
      km > 0 ? (fuelCost / km).toFixed(2) : '0.00',
      v.maintenance_until ? new Date(v.maintenance_until).toLocaleDateString('fr-FR') : '—',
    ];
  });

  buildWorkbook(
    'Rapport flotte',
    ['Véhicule', 'Statut', 'Capacité', 'Carburant', 'Km actuel', 'Km parcourus', 'Litres essence', 'Coût carburant (Ar)', 'Coût/km (Ar)', 'Maintenance jusqu\'au'],
    rows, res, req, 'rapport_flotte'
  );
});

// GET /api/export/sorties?status=&date_from=&date_to=&format=xlsx|csv
// Liste détaillée des sorties (avec carburant et conducteur)
exports.sortiesReport = asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.status) where.status = req.query.status;
  if (req.query.date_from) where.departure_time = { ...where.departure_time, [Op.gte]: new Date(req.query.date_from) };
  if (req.query.date_to) where.departure_time = { ...where.departure_time, [Op.lte]: new Date(req.query.date_to) };

  const sorties = await Sortie.findAll({
    where,
    include: [
      { model: Vehicle, attributes: ['type'] },
      { model: Employee, as: 'driver', attributes: ['nom', 'prenom'] },
    ],
    order: [['departure_time', 'DESC']],
  });

  const rows = sorties.map((s) => [
    new Date(s.departure_time).toLocaleDateString('fr-FR'),
    s.destination,
    s.driver ? `${s.driver.prenom} ${s.driver.nom}` : (s.driver_name || '—'),
    s.Vehicle?.type || '—',
    SORTIE_STATUS_LABELS[s.status] || s.status,
    s.departure_km ?? '—',
    s.arrival_km ?? '—',
    s.distance_km ?? '—',
    s.fuel_litres ?? '—',
    s.fuel_cost ?? '—',
  ]);

  buildWorkbook(
    'Rapport sorties',
    ['Date', 'Destination', 'Conducteur', 'Véhicule', 'Statut', 'Km départ', 'Km arrivée', 'Distance (km)', 'Litres essence', 'Coût carburant (Ar)'],
    rows, res, req, 'rapport_sorties'
  );
});

// GET /api/export/sorties-passengers?date=2026-09-04&vehicle_id=1&format=xlsx|csv
// Rapport des sorties avec liste des passagers
exports.sortiesPassengersReport = asyncHandler(async (req, res) => {
  const { date, vehicle_id } = req.query;

  if (!date) {
    return res.status(400).json({ message: 'Le paramètre date est requis (format YYYY-MM-DD)' });
  }

  const startDate = new Date(date);
  const endDate = new Date(date);
  endDate.setDate(endDate.getDate() + 1);

  const where = {
    departure_time: { [Op.gte]: startDate, [Op.lt]: endDate },
  };
  if (vehicle_id) {
    where.vehicle_id = parseInt(vehicle_id, 10);
  }

  const sorties = await Sortie.findAll({
    where,
    include: [
      { model: Vehicle, attributes: ['type', 'capacity'] },
      { model: Employee, as: 'driver', attributes: ['nom', 'prenom'] },
      {
        model: Request,
        include: [{ model: Employee, attributes: ['nom', 'prenom', 'department'] }],
        attributes: ['id', 'destination', 'motif'],
        through: { attributes: [] },
      },
    ],
    order: [['departure_time', 'ASC']],
  });

  const rows = [];
  for (const s of sorties) {
    const passengers = s.Requests || [];
    const vehicleType = s.Vehicle?.type || '—';
    const capacity = s.Vehicle?.capacity ?? '—';
    const driver = s.driver ? `${s.driver.prenom} ${s.driver.nom}` : (s.driver_name || '—');
    const departureDate = new Date(s.departure_time).toLocaleDateString('fr-FR');
    const departureHour = s.departed_at ? new Date(s.departed_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—';
    const returnHour = s.returned_at ? new Date(s.returned_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—';

    if (passengers.length === 0) {
      rows.push([
        departureDate, s.id, vehicleType, capacity, driver,
        s.destination, departureHour, returnHour,
        s.departure_km ?? '—', s.arrival_km ?? '—', s.distance_km ?? '—',
        0, capacity, '—', '—', '—',
      ]);
    } else {
      for (const p of passengers) {
        const emp = p.Employee;
        rows.push([
          departureDate, s.id, vehicleType, capacity, driver,
          s.destination, departureHour, returnHour,
          s.departure_km ?? '—', s.arrival_km ?? '—', s.distance_km ?? '—',
          passengers.length, capacity,
          emp ? `${emp.prenom} ${emp.nom}` : '—',
          emp?.department || '—',
          p.id,
        ]);
      }
    }
  }

  buildWorkbook(
    'Sorties & Passagers',
    [
      'Date', 'Sortie #', 'Véhicule', 'Capacité', 'Conducteur',
      'Destination', 'Heure départ', 'Heure retour',
      'Km départ', 'Km arrivée', 'Distance (km)',
      'Nb passagers', 'Capacité max',
      'Passager', 'Département', 'Demande #',
    ],
    rows, res, req, 'rapport_sorties_passagers'
  );
});
