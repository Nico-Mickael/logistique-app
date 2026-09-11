const jwt = require('jsonwebtoken');
const { Session } = require('../models');

// Ne réécrit last_active_at que toutes les 2 min (évite un UPDATE par requête).
const LAST_ACTIVE_THROTTLE_MS = 2 * 60 * 1000;

module.exports = async function (req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token manquant' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.sid) {
      const session = await Session.findOne({
        where: { id: decoded.sid, revoked: false },
      });

      if (!session) {
        return res.status(401).json({ message: 'Session révoquée' });
      }

      if (new Date() > new Date(session.expires_at)) {
        session.revoked = true;
        session.revoked_at = new Date();
        await session.save();
        return res.status(401).json({ message: 'Session expirée' });
      }

      const now = new Date();
      if (session.last_active_at == null ||
        now.getTime() - new Date(session.last_active_at).getTime() > LAST_ACTIVE_THROTTLE_MS) {
        session.last_active_at = now;
        await session.save();
      }
    }

    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Token invalide ou expiré' });
  }
};
