const { Request, Employee } = require('../models');

// Employé : créer une demande
exports.create = async (req, res) => {
  try {
    const { destination, motif, date_souhaitee, nb_personnes } = req.body;

    const request = await Request.create({
      employee_id: req.user.id,
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
      order: [['createdAt', 'DESC']],
    });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

// Chef logistique : voir toutes les demandes
exports.all = async (req, res) => {
  try {
    const requests = await Request.findAll({
      include: [{ model: Employee, attributes: ['nom', 'prenom', 'department'] }],
      order: [['createdAt', 'DESC']],
    });
    res.json(requests);
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

    res.json(request);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};