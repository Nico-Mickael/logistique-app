const jwt = require('jsonwebtoken');
const { CHIEF_ROLES } = require('../utils/constants');

let io;

function setupSocket(server) {
  io = require('socket.io')(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST'],
    },
  });

  const userSockets = new Map();

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

      socket.on('disconnect', () => {
        const set = userSockets.get(decoded.id);
        if (set) {
          set.delete(socket.id);
          if (set.size === 0) userSockets.delete(decoded.id);
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

module.exports = { setupSocket, notifyUser, notifyChiefs };
