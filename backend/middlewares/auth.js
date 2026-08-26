const jwt = require('jsonwebtoken');
const { Session } = require('../models');

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

      session.last_active_at = new Date();
      await session.save();
    }

    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Token invalide ou expiré' });
  }
};
