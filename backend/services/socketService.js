const jwt = require('jsonwebtoken');
const { CHIEF_ROLES } = require('../utils/constants');

let io;

// Connexions socket par utilisateur (multi-onglets : un Set de socket ids).
// Source "temps réel" de la présence : un utilisateur est en ligne (live)
// tant qu'il a au moins une connexion socket active.
const userSockets = new Map();

function getOnlineUserIds() {
  return new Set(userSockets.keys());
}

function isUserOnline(userId) {
  const set = userSockets.get(userId);
  return !!set && set.size > 0;
}

// Préviens les chefs (Superadmins + chefs de site) et l'utilisateur lui-même
// à chaque entrée/sortie en ligne : permet de mettre à jour les listes et les
// sélecteurs de chauffeur en temps réel, sans rafraîchir la page.
function emitPresence(userId, online, role) {
  if (!io) return;
  const data = { user_id: userId, online, role: role || null, at: new Date().toISOString() };
  io.to('chiefs').emit('presence', data);
  io.to(`user:${userId}`).emit('presence', data);
}

function setupSocket(server) {
  io = require('socket.io')(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    const token = socket.handshake.query.token;
    if (!token) {
      socket.disconnect();
      return;
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      socket.userRole = decoded.role;

      const becameOnline = !isUserOnline(decoded.id);
      const existing = userSockets.get(decoded.id) || new Set();
      existing.add(socket.id);
      userSockets.set(decoded.id, existing);

      socket.join(`user:${decoded.id}`);

      // Multi-sites : le Superadmin rejoint la salle globale des chefs,
      // les chefs locaux (admin / logistics_chief) leur salle de site.
      if (decoded.role === 'superadmin') {
        socket.join('chiefs');
      } else if (CHIEF_ROLES.includes(decoded.role) && decoded.site_id) {
        socket.join(`chiefs:site:${decoded.site_id}`);
      }

      if (becameOnline) emitPresence(decoded.id, true, decoded.role);

      socket.on('disconnect', () => {
        const set = userSockets.get(decoded.id);
        if (set) {
          set.delete(socket.id);
          if (set.size === 0) {
            userSockets.delete(decoded.id);
            emitPresence(decoded.id, false, decoded.role);
          }
        }
      });
    } catch {
      socket.disconnect();
    }
  });

  return io;
}

function notifyUser(userId, event, data) {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, data);
}

function notifyChiefs(event, data, siteId) {
  if (!io) return;
  // Les chefs locaux du site concerné…
  const targetSiteId = siteId ?? data?.site_id ?? null;
  if (targetSiteId) {
    io.to(`chiefs:site:${targetSiteId}`).emit(event, data);
  }
  // …et toujours les Superadmins (vision globale).
  io.to('chiefs').emit(event, data);
}

module.exports = { setupSocket, notifyUser, notifyChiefs, getOnlineUserIds, isUserOnline };