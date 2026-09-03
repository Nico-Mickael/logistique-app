const { Maintenance, Vehicle, Sortie, Notification } = require('../models');
const { Op } = require('sequelize');
const asyncHandler = require('../utils/asyncHandler');
const { notifyChiefsDb } = require('./notificationController');
const { logAudit } = require('../services/auditService');
const { MAINTENANCE_STATUSES, MAINTENANCE_HORIZON_MS } = require('../utils/constants');

// ---------------------------------------------------------------------------
// Maintenance : historisation + plan préventif
// ---------------------------------------------------------------------------

// GET /api/maintenances?vehicle_id=&status=
exports.list = asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.vehicle_id) where.vehicle_id = parseInt(req.query.vehicle_id, 10);
  if (req.query.status) where.status = req.query.status;

  const items = await Maintenance.findAll({
    where,
    include: [{ model: Vehicle, as: 'vehicle', attributes: ['id', 'type', 'current_km', 'status'] }],
    order: [['date', 'DESC']],
    limit: parseInt(req.query.limit, 10) || 200,
  });
  res.json(items);
});

// POST /api/maintenances
exports.create = asyncHandler(async (req, res) => {
  const { vehicle_id, type, description, cost, date, next_due_km, next_due_date, status } = req.body;
  if (!vehicle_id || !type || !date) {
    return res.status(400).json({ message: 'Champs obligatoires : vehicle_id, type, date' });
  }
  const vehicle = await Vehicle.findByPk(vehicle_id);
  if (!vehicle) return res.status(404).json({ message: 'Véhicule introuvable' });

  if (status && !MAINTENANCE_STATUSES.includes(status)) {
    return res.status(400).json({ message: 'Statut de maintenance invalide' });
  }

  const maintenance = await Maintenance.create({
    vehicle_id, type, description, cost, date,
    next_due_km, next_due_date,
    status: status || 'done',
  });

  await logAudit({ userId: req.user.id, action: 'create', entity: 'Maintenance', entityId: maintenance.id, newValue: { vehicle_id, type, date }, req });

  res.status(201).json(maintenance);
});

// PATCH /api/maintenances/:id
exports.update = asyncHandler(async (req, res) => {
  const maintenance = await Maintenance.findByPk(req.params.id);
  if (!maintenance) return res.status(404).json({ message: 'Maintenance introuvable' });

  const { type, description, cost, date, next_due_km, next_due_date, status } = req.body;
  const oldValue = maintenance.toJSON();
  if (type !== undefined) maintenance.type = type;
  if (description !== undefined) maintenance.description = description;
  if (cost !== undefined) maintenance.cost = cost;
  if (date !== undefined) maintenance.date = date;
  if (next_due_km !== undefined) maintenance.next_due_km = next_due_km;
  if (next_due_date !== undefined) maintenance.next_due_date = next_due_date;
  if (status !== undefined) maintenance.status = status;
  await maintenance.save();

  await logAudit({ userId: req.user.id, action: 'update', entity: 'Maintenance', entityId: maintenance.id, oldValue, newValue: maintenance.toJSON(), req });

  res.json(maintenance);
});

// DELETE /api/maintenances/:id
exports.remove = asyncHandler(async (req, res) => {
  const maintenance = await Maintenance.findByPk(req.params.id);
  if (!maintenance) return res.status(404).json({ message: 'Maintenance introuvable' });
  await maintenance.destroy();
  await logAudit({ userId: req.user.id, action: 'delete', entity: 'Maintenance', entityId: maintenance.id, req });
  res.json({ message: 'Maintenance supprimée' });
});

// GET /api/maintenances/due — maintenances préventives dont l'échéance (km ou
// date) est atteinte ou proche, pour alimenter le tableau de bord / les alertes
exports.due = asyncHandler(async (req, res) => {
  const now = new Date();
  const horizonDays = parseInt(req.query.horizon_days, 10) || 7;
  const horizonDate = new Date(now.getTime() + horizonDays * 24 * 60 * 60 * 1000);

  const upcoming = await Maintenance.findAll({
    where: {
      status: { [Op.ne]: 'done' },
      [Op.or]: [
        { next_due_date: { [Op.lte]: horizonDate } },
        { next_due_km: { [Op.not]: null } },
      ],
    },
    include: [{ model: Vehicle, as: 'vehicle', attributes: ['id', 'type', 'current_km', 'status'] }],
    order: [['next_due_date', 'ASC']],
  });

  // Filtrage applicatif : échéance date atteinte OU km courant >= échéance km
  const due = upcoming.filter((m) => {
    const kmDue = m.next_due_km != null && m.vehicle?.current_km != null && m.vehicle.current_km >= m.next_due_km;
    const dateDue = m.next_due_date != null && new Date(m.next_due_date) <= horizonDate;
    return kmDue || dateDue;
  });

  res.json(due);
});

// ---------------------------------------------------------------------------
// Carburant : enregistré à l'arrivée d'une sortie
// ---------------------------------------------------------------------------
// PATCH /api/maintenances/sorties/:id/fuel
exports.recordFuel = asyncHandler(async (req, res) => {
  const sortie = await Sortie.findByPk(req.params.id);
  if (!sortie) return res.status(404).json({ message: 'Sortie introuvable' });

  const { fuel_litres, fuel_cost } = req.body;
  if (fuel_litres !== undefined) sortie.fuel_litres = fuel_litres;
  if (fuel_cost !== undefined) sortie.fuel_cost = fuel_cost;
  await sortie.save();

  // Met à jour le kilométrage actuel du véhicule si un km d'arrivée existe
  if (sortie.arrival_km != null) {
    const vehicle = await Vehicle.findByPk(sortie.vehicle_id);
    if (vehicle && vehicle.current_km < sortie.arrival_km) {
      vehicle.current_km = sortie.arrival_km;
      await vehicle.save();
    }
  }

  await logAudit({ userId: req.user.id, action: 'record_fuel', entity: 'Sortie', entityId: sortie.id, newValue: { fuel_litres, fuel_cost }, req });

  res.json(sortie);
});

// Déclenche la vérification des maintenances dues : notifie les chefs si un
// véhicule approche/atteint une échéance. Appelé au démarrage ou périodiquement.
exports.checkDueAndNotify = async () => {
  try {
    const due = await Maintenance.findAll({
      where: {
        status: { [Op.ne]: 'done' },
        next_due_date: { [Op.lte]: new Date(Date.now() + MAINTENANCE_HORIZON_MS) },
      },
      include: [{ model: Vehicle, as: 'vehicle', attributes: ['id', 'type', 'current_km'] }],
      raw: true,
      nest: true,
    });
    for (const m of due) {
      const kmDue = m.next_due_km != null && m.vehicle?.current_km != null && m.vehicle.current_km >= m.next_due_km;
      const dateDue = m.next_due_date != null && new Date(m.next_due_date) <= new Date(Date.now() + MAINTENANCE_HORIZON_MS);
      if (kmDue || dateDue) {
        // Marqueur stable pour éviter les doublons entre deux cycles (toutes les 12h)
        const marker = `[M${m.id}]`;
        const alreadyNotified = await Notification.count({
          where: { type: 'maintenance_due', message: { [Op.like]: `%${marker}%` } },
        });
        if (alreadyNotified > 0) continue;

        const reason = kmDue && dateDue ? 'échéance (km et date)' : kmDue ? 'kilométrage atteint' : 'date d\'échéance';
        await notifyChiefsDb({
          message: `Maintenance requise pour ${m.vehicle?.type || 'un véhicule'} (${reason}) — ${m.type} ${marker}`,
          type: 'maintenance_due',
        });
      }
    }
  } catch (err) {
    console.error('Erreur vérification maintenance:', err.message);
  }
};
