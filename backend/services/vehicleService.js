const { Vehicle, Request, SortieRequest, Sortie } = require('../models');
const { Op } = require('sequelize');
const { ACTIVE_REQUEST_STATUSES } = require('../utils/constants');

/**
 * Passe un véhicule au statut "available" (s'il existe et n'y est pas déjà).
 */
exports.setAvailable = async (vehicleId) => {
  if (!vehicleId) return;
  const vehicle = await Vehicle.findByPk(vehicleId);
  if (vehicle && vehicle.status !== 'available') {
    vehicle.status = 'available';
    await vehicle.save();
  }
};

/**
 * Libère un véhicule uniquement s'il n'a plus aucune sortie active
 * ni aucune demande active rattachée.
 */
exports.releaseIfIdle = async (vehicleId) => {
  if (!vehicleId) return;

  const hasActiveSorties = await SortieRequest.count({
    include: [
      { model: Sortie, where: { vehicle_id: vehicleId, status: { [Op.notIn]: ['finished'] } }, required: true },
    ],
  });
  if (hasActiveSorties > 0) return;

  const activeRequests = await Request.count({
    where: { vehicle_id: vehicleId, status: ACTIVE_REQUEST_STATUSES },
  });
  if (activeRequests > 0) return;

  await exports.setAvailable(vehicleId);
};
