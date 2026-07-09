const { Request, Employee, Vehicle, Sortie, SortieRequest } = require('../models');
const { Op } = require('sequelize');
const { createNotification } = require('./notificationController');
const { notifyChiefs } = require('../services/socketService');

// Employé : créer une demande
exports.create = async (req, res) => {
  try {
    const { destination, motif, date_souhaitee, nb_personnes, vehicle_id } = req.body;

    if (vehicle_id) {
      const vehicle = await Vehicle.findByPk(vehicle_id);
      if (!vehicle || vehicle.status !== 'available') {
        return res.status(400).json({ message: 'Véhicule indisponible' });
      }

      const pastApproved = await Request.count({
        where: {
          vehicle_id,
          status: 'approved',
          date_souhaitee: { [Op.lt]: new Date() },
        },
      });
      if (pastApproved > 0) {
        return res.status(400).json({ message: 'Véhicule déjà en trajet (départ passé)' });
      }

      const occupiedCount = await Request.count({
        where: { vehicle_id, status: ['pending', 'approved', 'rescheduled'] },
      });
      if (occupiedCount + nb_personnes > vehicle.capacity) {
        return res.status(400).json({ message: 'Pas assez de places disponibles dans ce véhicule' });
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
    const { status, new_date } = req.body; // status: approved | rejected | rescheduled
    const request = await Request.findByPk(req.params.id);

    if (!request) {
      return res.status(404).json({ message: 'Demande introuvable' });
    }

    request.status = status;
    if (status === 'rescheduled' && new_date) {
      request.date_souhaitee = new_date;
    }
    await request.save();

    // Auto-créer une sortie dès qu'une demande est validée
    if (status === 'approved' && request.vehicle_id) {
      const emp = await Employee.findByPk(request.employee_id);
      const existingSortie = await Sortie.findOne({
        where: { vehicle_id: request.vehicle_id, departure_time: request.date_souhaitee },
      });
      if (!existingSortie) {
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

    // ⬇️ AJOUT : notifier l'employé du changement de statut
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

    request.status = 'cancelled';
    request.vehicle_id = null;
    await request.save();

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
    const { accepted } = req.body; // true | false
    const request = await Request.findByPk(req.params.id);

    if (!request) return res.status(404).json({ message: 'Demande introuvable' });
    if (request.employee_id !== req.user.id) {
      return res.status(403).json({ message: 'Action non autorisée' });
    }

    request.status = accepted ? 'approved' : 'rejected';
    await request.save();

    res.json(request);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};