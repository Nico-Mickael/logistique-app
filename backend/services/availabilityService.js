const { Op } = require('sequelize');

// Statuts de disponibilité professionnelle (séparés de l'état de connexion).
//  - available  : le chauffeur peut être assigné à une sortie
//  - offline    : indisponible tant qu'il ne l'a pas modifié manuellement
//  - on_leave   : congé/absence planifiée (bornée par leave_start/end_date)
//  - absent     : absence sans date de retour fixée
const AVAILABILITY_STATUSES = ['available', 'offline', 'on_leave', 'absent'];

function defaultDeps() {
  const { Employee } = require('../models');
  return { models: { Employee } };
}

let _deps = null;
function getDeps() {
  if (!_deps) _deps = defaultDeps();
  return _deps;
}

function __setDeps(deps) { _deps = deps; }
function __resetDeps() { _deps = null; }

// Normalise une date en 'YYYY-MM-DD' (heure locale) pour des comparaisons de
// jours sans piège de fuseau horaire. Renvoie null si non interprétable.
function toDayStr(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (value == null || value === '') return null;
  const s = String(value);
  if (s.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return null;
}

/**
 * Statut de disponibilité EFFECTIF d'un employé à une date donnée.
 * Un congé dont la période commence dans le futur ne rend pas encore
 * indisponible ; dès que le jour courant ≥ leave_end_date (retour), le
 * statut redevient 'available' — sans attendre de tâche d'écriture.
 */
function effectiveStatus(employee, now = new Date()) {
  if (!employee) return 'available';
  const status = employee.availability_status || 'available';
  if (status !== 'on_leave') return status;

  const today = toDayStr(now);
  const start = toDayStr(employee.leave_start_date);
  const end = toDayStr(employee.leave_end_date);

  if (start && today < start) return 'available'; // congé pas encore commencé
  if (end && today >= end) return 'available';    // jour de retour
  return 'on_leave';
}

/**
 * Un chauffeur est assignable uniquement s'il est 'available'.
 * L'état de connexion technique ne joue aucun rôle ici.
 */
function isAssignable(employee, now = new Date()) {
  return effectiveStatus(employee, now) === 'available';
}

/**
 * Persiste en base le retour automatique de congé : tous les employés en
 * 'on_leave' dont le leave_end_date est passé repassent à 'available' et
 * voient leurs dates vidées. Une modification manuelle du statut entretemps
 * (ex. 'offline') ne sera pas écrasée car la requête cible 'on_leave'.
 */
async function autoRevertLeaves(now = new Date()) {
  const { Employee } = getDeps().models;
  if (!Employee) return 0;
  const today = toDayStr(now);
  if (!today) return 0;

  const [affected] = await Employee.update(
    {
      availability_status: 'available',
      leave_start_date: null,
      leave_end_date: null,
      availability_updated_at: today ? new Date(`${today}T00:00:00`) : new Date(),
    },
    {
      where: {
        availability_status: 'on_leave',
        leave_end_date: { [Op.ne]: null, [Op.lte]: today },
      },
    }
  );
  return affected;
}

module.exports = {
  AVAILABILITY_STATUSES,
  effectiveStatus,
  isAssignable,
  autoRevertLeaves,
  toDayStr,
  __setDeps,
  __resetDeps,
};