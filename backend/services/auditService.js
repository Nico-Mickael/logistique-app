const { AuditLog } = require('../models');

/**
 * Enregistre une action d'audit.
 * @param {Object} params
 * @param {number|null} params.userId - ID de l'utilisateur (null si action système)
 * @param {string} params.action - Type d'action (create, update, delete, login, logout, etc.)
 * @param {string} params.entity - Entité concernée (Employee, Request, Sortie, Vehicle, etc.)
 * @param {number|null} params.entityId - ID de l'entité
 * @param {Object|null} params.oldValue - État avant modification
 * @param {Object|null} params.newValue - État après modification
 * @param {Object} params.req - Requête Express (pour IP + user_agent)
 */
async function logAudit({ userId = null, action, entity, entityId = null, oldValue = null, newValue = null, req = null }) {
  try {
    await AuditLog.create({
      user_id: userId,
      action,
      entity,
      entity_id: entityId,
      old_value: oldValue,
      new_value: newValue,
      ip_address: req ? (req.ip || req.connection?.remoteAddress || null) : null,
      user_agent: req ? (req.headers['user-agent'] || null) : null,
    });
  } catch (err) {
    console.error('Erreur audit log:', err.message);
  }
}

module.exports = { logAudit };
