/**
 * Enrobe un contrôleur async : toute rejection est transmise au
 * middleware d'erreurs global de server.js (réponse 500 générique).
 */
module.exports = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
