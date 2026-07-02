const { Sortie, Vehicle, Request, SortieRequest } = require('../models');
const sortieService = require('../services/sortieService');
const { createNotification } = require('./notificationController');

// Créer une sortie + assigner véhicule/conducteur
exports.create = async (req, res) => {
  try {
    const { vehicle_id, driver_name, destination, departure_time } = req.body;

    const vehicle = await Vehicle.findByPk(vehicle_id);
    if (!vehicle || vehicle.status !== 'available') {
      return res.status(400).json({ message: 'Véhicule indisponible' });
    }

    const sortie = await Sortie.create({
      vehicle_id, driver_name, destination, departure_time,
      status: 'planned',
    });

    vehicle.status = 'busy';
    await vehicle.save();

    res.status(201).json(sortie);
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

exports.getAll = async (req, res) => {
  try {
    const sorties = await Sortie.findAll({
      include: [Vehicle, { model: Request, through: { attributes: [] } }],
      order: [['departure_time', 'DESC']],
    });
    res.json(sorties);
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

    res.json(sortie);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

// Enregistrer l'arrivée (km arrivée) + calcul distance + clôture
exports.arrivee = async (req, res) => {
  try {
    const { arrival_km } = req.body;
    const sortie = await Sortie.findByPk(req.params.id);
    if (!sortie) return res.status(404).json({ message: 'Sortie introuvable' });

    if (sortie.departure_km === null) {
      return res.status(400).json({ message: 'Le km de départ doit être renseigné avant l’arrivée' });
    }
    if (arrival_km < sortie.departure_km) {
      return res.status(400).json({ message: 'Le km d’arrivée ne peut pas être inférieur au km de départ' });
    }

    sortie.arrival_km = arrival_km;
    sortie.distance_km = arrival_km - sortie.departure_km;
    sortie.status = 'finished';
    await sortie.save();

    const vehicle = await Vehicle.findByPk(sortie.vehicle_id);
    if (vehicle) {
      vehicle.status = 'available';
      await vehicle.save();
    }

    res.json(sortie);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};