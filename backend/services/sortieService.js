const { Request, SortieRequest } = require('../models');
const { Op } = require('sequelize');

// Trouve les demandes compatibles avec une sortie (même destination, ±30min, capacité respectée)
exports.findCompatibleRequests = async (destination, dateSouhaitee, vehicleCapacity, currentCount = 0) => {
  const target = new Date(dateSouhaitee);
  const min = new Date(target.getTime() - 30 * 60000);
  const max = new Date(target.getTime() + 30 * 60000);

  const linkedRequestIds = (await SortieRequest.findAll({ attributes: ['request_id'] })).map((sr) => sr.request_id);

  const candidates = await Request.findAll({
    where: {
      destination,
      status: 'approved',
      date_souhaitee: { [Op.between]: [min, max] },
      id: { [Op.notIn]: linkedRequestIds },
    },
  });

  // Filtre supplémentaire selon la capacité restante du véhicule
  const compatible = [];
  let total = currentCount;
  for (const req of candidates) {
    if (total + req.nb_personnes <= vehicleCapacity) {
      compatible.push(req);
      total += req.nb_personnes;
    }
  }
  return compatible;
};