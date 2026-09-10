const XLSX = require('xlsx');
const { Vehicle, Sortie } = require('../models');
const { Op } = require('sequelize');
const asyncHandler = require('../utils/asyncHandler');
const passengerReportService = require('../services/passengerReportService');

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('fr-FR') : '—');
const fmtTime = (d) => (d ? new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—');

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
    attributes: ['id', 'name', 'type', 'capacity', 'status', 'maintenance_until', 'fuel_type', 'current_km'],
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
      v.name || v.type,
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
      { model: Vehicle, attributes: ['type', 'name'] },
      { model: Employee, as: 'driver', attributes: ['nom', 'prenom'] },
    ],
    order: [['departure_time', 'DESC']],
  });

  const rows = sorties.map((s) => [
    new Date(s.departure_time).toLocaleDateString('fr-FR'),
    s.destination,
    s.driver ? `${s.driver.prenom} ${s.driver.nom}` : (s.driver_name || '—'),
    s.Vehicle ? (s.Vehicle.name || s.Vehicle.type || '—') : '—',
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

// GET /api/export/sorties-passengers?date=YYYY-MM-DD&vehicle_id=&vehicle_type=&time_from=&time_to=&format=xlsx|csv
// Rapport des sorties avec liste des passagers (même source de vérité que
// /api/stats/sorties-passengers : sorties effectuées + demandes validées).
exports.sortiesPassengersReport = asyncHandler(async (req, res) => {
  const result = await passengerReportService.findReport(req.query);
  if (result.error) {
    return res.status(result.status || 400).json({ message: result.error });
  }

  const rows = [];
  for (const s of result.data) {
    const passengers = s.passengers;
    const vehicleType = s.vehicle?.type || '—';
    const capacity = s.vehicle?.capacity ?? '—';
    const driver = s.driver_name || '—';
    const departureDate = fmtDate(s.departure_time);
    const departHour = fmtTime(s.departed_at || s.departure_time);
    const returnHour = fmtTime(s.returned_at);
    const statusLabel = SORTIE_STATUS_LABELS[s.status] || s.status;

    if (passengers.length === 0) {
      rows.push([
        departureDate, s.id, vehicleType, capacity, driver,
        s.destination, departHour, returnHour, statusLabel,
        s.departure_km ?? '—', s.arrival_km ?? '—', s.distance_km ?? '—',
        0, capacity, '—', '—', '—',
      ]);
    } else {
      for (const p of passengers) {
        const emp = p.employee;
        rows.push([
          departureDate, s.id, vehicleType, capacity, driver,
          s.destination, departHour, returnHour, statusLabel,
          s.departure_km ?? '—', s.arrival_km ?? '—', s.distance_km ?? '—',
          passengers.length, capacity,
          emp ? `${emp.prenom} ${emp.nom}` : '—',
          emp?.department || '—',
          p.request_id,
        ]);
      }
    }
  }

  buildWorkbook(
    'Sorties & Passagers',
    [
      'Date', 'Sortie #', 'Véhicule', 'Capacité', 'Conducteur',
      'Destination', 'Heure départ', 'Heure retour', 'Statut',
      'Km départ', 'Km arrivée', 'Distance (km)',
      'Nb passagers', 'Capacité max',
      'Passager', 'Département', 'Demande #',
    ],
    rows, res, req, 'rapport_sorties_passagers'
  );
});
