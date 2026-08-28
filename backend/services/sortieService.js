const { Request, SortieRequest, Sortie, Employee, Vehicle } = require('../models');
const { Op } = require('sequelize');
const { notifyChiefs } = require('./socketService');

// Trouve les demandes compatibles avec une sortie (même destination, capacité respectée)
exports.findCompatibleRequests = async (sortieId, destination, vehicleCapacity) => {
  const linkedRequestIds = (await SortieRequest.findAll({ attributes: ['request_id'] })).map((sr) => sr.request_id);

  const candidates = await Request.findAll({
    where: {
      destination,
      status: 'pending',
      id: { [Op.notIn]: linkedRequestIds },
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
 * Crée automatiquement une sortie quand une demande est approuvée avec véhicule :
 * - réutilise une sortie existante au même créneau sur le même véhicule (regroupement)
 * - sinon crée la sortie, lie la demande et occupe le véhicule
 */
exports.autoCreateSortie = async (request) => {
  if (!request.vehicle_id) return;

  const emp = await Employee.findByPk(request.employee_id);
  const existingSortie = await Sortie.findOne({
    where: { vehicle_id: request.vehicle_id, departure_time: request.date_souhaitee },
  });

  if (existingSortie) {
    const linkExists = await SortieRequest.findOne({
      where: { sortie_id: existingSortie.id, request_id: request.id },
    });
    if (!linkExists) {
      await SortieRequest.create({ sortie_id: existingSortie.id, request_id: request.id });
    }
    return;
  }

  const sortie = await Sortie.create({
    vehicle_id: request.vehicle_id,
    driver_name: emp ? `${emp.prenom} ${emp.nom}` : 'Chauffeur',
    destination: request.destination,
    departure_time: request.date_souhaitee,
    status: 'planned',
  });
  await SortieRequest.create({ sortie_id: sortie.id, request_id: request.id });

  const vehicle = await Vehicle.findByPk(request.vehicle_id);
  if (vehicle && vehicle.status === 'available') {
    vehicle.status = 'busy';
    await vehicle.save();
  }

  notifyChiefs('sortie_created', sortie);
};
