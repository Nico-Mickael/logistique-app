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

      if (CHIEF_ROLES.includes(decoded.role)) {
        socket.join('chiefs');
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

function notifyChiefs(event, data) {
  if (!io) return;
  io.to('chiefs').emit(event, data);
}

module.exports = { setupSocket, notifyUser, notifyChiefs };
