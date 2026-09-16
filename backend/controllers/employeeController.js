const bcrypt = require('bcrypt');
const { Employee, Request, Notification, SortieRequest } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { ASSIGNABLE_ROLES, ALL_ROLES, BCRYPT_ROUNDS } = require('../utils/constants');
const { logAudit } = require('../services/auditService');
const { getResolvedSiteId, requireSiteAccess, enforceCreationSite } = require('../middlewares/siteContext');
const { bulkOnlineStatus } = require('../services/presenceService');
const availabilityService = require('../services/availabilityService');
const { AVAILABILITY_STATUSES, effectiveStatus, toDayStr } = availabilityService;

const BASE_ATTRIBUTES = [
  'id', 'nom', 'prenom', 'email', 'department', 'role', 'site_id',
  'availability_status', 'leave_start_date', 'leave_end_date', 'availability_updated_at',
  'createdAt', 'updatedAt',
];

// Enrichit un employé avec son statut de disponibilité EFFECTIF (retour de
// congé appliqué sans attendre la tâche d'écriture) + le dernier accès
// technique (last_seen, à titre indicatif uniquement — jamais pour l'assignation).
function enrichEmployee(employee, statuses) {
  const obj = employee.toJSON();
  obj.availability_status = effectiveStatus(employee);
  obj.last_seen = statuses[employee.id]?.last_seen || null;
  return obj;
}

exports.list = asyncHandler(async (req, res) => {
  const siteId = getResolvedSiteId(req);
  const employees = await Employee.findAll({
    where: siteId != null ? { site_id: siteId } : {},
    attributes: BASE_ATTRIBUTES,
    include: [{ association: 'Site', attributes: ['id', 'name', 'code'] }],
    order: [['createdAt', 'DESC']],
  });
  const statuses = await bulkOnlineStatus(employees.map((e) => e.id));
  res.json(employees.map((e) => enrichEmployee(e, statuses)));
});

// Liste des comptes ayant le rôle 'chauffeur' (pour l'affectation à une sortie).
// Triés par disponibilité d'abord (available en tête), puis par nom/prénom.
// L'état de connexion technique n'a AUCUN effet ici.
exports.listChauffeurs = asyncHandler(async (req, res) => {
  const siteId = getResolvedSiteId(req);
  const chauffeurs = await Employee.findAll({
    where: { role: 'chauffeur', ...(siteId != null ? { site_id: siteId } : {}) },
    attributes: BASE_ATTRIBUTES,
  });
  const statuses = await bulkOnlineStatus(chauffeurs.map((c) => c.id));
  const result = chauffeurs
    .map((c) => enrichEmployee(c, statuses))
    .sort((a, b) =>
      (a.availability_status !== 'available') - (b.availability_status !== 'available')
      || a.nom.localeCompare(b.nom)
      || a.prenom.localeCompare(b.prenom));
  res.json(result);
});

exports.create = asyncHandler(async (req, res) => {
  const { nom, prenom, email, password, department, role } = req.body;

  if (!nom || !prenom || !email || !password) {
    return res.status(400).json({ message: 'Champs obligatoires : nom, prenom, email, password' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ message: 'Format d\'email invalide' });
  }
  if (password.length < 4) {
    return res.status(400).json({ message: 'Le mot de passe doit contenir au moins 4 caractères' });
  }

  const existing = await Employee.findOne({ where: { email } });
  if (existing) return res.status(400).json({ message: 'Cet email est déjà utilisé' });

  const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const finalRole = ASSIGNABLE_ROLES.includes(role) ? role : 'employee';

  const employee = await Employee.create({
    nom, prenom, email,
    password: hashedPassword,
    department,
    role: finalRole,
    site_id: enforceCreationSite(req),
  });

  await logAudit({ userId: req.user.id, action: 'create', entity: 'Employee', entityId: employee.id, newValue: { nom, prenom, email, department, role: finalRole }, req });

  res.status(201).json({
    id: employee.id,
    nom: employee.nom,
    prenom: employee.prenom,
    email: employee.email,
    department: employee.department,
    role: employee.role,
  });
});

exports.update = asyncHandler(async (req, res) => {
  const { nom, prenom, email, department, role, password, availability_status, leave_start_date, leave_end_date } = req.body;
  const employee = await Employee.findByPk(req.params.id);

  if (!employee) return res.status(404).json({ message: 'Utilisateur introuvable' });
  requireSiteAccess(req, employee.site_id);

  const oldData = { nom: employee.nom, prenom: employee.prenom, email: employee.email, department: employee.department, role: employee.role, availability_status: employee.availability_status };

  if (email && email !== employee.email) {
    const existing = await Employee.findOne({ where: { email } });
    if (existing) return res.status(400).json({ message: 'Cet email est déjà utilisé' });
  }

  if (nom !== undefined) employee.nom = nom;
  if (prenom !== undefined) employee.prenom = prenom;
  if (email !== undefined) employee.email = email;
  if (department !== undefined) employee.department = department;
  if (role !== undefined) {
    if (!ALL_ROLES.includes(role)) return res.status(400).json({ message: 'Rôle invalide' });
    employee.role = role;
  }
  if (password) {
    if (password.length < 4) return res.status(400).json({ message: 'Le mot de passe doit contenir au moins 4 caractères' });
    employee.password = await bcrypt.hash(password, BCRYPT_ROUNDS);
  }

  // Disponibilité (supervision par un chef/administrateur) — mêmes règles que
  // l'auto-déclaration : un congé impose les dates, sinon elles sont vidées.
  if (availability_status !== undefined) {
    if (!AVAILABILITY_STATUSES.includes(availability_status)) {
      return res.status(400).json({ message: 'Statut de disponibilité invalide' });
    }
    let start = null;
    let end = null;
    if (availability_status === 'on_leave') {
      start = toDayStr(leave_start_date);
      end = toDayStr(leave_end_date);
      if (!start || !end) {
        return res.status(400).json({ message: 'Un congé nécessite une date de début et une date de retour' });
      }
      if (end < start) {
        return res.status(400).json({ message: 'La date de retour doit être le jour même ou après la date de début' });
      }
    }
    employee.availability_status = availability_status;
    employee.leave_start_date = start;
    employee.leave_end_date = end;
    employee.availability_updated_at = new Date();
  }

  await employee.save();

  await logAudit({ userId: req.user.id, action: 'update', entity: 'Employee', entityId: employee.id, oldValue: oldData, newValue: { nom: employee.nom, prenom: employee.prenom, email: employee.email, department: employee.department, role: employee.role, availability_status: effectiveStatus(employee) }, req });

  res.json({
    id: employee.id,
    nom: employee.nom,
    prenom: employee.prenom,
    email: employee.email,
    department: employee.department,
    role: employee.role,
    availability_status: effectiveStatus(employee),
    leave_start_date: employee.leave_start_date || null,
    leave_end_date: employee.leave_end_date || null,
  });
});

exports.remove = asyncHandler(async (req, res) => {
  const employee = await Employee.findByPk(req.params.id);
  if (!employee) return res.status(404).json({ message: 'Utilisateur introuvable' });
  requireSiteAccess(req, employee.site_id);

  const requests = await Request.findAll({ where: { employee_id: req.params.id }, attributes: ['id'] });
  const requestIds = requests.map((r) => r.id);

  if (requestIds.length > 0) {
    await SortieRequest.destroy({ where: { request_id: requestIds } });
  }
  await Request.destroy({ where: { employee_id: req.params.id } });
  await Notification.destroy({ where: { user_id: req.params.id } });

  await logAudit({ userId: req.user.id, action: 'delete', entity: 'Employee', entityId: employee.id, oldValue: { nom: employee.nom, prenom: employee.prenom, email: employee.email, role: employee.role }, req });

  await employee.destroy();

  res.json({ message: 'Utilisateur supprimé' });
});
