const { Sortie, Vehicle, Request, SortieRequest } = require('../models');
const { Op } = require('sequelize');
const sortieService = require('../services/sortieService');
const { createNotification } = require('./notificationController');
const { notifyChiefs } = require('../services/socketService');

// Créer une sortie + assigner véhicule/conducteur
exports.create = async (req, res) => {
  try {
    const { vehicle_id, driver_name, destination, departure_time, departure_km } = req.body;

    const vehicle = await Vehicle.findByPk(vehicle_id);
    if (!vehicle || vehicle.status !== 'available') {
      return res.status(400).json({ message: 'Véhicule indisponible' });
    }

    const sortie = await Sortie.create({
      vehicle_id, driver_name, destination, departure_time,
      departure_km: departure_km || null,
      status: 'planned',
    });

    vehicle.status = 'busy';
    await vehicle.save();

    notifyChiefs('sortie_created', sortie);

    res.status(201).json(sortie);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

// Dernière sortie d'un véhicule (pour récupérer le return_km)
exports.lastForVehicle = async (req, res) => {
  try {
    const { vehicleId } = req.params;
    const sortie = await Sortie.findOne({
      where: { vehicle_id: vehicleId },
      order: [['createdAt', 'DESC']],
    });
    res.json(sortie);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

// Voir les demandes compatibles avec une sortie (avant de les ajouter)
exports.suggestions = async (req, res) => {
  try {
    const sortie = await Sortie.findByPk(req.params.id, { include: Vehicle });
    if (!sortie) return res.status(404).json({ message: 'Sortie introuvable' });

    const existingCount = await SortieRequest.count({ where: { sortie_id: sortie.id } });

    const compatible = await sortieService.findCompatibleRequests(
      sortie.destination,
      sortie.departure_time,
      sortie.Vehicle.capacity,
      existingCount
    );

    res.json(compatible);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

// Ajouter une demande à une sortie (regroupement)
exports.addRequest = async (req, res) => {
  try {
    const { request_id } = req.body;
    const sortie = await Sortie.findByPk(req.params.id);
    if (!sortie) return res.status(404).json({ message: 'Sortie introuvable' });

    await SortieRequest.create({ sortie_id: sortie.id, request_id });

    // ⬇️ AJOUT : notifier l'employé
    const request = await Request.findByPk(request_id);
    if (request) {
      await createNotification({
        user_id: request.employee_id,
        message: `Votre demande a été intégrée à une sortie vers ${sortie.destination}`,
        type: 'sortie_assignment',
      });
    }

    res.status(201).json({ message: 'Demande ajoutée à la sortie' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

// Changer le statut d'une sortie (planned → ongoing → finished)
exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const sortie = await Sortie.findByPk(req.params.id);
    if (!sortie) return res.status(404).json({ message: 'Sortie introuvable' });

    sortie.status = status;
    await sortie.save();

    // Libère le véhicule quand la sortie est terminée
    if (status === 'finished') {
      const vehicle = await Vehicle.findByPk(sortie.vehicle_id);
      if (vehicle) {
        vehicle.status = 'available';
        await vehicle.save();
      }
    }

    res.json(sortie);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

// Employé : voir les sorties liées à ses demandes
exports.mine = async (req, res) => {
  try {
    const { Request, SortieRequest } = require('../models');
    const userRequests = await Request.findAll({
      where: { employee_id: req.user.id },
      attributes: ['id'],
    });
    const requestIds = userRequests.map((r) => r.id);

    const sortieRequests = await SortieRequest.findAll({
      where: { request_id: requestIds },
    });
    const sortieIds = sortieRequests.map((sr) => sr.sortie_id);

    const sorties = await Sortie.findAll({
      where: { id: sortieIds },
      include: [Vehicle, { model: Request, through: { attributes: [] } }],
      order: [['departure_time', 'DESC']],
    });

    res.json(sorties);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

exports.getAll = async (req, res) => {
  try {
    const {
      page = 1, limit = 50,
      status, vehicle_id, destination,
      date_from, date_to,
    } = req.query;

    const where = {};
    if (status) where.status = status;
    if (vehicle_id) where.vehicle_id = parseInt(vehicle_id, 10);
    if (destination) where.destination = { [Op.iLike]: `%${destination}%` };
    if (date_from) where.departure_time = { ...where.departure_time, [Op.gte]: new Date(date_from) };
    if (date_to) where.departure_time = { ...where.departure_time, [Op.lte]: new Date(date_to) };

    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const { count, rows } = await Sortie.findAndCountAll({
      where,
      include: [Vehicle, { model: Request, through: { attributes: [] } }],
      order: [['departure_time', 'DESC']],
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

// Enregistrer le départ (km départ)
exports.depart = async (req, res) => {
  try {
    const { departure_km } = req.body;
    const sortie = await Sortie.findByPk(req.params.id);
    if (!sortie) return res.status(404).json({ message: 'Sortie introuvable' });

    sortie.departure_km = departure_km;
    sortie.status = 'ongoing';
    await sortie.save();

    notifyChiefs('sortie_updated', sortie);

    res.json(sortie);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

// Enregistrer l'arrivée (km arrivée) et terminer la sortie
exports.arrivee = async (req, res) => {
  try {
    const { arrival_km } = req.body;
    const sortie = await Sortie.findByPk(req.params.id, { include: Vehicle });
    if (!sortie) return res.status(404).json({ message: 'Sortie introuvable' });
    if (sortie.status !== 'ongoing') {
      return res.status(400).json({ message: 'Seules les sorties en cours peuvent enregistrer l\'arrivée' });
    }
    if (sortie.departure_km === null) {
      return res.status(400).json({ message: 'Le km de départ doit être renseigné' });
    }
    if (!arrival_km || arrival_km < sortie.departure_km) {
      return res.status(400).json({ message: 'Le km d\'arrivée ne peut pas être inférieur au km de départ' });
    }

    sortie.arrival_km = arrival_km;
    sortie.distance_km = arrival_km - sortie.departure_km;
    sortie.status = 'finished';
    await sortie.save();

    // Libérer le véhicule
    if (sortie.Vehicle) {
      sortie.Vehicle.status = 'available';
      await sortie.Vehicle.save();
    }

    notifyChiefs('sortie_updated', sortie);

    res.json(sortie);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

// Modifier une sortie (uniquement si planifiée)
exports.update = async (req, res) => {
  try {
    const sortie = await Sortie.findByPk(req.params.id);
    if (!sortie) return res.status(404).json({ message: 'Sortie introuvable' });
    if (sortie.status !== 'planned') {
      return res.status(400).json({ message: 'Seules les sorties planifiées peuvent être modifiées' });
    }

    const { destination, driver_name, departure_time, vehicle_id } = req.body;

    if (vehicle_id && vehicle_id !== sortie.vehicle_id) {
      const oldVehicle = await Vehicle.findByPk(sortie.vehicle_id);
      const newVehicle = await Vehicle.findByPk(vehicle_id);
      if (!newVehicle || newVehicle.status !== 'available') {
        return res.status(400).json({ message: 'Nouveau véhicule indisponible' });
      }
      if (oldVehicle) { oldVehicle.status = 'available'; await oldVehicle.save(); }
      newVehicle.status = 'busy'; await newVehicle.save();
      sortie.vehicle_id = vehicle_id;
    }

    if (destination !== undefined) sortie.destination = destination;
    if (driver_name !== undefined) sortie.driver_name = driver_name;
    if (departure_time !== undefined) sortie.departure_time = departure_time;

    await sortie.save();
    notifyChiefs('sortie_updated', sortie);
    res.json(sortie);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

// Supprimer une sortie
exports.remove = async (req, res) => {
  try {
    const sortie = await Sortie.findByPk(req.params.id);
    if (!sortie) return res.status(404).json({ message: 'Sortie introuvable' });

    const vehicle = await Vehicle.findByPk(sortie.vehicle_id);
    if (vehicle) {
      vehicle.status = 'available';
      await vehicle.save();
    }

    await SortieRequest.destroy({ where: { sortie_id: sortie.id } });
    await sortie.destroy();

    notifyChiefs('sortie_updated', { id: sortie.id, deleted: true });
    res.json({ message: 'Sortie supprimée' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

// Employé : marquer le retour du véhicule (remise)
exports.employeeReturn = async (req, res) => {
  try {
    const { return_km, returned_at } = req.body;
    const sortie = await Sortie.findByPk(req.params.id);
    if (!sortie) return res.status(404).json({ message: 'Sortie introuvable' });

    if (sortie.status !== 'ongoing') {
      return res.status(400).json({ message: 'Seules les sorties en cours peuvent être retournées' });
    }
    if (sortie.departure_km === null) {
      return res.status(400).json({ message: 'Le km de départ doit être renseigné' });
    }
    if (!return_km || return_km < sortie.departure_km) {
      return res.status(400).json({ message: 'Le km de retour ne peut pas être inférieur au km de départ' });
    }

    // Vérifier que l'employé fait partie de cette sortie
    const userRequests = await Request.findAll({
      where: { employee_id: req.user.id },
      attributes: ['id'],
    });
    const requestIds = userRequests.map((r) => r.id);
    const link = await SortieRequest.findOne({
      where: { sortie_id: sortie.id, request_id: requestIds },
    });
    if (!link) {
      return res.status(403).json({ message: 'Vous n\'êtes pas associé à cette sortie' });
    }

    sortie.return_km = return_km;
    sortie.returned_at = returned_at ? new Date(returned_at) : new Date();
    sortie.status = 'pending_return';
    await sortie.save();

    await createNotification({
      user_id: req.user.id,
      message: `Retour marqué pour la sortie vers ${sortie.destination}. En attente de validation.`,
      type: 'return_marked',
    });
    notifyChiefs('sortie_updated', sortie);

    res.json(sortie);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

// Admin : valider le retour et clôturer la sortie
exports.validateReturn = async (req, res) => {
  try {
    const sortie = await Sortie.findByPk(req.params.id);
    if (!sortie) return res.status(404).json({ message: 'Sortie introuvable' });

    if (sortie.status !== 'pending_return') {
      return res.status(400).json({ message: 'Seules les sorties en attente de retour peuvent être validées' });
    }
    if (sortie.return_km === null) {
      return res.status(400).json({ message: 'Le km de retour doit d\'abord être renseigné par l\'employé' });
    }

    sortie.arrival_km = sortie.return_km;
    sortie.distance_km = sortie.arrival_km - sortie.departure_km;
    sortie.status = 'finished';
    await sortie.save();

    const vehicle = await Vehicle.findByPk(sortie.vehicle_id);
    if (vehicle) {
      vehicle.status = 'available';
      await vehicle.save();
    }

    // Notifier les employés liés à la sortie
    const sortieRequests = await SortieRequest.findAll({ where: { sortie_id: sortie.id } });
    for (const sr of sortieRequests) {
      const request = await Request.findByPk(sr.request_id);
      if (request) {
        await createNotification({
          user_id: request.employee_id,
          message: `La sortie vers ${sortie.destination} est terminée et validée.`,
          type: 'sortie_finished',
        });
      }
    }

    notifyChiefs('sortie_updated', sortie);
    res.json(sortie);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};