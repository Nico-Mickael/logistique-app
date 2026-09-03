/**
 * Valeurs partagées : rôles, statuts métier.
 * Sources de vérité uniques pour routes, contrôleurs et services.
 */

// Rôles "chef" (accès aux modules logistique : demandes, sorties, véhicules, stats)
const CHIEF_ROLES = ['logistics_chief', 'admin', 'superadmin'];
const ALL_ROLES = ['employee', 'chauffeur', ...CHIEF_ROLES];
// Rôles attribuables à la création d'un compte
// (pas de superadmin via import/register classique ; 'admin' est un chef de niveau intermédiaire)
const ASSIGNABLE_ROLES = ['employee', 'chauffeur', 'logistics_chief', 'admin'];

// Demandes de transport
const ACTIVE_REQUEST_STATUSES = ['pending', 'approved', 'rescheduled'];
const REQUEST_STATUSES = ['pending', 'approved', 'rejected', 'rescheduled', 'cancelled'];

// Sorties
const SORTIE_STATUSES = ['planned', 'ongoing', 'pending_return', 'finished'];
// Statuts de demande pouvant être rattachés à une sortie
const ASSIGNABLE_TO_SORTIE_STATUSES = ['pending', 'approved'];

// Véhicules
const VEHICLE_STATUSES = ['available', 'busy', 'maintenance', 'broken'];

// Maintenances
const MAINTENANCE_STATUSES = ['planned', 'done'];

// Divers
const BCRYPT_ROUNDS = 10;
const MAINTENANCE_HORIZON_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours (horizon maintenances à prévoir)

module.exports = {
  CHIEF_ROLES,
  ALL_ROLES,
  ASSIGNABLE_ROLES,
  ACTIVE_REQUEST_STATUSES,
  REQUEST_STATUSES,
  ASSIGNABLE_TO_SORTIE_STATUSES,
  SORTIE_STATUSES,
  VEHICLE_STATUSES,
  MAINTENANCE_STATUSES,
  BCRYPT_ROUNDS,
  MAINTENANCE_HORIZON_MS,
};
