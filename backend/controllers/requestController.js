const { Request, Employee, Vehicle, Sortie, SortieRequest } = require('../models');
const { Op } = require('sequelize');
const { createNotification } = require('./notificationController');
const { notifyChiefs } = require('../services/socketService');

async function autoCreateSortie(request) {
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
  } else {
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
  }
}

// Employé : créer une demande
exports.create = async (req, res) => {
  try {
    const { destination, motif, date_souhaitee, nb_personnes, vehicle_id } = req.body;

    if (vehicle_id) {
      const vehicle = await Vehicle.findByPk(vehicle_id);
      if (!vehicle || vehicle.status !== 'available') {
        return res.status(400).json({ message: 'Véhicule indisponible' });
      }

      const requestedDate = new Date(date_souhaitee);
      const startOfDay = new Date(requestedDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(requestedDate);
      endOfDay.setHours(23, 59, 59, 999);

      const occupiedRequests = await Request.findAll({
        where: {
          vehicle_id,
          status: ['pending', 'approved', 'rescheduled'],
          date_souhaitee: { [Op.between]: [startOfDay, endOfDay] },
        },
        attributes: ['nb_personnes'],
      });
      const occupiedSeats = occupiedRequests.reduce((sum, r) => sum + (r.nb_personnes || 0), 0);
      if (occupiedSeats + nb_personnes > vehicle.capacity) {
        return res.status(400).json({ message: 'Pas assez de places disponibles dans ce véhicule pour cette date' });
      }
    }

    const request = await Request.create({
      employee_id: req.user.id,
      vehicle_id: vehicle_id || null,
      destination,
      motif,
      date_souhaitee,
      nb_personnes,
      status: 'pending',
    });

    res.status(201).json(request);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

// Employé : voir ses propres demandes
exports.mine = async (req, res) => {
  try {
    const requests = await Request.findAll({
      where: { employee_id: req.user.id },
      include: [
        { model: Vehicle, attributes: ['id', 'type', 'capacity'] },
        { model: Sortie, attributes: ['id', 'destination', 'status', 'departure_km', 'arrival_km', 'distance_km', 'return_km', 'returned_at', 'departure_time'], through: { attributes: [] } },
      ],
      order: [['createdAt', 'DESC']],
    });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

// Chef logistique : voir toutes les demandes avec filtres + pagination
exports.all = async (req, res) => {
  try {
    const {
      page = 1, limit = 50,
      status, employee_id, destination,
      date_from, date_to,
    } = req.query;

    const where = {};
    if (status) where.status = status;
    if (employee_id) where.employee_id = parseInt(employee_id, 10);
    if (destination) where.destination = { [Op.iLike]: `%${destination}%` };
    if (date_from) where.date_souhaitee = { ...where.date_souhaitee, [Op.gte]: new Date(date_from) };
    if (date_to) where.date_souhaitee = { ...where.date_souhaitee, [Op.lte]: new Date(date_to) };

    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const { count, rows } = await Request.findAndCountAll({
      where,
      include: [
        { model: Employee, attributes: ['id', 'nom', 'prenom', 'department'] },
        { model: Vehicle, attributes: ['id', 'type', 'capacity'] },
        { model: Sortie, attributes: ['id', 'destination', 'status', 'departure_km', 'arrival_km', 'distance_km', 'return_km', 'returned_at', 'departure_time'], through: { attributes: [] } },
      ],
      order: [['createdAt', 'DESC']],
      offset,
      limit: parseInt(limit, 10),
    });

    res.json({
      data: rows,
      total: count,
      page: parseInt(page, 10),
      totalPages: Math.ceil(count / parseInt(limit, 10)),
    });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

// Chef logistique : valider / refuser / replanifier
exports.updateStatus = async (req, res) => {
  try {
    const { status, new_date } = req.body;
    const request = await Request.findByPk(req.params.id);

    if (!request) {
      return res.status(404).json({ message: 'Demande introuvable' });
    }

    if (!['approved', 'rejected', 'rescheduled'].includes(status)) {
      return res.status(400).json({ message: 'Statut invalide' });
    }

    const allowedTransitions = { pending: ['approved', 'rejected', 'rescheduled'], rescheduled: ['approved', 'rejected'] };
    if (!allowedTransitions[request.status]?.includes(status)) {
      return res.status(400).json({ message: `Impossible de passer de "${request.status}" à "${status}"` });
    }

    request.status = status;
    if (status === 'rescheduled' && new_date) {
      request.date_souhaitee = new_date;
    }
    await request.save();

    if (status === 'approved') {
      await autoCreateSortie(request);
    }

    await createNotification({
      user_id: request.employee_id,
      message: `Votre demande vers ${request.destination} a été ${
        status === 'approved' ? 'validée' :
        status === 'rejected' ? 'refusée' : 'replanifiée'
      }`,
      type: status,
    });

    res.json(request);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};


// Employé : annuler sa propre demande (même validée)
exports.cancel = async (req, res) => {
  try {
    const request = await Request.findByPk(req.params.id);

    if (!request) return res.status(404).json({ message: 'Demande introuvable' });
    if (request.employee_id !== req.user.id) {
      return res.status(403).json({ message: 'Action non autorisée' });
    }
    if (!['pending', 'approved', 'rescheduled'].includes(request.status)) {
      return res.status(400).json({ message: 'Cette demande ne peut plus être annulée' });
    }

    const wasApproved = request.status === 'approved';
    const vehicleId = request.vehicle_id;

    await SortieRequest.destroy({ where: { request_id: request.id } });

    request.status = 'cancelled';
    request.vehicle_id = null;
    await request.save();

    if (wasApproved && vehicleId) {
      const hasActiveSorties = await SortieRequest.count({
        include: [
          { model: Sortie, where: { vehicle_id: vehicleId, status: { [Op.notIn]: ['finished'] } }, required: true },
        ],
      });
      if (hasActiveSorties === 0) {
        const activeRequests = await Request.count({
          where: { vehicle_id: vehicleId, status: ['pending', 'approved', 'rescheduled'] },
        });
        if (activeRequests === 0) {
          const vehicle = await Vehicle.findByPk(vehicleId);
          if (vehicle) {
            vehicle.status = 'available';
            await vehicle.save();
          }
        }
      }
    }

    await createNotification({
      user_id: request.employee_id,
      message: `Votre demande vers ${request.destination} a été annulée`,
      type: 'cancelled',
    });

    res.json(request);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

// Employé : modifier sa propre demande (uniquement si pending)
exports.update = async (req, res) => {
  try {
    const request = await Request.findByPk(req.params.id);
    if (!request) return res.status(404).json({ message: 'Demande introuvable' });
    if (request.employee_id !== req.user.id) {
      return res.status(403).json({ message: 'Action non autorisée' });
    }
    if (request.status !== 'pending') {
      return res.status(400).json({ message: 'Seules les demandes en attente peuvent être modifiées' });
    }

    const { destination, motif, date_souhaitee, nb_personnes, vehicle_id } = req.body;
    if (destination !== undefined) request.destination = destination;
    if (motif !== undefined) request.motif = motif;
    if (date_souhaitee !== undefined) request.date_souhaitee = date_souhaitee;
    if (nb_personnes !== undefined) request.nb_personnes = nb_personnes;
    if (vehicle_id !== undefined) request.vehicle_id = vehicle_id;

    await request.save();
    res.json(request);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

// Employé : répondre à une proposition de replanification
exports.respondReschedule = async (req, res) => {
  try {
    const { accepted } = req.body;
    const request = await Request.findByPk(req.params.id);

    if (!request) return res.status(404).json({ message: 'Demande introuvable' });
    if (request.employee_id !== req.user.id) {
      return res.status(403).json({ message: 'Action non autorisée' });
    }
    if (request.status !== 'rescheduled') {
      return res.status(400).json({ message: 'Cette demande n\'est pas en attente de réponse' });
    }

    request.status = accepted ? 'approved' : 'rejected';
    await request.save();

    if (accepted) {
      await autoCreateSortie(request);
    }

    await createNotification({
      user_id: request.employee_id,
      message: accepted
        ? `Vous avez accepté la replanification pour ${request.destination}`
        : `Vous avez refusé la replanification pour ${request.destination}`,
      type: accepted ? 'approved' : 'rejected',
    });

    res.json(request);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};