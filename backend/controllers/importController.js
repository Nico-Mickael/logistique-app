const bcrypt = require('bcrypt');
const { parse: csvParse } = require('csv-parse/sync');
const XLSX = require('xlsx');
const { Employee, Vehicle } = require('../models');
const { ASSIGNABLE_ROLES, VEHICLE_STATUSES, BCRYPT_ROUNDS } = require('../utils/constants');

// ── Field definitions per entity ──
const entities = {
  employees: {
    fields: [
      { key: 'nom',        label: 'Nom',       required: true,  suggestions: ['nom', 'name', 'lastname', 'last_name', 'nom_famille', 'family_name'] },
      { key: 'prenom',     label: 'Prénom',    required: true,  suggestions: ['prenom', 'prenoms', 'firstname', 'first_name', 'given_name', 'prénom', 'prénoms'] },
      { key: 'email',      label: 'Email',     required: true,  suggestions: ['email', 'mail', 'e_mail', 'courriel', 'adresse_email'] },
      { key: 'password',   label: 'Mot de passe', required: true, suggestions: ['password', 'pass', 'mot_de_passe', 'mdp', 'pwd'] },
      { key: 'department', label: 'Département', required: false, suggestions: ['department', 'departement', 'dept', 'service', 'direction', 'département'] },
      { key: 'role',       label: 'Rôle',        required: false, suggestions: ['role', 'rôle', 'fonction', 'grade', 'level'] },
    ],
    autoDetect(rows) { return rows.some(r => r.nom || r.Name || r.name); },
  },
  vehicles: {
    fields: [
      { key: 'type',     label: 'Type',       required: true,  suggestions: ['type', 'vehicule', 'véhicule', 'vehicle', 'catégorie', 'categorie', 'genre'] },
      { key: 'capacity', label: 'Capacité',   required: true,  suggestions: ['capacity', 'capacite', 'capacité', 'places', 'seats', 'nb_places', 'nbpersonnes'] },
      { key: 'status',   label: 'Statut',     required: false, suggestions: ['status', 'statut', 'etat', 'état', 'disponibilite', 'disponibilité'] },
    ],
    autoDetect(rows) { return rows.some(r => r.type || r.Type); },
  },
};

// ── Parse file (CSV or XLSX) ──
function parseFile(buffer, filename) {
  if (filename.toLowerCase().endsWith('.csv')) {
    const csv = buffer.toString('utf-8');
    return csvParse(csv, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    });
  }
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws);
}

// ── Clean keys (normalize accented chars, lowercase, trim) ──
function normalizeKey(k) {
  return k.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[\s_-]+/g, '_').trim();
}

// ── Score how well a column name matches a field ──
function scoreColumn(col, suggestions) {
  const n = normalizeKey(col);
  let best = 0;
  for (const s of suggestions) {
    const ns = normalizeKey(s);
    if (n === ns) return 1;
    if (n.includes(ns) || ns.includes(n)) best = Math.max(best, 0.8);
    const a = n.slice(0, 3);
    const b = ns.slice(0, 3);
    if (a === b && a.length >= 3) best = Math.max(best, 0.6);
  }
  return best;
}

// ── Auto-detect entity type from column names ──
function detectEntityType(columns) {
  let bestEntity = 'employees';
  let bestScore = 0;
  for (const [entityKey, entityDef] of Object.entries(entities)) {
    let score = 0;
    for (const col of columns) {
      for (const field of entityDef.fields) {
        score += scoreColumn(col, field.suggestions);
      }
    }
    if (score > bestScore) { bestScore = score; bestEntity = entityKey; }
  }
  return bestEntity;
}

// ── Build mapping from file columns → field keys ──
function buildMapping(columns, entityDef) {
  const mapping = {};
  const usedCols = new Set();
  for (const field of entityDef.fields) {
    let bestCol = null;
    let bestScore = 0;
    for (const col of columns) {
      if (usedCols.has(col)) continue;
      const score = scoreColumn(col, field.suggestions);
      if (score > bestScore) { bestScore = score; bestCol = col; }
    }
    if (bestCol && bestScore >= 0.6) {
      mapping[field.key] = bestCol;
      usedCols.add(bestCol);
    }
  }
  return mapping;
}

// ── Apply mapping to raw row ──
function applyMapping(row, mapping, entityDef) {
  const out = {};
  for (const field of entityDef.fields) {
    const col = mapping[field.key];
    if (col && row[col] !== undefined) {
      out[field.key] = String(row[col]).trim();
    }
  }
  return out;
}

function isPasswordError(err) {
  return Boolean(err?.message?.toLowerCase().includes('password'));
}

// Enrobe un handler d'import : les fichiers protégés par mot de passe
// renvoient un 400 explicite, le reste part vers le middleware d'erreurs.
const fileErrorHandler = (fn) => async (req, res, next) => {
  try {
    await fn(req, res);
  } catch (err) {
    if (isPasswordError(err)) {
      return res.status(400).json({ message: 'Le fichier est protégé par mot de passe. Veuillez le déprotéger et réessayer.' });
    }
    next(err);
  }
};

// ── Analyze file ──
exports.analyze = fileErrorHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Fichier requis' });
  console.log('[import] File received:', req.file.originalname, req.file.size, 'bytes');

  const rows = parseFile(req.file.buffer, req.file.originalname);
  console.log('[import] Rows parsed:', rows.length);
  if (rows.length === 0) return res.status(400).json({ message: 'Fichier vide' });

  const columns = Object.keys(rows[0]);
  const entityType = detectEntityType(columns);
  const entityDef = entities[entityType];
  const mapping = buildMapping(columns, entityDef);

  const preview = rows.slice(0, 20).map(r => applyMapping(r, mapping, entityDef));

  res.json({
    entity: entityType,
    entityLabel: entityType === 'employees' ? 'Utilisateurs' : 'Véhicules',
    columns,
    detected: columns.length,
    totalRows: rows.length,
    mapping: entityDef.fields.map(f => ({
      key: f.key,
      label: f.label,
      required: f.required,
      detectedColumn: mapping[f.key] || null,
      detected: !!mapping[f.key],
    })),
    preview,
    confidence: Object.keys(mapping).length / entityDef.fields.filter(f => f.required).length,
  });
});

// ── Import with confirmed mapping ──
exports.execute = fileErrorHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Fichier requis' });

  const { mapping: mappingInput, entity } = req.body;
  if (!mappingInput || !entity) return res.status(400).json({ message: 'Mapping et entité requis' });

  const entityDef = entities[entity];
  if (!entityDef) return res.status(400).json({ message: 'Entité inconnue' });

  const rows = parseFile(req.file.buffer, req.file.originalname);
  const parsedMapping = typeof mappingInput === 'string'
    ? (() => { try { return JSON.parse(mappingInput); } catch { return null; } })()
    : mappingInput;

  if (!parsedMapping) return res.status(400).json({ message: 'Mapping invalide' });

  const errors = [];
  const created = [];

  for (let i = 0; i < rows.length; i++) {
    const row = applyMapping(rows[i], parsedMapping, entityDef);
    const lineNum = i + 2;

    try {
      if (entity === 'employees') {
        const result = await importEmployee(row);
        if (result.error) { errors.push(`Ligne ${lineNum} : ${result.error}`); continue; }
        created.push(result.employee);
      } else if (entity === 'vehicles') {
        const result = await importVehicle(row);
        if (result.error) { errors.push(`Ligne ${lineNum} : ${result.error}`); continue; }
        created.push(result.vehicle);
      }
    } catch (err) {
      errors.push(`Ligne ${lineNum} : ${err.message}`);
    }
  }

  res.json({
    total: rows.length,
    imported: created.length,
    errors: errors.length,
    details: { created, errors },
  });
});

async function importEmployee(row) {
  const { nom, prenom, email, password, department, role } = row;

  if (!nom || !prenom || !email || !password) {
    return { error: 'nom, prénom, email et mot de passe obligatoires' };
  }

  const existing = await Employee.findOne({ where: { email } });
  if (existing) return { error: `${email} existe déjà` };

  const h = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const finalRole = ASSIGNABLE_ROLES.includes(role) ? role : 'employee';

  const e = await Employee.create({ nom, prenom, email, password: h, department, role: finalRole });
  return { employee: { email: e.email, nom: e.nom, prenom: e.prenom, role: e.role } };
}

async function importVehicle(row) {
  const type = (row.type || '').toLowerCase();
  const capacity = parseInt(row.capacity, 10);

  if (!type) return { error: 'type obligatoire' };
  if (!capacity || capacity < 1) return { error: 'capacité invalide' };

  const status = VEHICLE_STATUSES.includes(row.status) ? row.status : 'available';
  const v = await Vehicle.create({ type, capacity, status });
  return { vehicle: { type: v.type, capacity: v.capacity, status: v.status } };
}

// ── Templates ──
exports.templates = (req, res) => {
  res.json({
    employees: {
      columns: ['nom', 'prenom', 'email', 'password', 'department', 'role'],
      example: 'nom,prenom,email,password,department,role\nDupont,Jean,jean.dupont@example.com,password123,Logistique,employee',
      roles: ASSIGNABLE_ROLES,
    },
    vehicles: {
      columns: ['type', 'capacity', 'status'],
      example: 'type,capacity,status\nvoiture,5,available\nmoto,2,maintenance',
      types: ['voiture', 'moto', 'minibus', 'camion'],
      statuses: VEHICLE_STATUSES,
    },
  });
};
