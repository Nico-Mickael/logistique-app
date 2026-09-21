const bcrypt = require('bcrypt');
const XLSX = require('xlsx');
const { Employee, Request, Notification, SortieRequest, ConversationMember, MessageRead, Site } = require('../models');
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

// --- Import Excel/CSV des utilisateurs -------------------------------------
// Les en-têtes des colonnes sont reconnus automatiquement (accents, casse,
// espaces et séparateurs ignorés), avec plusieurs synonymes par champ.
const IMPORT_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const IMPORT_HEADER_ALIASES = {
  nom: ['nom', 'nomdefamille', 'lastname', 'last name', 'name'],
  prenom: ['prenom', 'prenoms', 'firstname', 'first name'],
  email: ['email', 'mail', 'adresseemail', 'courriel', 'e-mail'],
  password: ['motdepasse', 'password', 'mdp', 'pass'],
  department: ['departement', 'department', 'service', 'direction'],
  role: ['role', 'fonction', 'profil', 'statut'],
  site: ['site', 'code', 'codesite', 'nomsite', 'agence'],
};
const IMPORT_ROLE_ALIASES = {
  employe: 'employee', employee: 'employee',
  chauffeur: 'chauffeur', driver: 'chauffeur',
  admin: 'logistics_chief', administrateur: 'logistics_chief',
  logisticschief: 'logistics_chief', chef: 'logistics_chief',
  superadmin: 'superadmin',
};

function normalizeKey(value) {
  return String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Associe chaque champ attendu à la colonne réelle de la ligne (auto-détection).
function mapImportRow(row) {
  const map = {};
  Object.keys(row).forEach((key) => {
    const normalized = normalizeKey(key);
    for (const [field, aliases] of Object.entries(IMPORT_HEADER_ALIASES)) {
      if (!map[field] && aliases.some((alias) => normalizeKey(alias) === normalized)) {
        map[field] = key;
      }
    }
  });
  return map;
}

function normalizeImportRole(value) {
  return IMPORT_ROLE_ALIASES[normalizeKey(value)] || 'employee';
}

exports.importUsers = asyncHandler(async (req, res) => {
  if (!req.file || !req.file.buffer) {
    return res.status(400).json({ message: 'Aucun fichier fourni' });
  }

  let rows;
  try {
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
  } catch {
    return res.status(400).json({ message: 'Fichier illisible (formats acceptés : .xlsx, .xls, .csv)' });
  }

  if (!rows.length) {
    return res.status(400).json({ message: 'Le fichier ne contient aucune ligne de données' });
  }

  const defaultPassword = String(req.body?.defaultPassword || '').trim() || 'Ades';
  if (defaultPassword.length < 4) {
    return res.status(400).json({ message: 'Le mot de passe par défaut doit contenir au moins 4 caractères' });
  }

  // Résolution des sites par code ou par nom (uniquement pour le superadmin,
  // seul rôle autorisé sur cette route).
  const sites = await Site.findAll({ attributes: ['id', 'name', 'code'] });
  const siteByKey = new Map();
  sites.forEach((site) => {
    siteByKey.set(normalizeKey(site.name), site.id);
    if (site.code) siteByKey.set(normalizeKey(site.code), site.id);
  });

  const forcedSite = enforceCreationSite(req);
  const existingEmails = new Set(
    (await Employee.findAll({ attributes: ['email'] })).map((e) => (e.email || '').toLowerCase())
  );
  const seenEmails = new Set();
  const defaultHash = await bcrypt.hash(defaultPassword, BCRYPT_ROUNDS);

  const errors = [];
  let imported = 0;

  for (let i = 0; i < rows.length; i += 1) {
    const rowNumber = i + 2; // ligne 1 = en-tête
    const map = mapImportRow(rows[i]);
    const value = (field) => (map[field] != null ? String(rows[i][map[field]]).trim() : '');

    const nom = value('nom');
    const prenom = value('prenom');
    const email = value('email').toLowerCase();
    const department = value('department');
    const role = normalizeImportRole(value('role'));
    const rowPassword = value('password');

    if (!nom || !prenom || !email) {
      errors.push({ row: rowNumber, email, message: 'Nom, prénom et email sont obligatoires' });
      continue;
    }
    if (!IMPORT_EMAIL_RE.test(email)) {
      errors.push({ row: rowNumber, email, message: 'Format d\'email invalide' });
      continue;
    }
    if (existingEmails.has(email) || seenEmails.has(email)) {
      errors.push({ row: rowNumber, email, message: 'Cet email est déjà utilisé' });
      continue;
    }
    const password = rowPassword || defaultPassword;
    if (password.length < 4) {
      errors.push({ row: rowNumber, email, message: 'Le mot de passe doit contenir au moins 4 caractères' });
      continue;
    }

    const siteKey = value('site');
    const siteId = (siteKey && siteByKey.get(normalizeKey(siteKey))) || forcedSite;

    try {
      const employee = await Employee.create({
        nom,
        prenom,
        email,
        password: rowPassword ? await bcrypt.hash(rowPassword, BCRYPT_ROUNDS) : defaultHash,
        department: department || null,
        role,
        site_id: siteId,
      });
      seenEmails.add(email);
      imported += 1;
      await logAudit({ userId: req.user.id, action: 'create', entity: 'Employee', entityId: employee.id, newValue: { nom, prenom, email, department, role, import: true }, req });
    } catch {
      errors.push({ row: rowNumber, email, message: 'Erreur lors de la création' });
    }
  }

  res.status(201).json({
    total: rows.length,
    imported,
    failed: errors.length,
    defaultPassword,
    errors,
  });
});

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
  const { nom, prenom, email, department, role, password, siteId, availability_status, leave_start_date, leave_end_date } = req.body;
  const employee = await Employee.findByPk(req.params.id);

  if (!employee) return res.status(404).json({ message: 'Utilisateur introuvable' });
  requireSiteAccess(req, employee.site_id);

  const oldData = { nom: employee.nom, prenom: employee.prenom, email: employee.email, department: employee.department, role: employee.role, site_id: employee.site_id, availability_status: employee.availability_status };

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

  // Changement de site (superadmin uniquement — route déjà restreinte).
  // site_id est NOT NULL en base : un site valide est obligatoire.
  if (siteId !== undefined) {
    const parsedSiteId = parseInt(siteId, 10);
    if (!Number.isInteger(parsedSiteId) || parsedSiteId <= 0) {
      return res.status(400).json({ message: 'Site invalide' });
    }
    const siteExists = await Site.findByPk(parsedSiteId);
    if (!siteExists) return res.status(400).json({ message: 'Site introuvable' });
    employee.site_id = parsedSiteId;
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

  await logAudit({ userId: req.user.id, action: 'update', entity: 'Employee', entityId: employee.id, oldValue: oldData, newValue: { nom: employee.nom, prenom: employee.prenom, email: employee.email, department: employee.department, role: employee.role, site_id: employee.site_id, availability_status: effectiveStatus(employee) }, req });

  res.json({
    id: employee.id,
    nom: employee.nom,
    prenom: employee.prenom,
    email: employee.email,
    department: employee.department,
    role: employee.role,
    site_id: employee.site_id,
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
  // Messagerie : le compte n'est plus membre ni marqueur de lecture ; ses
  // messages restent conservés pour l'historique des conversations.
  await ConversationMember.destroy({ where: { user_id: req.params.id } });
  await MessageRead.destroy({ where: { user_id: req.params.id } });

  await logAudit({ userId: req.user.id, action: 'delete', entity: 'Employee', entityId: employee.id, oldValue: { nom: employee.nom, prenom: employee.prenom, email: employee.email, role: employee.role }, req });

  await employee.destroy();

  res.json({ message: 'Utilisateur supprimé' });
});
