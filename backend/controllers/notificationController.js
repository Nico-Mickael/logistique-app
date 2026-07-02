const { Notification } = require('../models');

exports.mine = async (req, res) => {
  try {
    const notifications = await Notification.findAll({
      where: { user_id: req.user.id },
      order: [['createdAt', 'DESC']],
    });
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findByPk(req.params.id);
    if (!notification) return res.status(404).json({ message: 'Notification introuvable' });

    if (notification.user_id !== req.user.id) {
      return res.status(403).json({ message: 'Action non autorisée' });
    }

    notification.is_read = true;
    await notification.save();

    res.json(notification);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

// Fonction utilitaire réutilisable depuis les autres contrôleurs
exports.createNotification = async ({ user_id, message, type }) => {
  return Notification.create({ user_id, message, type, is_read: false });
};