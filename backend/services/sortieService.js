const { Request, SortieRequest, Sortie, Employee, Vehicle } = require('../models');
const { Op } = require('sequelize');
const { notifyChiefs } = require('./socketService');

// Critère de regroupement du cahier des charges : écart horaire ≤ 30 min
const COMPAT_WINDOW_MS = 30 * 60 * 1000;

// Trouve les demandes compatibles avec une sortie (même destination,
// écart horaire ≤ 30 min, capacité respectée)
exports.findCompatibleRequests = async (sortieId, destination, vehicleCapacity, departureTime) => {
  const linkedRequestIds = (await SortieRequest.findAll({ attributes: ['request_id'] })).map((sr) => sr.request_id);

  const departure = departureTime ? new Date(departureTime) : null;

  const candidates = await Request.findAll({
    where: {
      destination: { [Op.iLike]: destination },
      status: { [Op.in]: ['pending', 'approved'] },
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
 * Crée automatiquement une sortie quand une demande est approuvée avec véhicule :
 * - réutilise une sortie existante au même créneau (écart ≤ 30 min) sur le même
 *   véhicule, même destination, si la capacité le permet (regroupement)
 * - sinon crée la sortie, lie la demande et occupe le véhicule
 */
exports.autoCreateSortie = async (request) => {
  if (!request.vehicle_id) return;

  const emp = await Employee.findByPk(request.employee_id);
  const vehicle = await Vehicle.findByPk(request.vehicle_id);
  const capacity = vehicle ? vehicle.capacity : null;

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
    if (capacity !== null) {
      const links = await SortieRequest.findAll({ where: { sortie_id: existingSortie.id } });
      const linkedIds = links.map((l) => l.request_id);
      const linked = linkedIds.length > 0
        ? await Request.findAll({ where: { id: { [Op.in]: linkedIds } } })
        : [];
      const occupied = linked.reduce((sum, r) => sum + (r.nb_personnes || 0), 0);
      if (occupied + (request.nb_personnes || 0) > capacity) {
        return;
      }
    }
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

  if (vehicle && vehicle.status === 'available') {
    vehicle.status = 'busy';
    await vehicle.save();
  }

  notifyChiefs('sortie_created', sortie);
};
