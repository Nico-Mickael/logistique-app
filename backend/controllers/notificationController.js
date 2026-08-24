const { Op } = require('sequelize');
const { Notification, Employee } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { CHIEF_ROLES } = require('../utils/constants');
const { notifyUser } = require('../services/socketService');
const { sendNotificationEmail } = require('../services/mailService');

exports.mine = asyncHandler(async (req, res) => {
  const notifications = await Notification.findAll({
    where: { user_id: req.user.id },
    order: [['createdAt', 'DESC']],
  });
  res.json(notifications);
});

exports.markAsRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findByPk(req.params.id);
  if (!notification) return res.status(404).json({ message: 'Notification introuvable' });

  if (notification.user_id !== req.user.id) {
    return res.status(403).json({ message: 'Action non autorisée' });
  }

  notification.is_read = true;
  await notification.save();

  res.json(notification);
});

exports.markAllRead = asyncHandler(async (req, res) => {
  const [updated] = await Notification.update(
    { is_read: true },
    { where: { user_id: req.user.id, is_read: false } }
  );
  res.json({ message: 'Toutes les notifications ont été marquées comme lues', updated });
});

// Fonction utilitaire réutilisable depuis les autres contrôleurs.
// Chaque notification interne est aussi envoyée par email (si SMTP configuré).
exports.createNotification = async ({ user_id, message, type }) => {
  const notif = await Notification.create({ user_id, message, type, is_read: false });
  notifyUser(user_id, 'notification', notif);

  Employee.findByPk(user_id, { attributes: ['id', 'email'] })
    .then((employee) => {
      if (employee?.email) return sendNotificationEmail(employee, notif);
    })
    .catch((err) => console.error('[mail] Erreur :', err.message));

  return notif;
};

// Notifie tous les comptes "chef" (logistics_chief, admin, superadmin)
// avec une notification persistée en base (visible dans la cloche).
exports.notifyChiefsDb = async ({ message, type, excludeUserId }) => {
  const chiefs = await Employee.findAll({
    where: { role: { [Op.in]: CHIEF_ROLES } },
    attributes: ['id'],
  });

  for (const chief of chiefs) {
    if (excludeUserId && chief.id === excludeUserId) continue;
    await exports.createNotification({ user_id: chief.id, message, type });
  }
};
