/**
 * Valeurs partagées : rôles, statuts métier.
 * Sources de vérité uniques pour routes, contrôleurs et services.
 */

// Rôles
const CHIEF_ROLES = ['logistics_chief', 'admin', 'superadmin'];
const ALL_ROLES = ['employee', ...CHIEF_ROLES];
// Rôles attribuables à la création d'un compte (pas de superadmin via import/register classique)
const ASSIGNABLE_ROLES = ['employee', 'logistics_chief', 'admin'];

// Demandes de transport
const ACTIVE_REQUEST_STATUSES = ['pending', 'approved', 'rescheduled'];
const REQUEST_STATUSES = [...ACTIVE_REQUEST_STATUSES, 'rejected', 'cancelled'];

// Sorties
const SORTIE_STATUSES = ['planned', 'ongoing', 'pending_return', 'finished'];

// Véhicules
const VEHICLE_STATUSES = ['available', 'busy', 'maintenance', 'broken'];

module.exports = {
  CHIEF_ROLES,
  ALL_ROLES,
  ASSIGNABLE_ROLES,
  ACTIVE_REQUEST_STATUSES,
  REQUEST_STATUSES,
  SORTIE_STATUSES,
  VEHICLE_STATUSES,
};
