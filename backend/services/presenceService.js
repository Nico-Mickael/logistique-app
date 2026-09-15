const { Op } = require('sequelize');
const { Session } = require('../models');
const { getOnlineUserIds } = require('./socketService');

const PRESENCE_WINDOW_MS = 5 * 60 * 1000;

/**
 * Statut de présence pour un ensemble d'utilisateurs.
 *
 * Un utilisateur est considéré en ligne si :
 *  - il a au moins une connexion socket active (getOnlineUserIds()), OU
 *  - il possède une session active non révoquée dont `last_active_at` date
 *    de moins de 5 minutes (idle au sens HTTP).
 *
 * Le champ `last_seen` reflète la date de dernière activité HTTP (mis à jour
 * par le middleware auth toutes les 2 min, et par le refresh).
 */
async function bulkOnlineStatus(userIdsArg) {
  const userIds = Array.isArray(userIdsArg)
    ? userIdsArg.filter((id) => id != null).map(Number)
    : [];

  if (userIds.length === 0) return {};

  const now = Date.now();

  const sessions = await Session.findAll({
    where: {
      user_id: { [Op.in]: userIds },
      revoked: false,
      last_active_at: { [Op.gte]: new Date(now - PRESENCE_WINDOW_MS) },
      expires_at: { [Op.gt]: new Date(now) },
    },
    attributes: ['user_id', 'last_active_at'],
    order: [['last_active_at', 'DESC']],
  });

  const live = getOnlineUserIds();

  const lastSeen = new Map();
  for (const s of sessions) {
    if (!lastSeen.has(s.user_id)) lastSeen.set(s.user_id, s.last_active_at);
  }

  const statuses = {};
  for (const id of userIds) {
    statuses[id] = {
      online: live.has(id) || lastSeen.has(id),
      last_seen: lastSeen.get(id) || null,
    };
  }

  return statuses;
}

module.exports = { PRESENCE_WINDOW_MS, bulkOnlineStatus };
