const { Employee } = require('../models');

module.exports = function (allowedRoles) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Accès refusé : utilisateur non authentifié' });
    }
    // Recharge l'employé depuis la DB pour vérifier le rôle à jour (un rôle modifié
    // ou un compte supprimé ne doivent pas conserver leurs anciennes permissions).
    try {
      const dbUser = await Employee.findByPk(req.user.id);
      if (!dbUser) {
        return res.status(401).json({ message: 'Compte introuvable' });
      }
      if (!allowedRoles.includes(dbUser.role)) {
        return res.status(403).json({ message: 'Accès refusé : rôle insuffisant' });
      }
      req.user.role = dbUser.role;
      next();
    } catch (err) {
      return res.status(500).json({ message: 'Erreur de vérification des permissions' });
    }
  };
};
