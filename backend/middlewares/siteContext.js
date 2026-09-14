/**
 * Isolation multi-sites.
 *
 * Source de vérité : l'utilisateur authentifié (req.user.site_id, posé par le
 * JWT). Le site du client n'est JAMAIS accepté pour un non-superadmin.
 *
 *  - Superadmin : vision globale (null) OU filtre explicite `?site=<id>` —
 *    le SEUL cas où un paramètre client est utilisé.
 *  - Tous les autres rôles : TOUJOURS leur propre site, quel que soit
 *    `?site`, `body.siteId` ou `params.siteId`.
 *
 * `scopeWhere(req)` et `requireSiteAccess(req, siteId)` sont utilisés par tous
 * les contrôleurs pour restreindre les requêtes et rejeter les accès
 * inter-sites (403).
 */

// Site autorisé pour la requête (null = global / tous les sites).
function getResolvedSiteId(req) {
  const role = req.user?.role;
  if (role === 'superadmin') {
    if (req.query?.site != null) {
      const id = parseInt(req.query.site, 10);
      if (Number.isInteger(id) && id > 0) return id;
    }
    return null;
  }
  return req.user?.site_id ?? null;
}

// Fragment `where` à ajouter aux requêtes Sequelize. {} = aucun filtre.
function scopeWhere(req) {
  const siteId = getResolvedSiteId(req);
  return siteId == null ? {} : { site_id: siteId };
}

// Vérifie qu'une ressource appartient au site autorisé.
// Superadmin (global) : jamais bloqué. Sinon mismatch => 403.
function requireSiteAccess(req, siteId, options = {}) {
  const allowed = getResolvedSiteId(req);
  if (allowed == null) return true;
  if (siteId == null || siteId !== allowed) {
    const err = new Error(options.message || 'Action non autorisée : ressource d\'un autre site');
    err.status = 403;
    throw err;
  }
  return true;
}

// Site imposé à la CRÉATION.
// - Superadmin : peut choisir le site cible via `body.siteId` (provisioning
//   d'un nouveau site) ; défaut = son propre site.
// - Tous les autres rôles : TOUJOURS leur propre site (le `siteId` éventuel
//   du client est ignoré — sécurité).
function enforceCreationSite(req, ignored = req.body?.siteId) {
  if (req.user?.role === 'superadmin' && req.body?.siteId != null) {
    const id = parseInt(req.body.siteId, 10);
    if (Number.isInteger(id) && id > 0) return id;
  }
  return req.user?.site_id ?? null;
}

module.exports = { getResolvedSiteId, scopeWhere, requireSiteAccess, enforceCreationSite };