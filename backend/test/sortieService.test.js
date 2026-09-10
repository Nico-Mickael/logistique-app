'use strict';
const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { Op } = require('sequelize');

const sortieService = require('../services/sortieService');
const COMPAT_WINDOW_MS = sortieService.COMPAT_WINDOW_MS;

// ---------------------------------------------------------------------------
// Implémentation en mémoire des modèles Sequelize (seulement ce dont le
// service a besoin). Chaque méthode retourne des promesses comme le vrai ORM.
// Les instances persistantes exposent .save() pour muter la "ligne".
// ---------------------------------------------------------------------------
let db = { requests: [], vehicles: [], sorties: [], sortieRequests: [], employees: [] };

function eqValue(actual, cond) {
  if (cond === undefined) return true;
  if (cond === null) return actual === null;
  if (cond && typeof cond === 'object' && !(cond instanceof Date)) {
    if (cond[Op.iLike] !== undefined) {
      const pattern = cond[Op.iLike].replace(/%/g, '.*');
      return new RegExp(`^${pattern}$`, 'i').test(actual);
    }
    if (cond[Op.in] !== undefined) return cond[Op.in].includes(actual);
    if (cond[Op.notIn] !== undefined) return !cond[Op.notIn].includes(actual);
    if (cond[Op.ne] !== undefined) return actual !== cond[Op.ne];
    if (cond[Op.between] !== undefined) {
      const [a, b] = cond[Op.between];
      const v = new Date(actual).getTime();
      return v >= new Date(a).getTime() && v <= new Date(b).getTime();
    }
    return true;
  }
  return actual === cond;
}

function matchFilter(row, where) {
  if (!where) return true;
  return Object.entries(where).every(([key, cond]) => eqValue(row[key], cond));
}

function saveable(obj, table) {
  if (!obj) return null;
  return {
    ...obj,
    async save() {
      const idx = db[table].findIndex((r) => r.id === obj.id);
      if (idx !== -1) db[table][idx] = { ...this };
      return this;
    },
    async destroy() {
      db[table] = db[table].filter((r) => r.id !== obj.id);
      return 1;
    },
  };
}

const fakeModels = {
  Request: {
    findAll: async ({ where, order } = {}) => {
      let rows = db.requests.filter((r) => matchFilter(r, where));
      if (order && order[0]) {
        const [field, dir] = order[0];
        rows = [...rows].sort((a, b) => {
          const d = new Date(a[field]) - new Date(b[field]);
          return dir === 'ASC' ? d : -d;
        });
      }
      return rows;
    },
    findByPk: async (id) => saveable(db.requests.find((r) => r.id === id), 'requests') || null,
  },
  SortieRequest: {
    findAll: async ({ where } = {}) => db.sortieRequests.filter((sr) => matchFilter(sr, where)),
    findOne: async ({ where } = {}) => saveable(db.sortieRequests.find((sr) => matchFilter(sr, where)), 'sortieRequests') || null,
    create: async (data) => {
      const row = { id: db.sortieRequests.length + 1, ...data };
      db.sortieRequests.push(row);
      return row;
    },
    count: async ({ where } = {}) => db.sortieRequests.filter((sr) => matchFilter(sr, where)).length,
    destroy: async ({ where } = {}) => {
      db.sortieRequests = db.sortieRequests.filter((sr) => !matchFilter(sr, where));
      return 1;
    },
  },
  Sortie: {
    findOne: async ({ where } = {}) => saveable(db.sorties.find((s) => matchFilter(s, where)), 'sorties') || null,
    findByPk: async (id) => saveable(db.sorties.find((s) => s.id === id), 'sorties') || null,
    create: async (data) => {
      const row = { id: db.sorties.length + 1, ...data };
      db.sorties.push(row);
      return row;
    },
  },
  Employee: {
    findByPk: async (id) => db.employees.find((e) => e.id === id) || null,
  },
  Vehicle: {
    findByPk: async (id) => saveable(db.vehicles.find((v) => v.id === id), 'vehicles') || null,
  },
};

const notifyCalls = [];
const fakeNotify = (...args) => notifyCalls.push(args);
const releaseCalls = [];
const fakeReleaseIfIdle = async (id) => releaseCalls.push(id);

beforeEach(() => {
  db = { requests: [], vehicles: [], sorties: [], sortieRequests: [], employees: [] };
  notifyCalls.length = 0;
  releaseCalls.length = 0;
  sortieService.__setDeps({ models: fakeModels, notifyChiefs: fakeNotify, releaseIfIdle: fakeReleaseIfIdle });
});

afterEach(() => {
  sortieService.__resetDeps();
});

// ---------------------------------------------------------------------------
// findCompatibleRequests
// ---------------------------------------------------------------------------
test('findCompatibleRequests : filtre par destination, statut et fenêtre horaire', async () => {
  const base = new Date('2026-09-05T10:00:00').getTime();
  db.requests = [
    { id: 1, destination: 'Antananarivo', status: 'pending', date_souhaitee: new Date(base), nb_personnes: 2 },
    // même destination mais hors fenêtre (différence > 30 min)
    { id: 2, destination: 'Antananarivo', status: 'pending', date_souhaitee: new Date(base + 61 * 60 * 1000), nb_personnes: 2 },
    // destination différente
    { id: 3, destination: 'Mahajanga', status: 'pending', date_souhaitee: new Date(base), nb_personnes: 2 },
    // mauvais statut
    { id: 4, destination: 'Antananarivo', status: 'rejected', date_souhaitee: new Date(base), nb_personnes: 2 },
    // dans la fenêtre (autre casse)
    { id: 5, destination: 'antananarivo', status: 'approved', date_souhaitee: new Date(base + 10 * 60 * 1000), nb_personnes: 1 },
  ];

  const result = await sortieService.findCompatibleRequests(99, 'Antananarivo', 10, new Date(base));
  const ids = result.map((r) => r.id).sort((a, b) => a - b);
  assert.deepStrictEqual(ids, [1, 5], 'ne garde que destination + fenêtre + statut compatibles');
});

test('findCompatibleRequests : respecte la capacité restante du véhicule', async () => {
  const base = new Date('2026-09-05T10:00:00').getTime();
  db.requests = [
    { id: 1, destination: 'Antsirabe', status: 'pending', date_souhaitee: new Date(base), nb_personnes: 6 },
    { id: 2, destination: 'Antsirabe', status: 'pending', date_souhaitee: new Date(base + 5 * 60 * 1000), nb_personnes: 5 },
    { id: 3, destination: 'Antsirabe', status: 'pending', date_souhaitee: new Date(base + 7 * 60 * 1000), nb_personnes: 3 },
  ];
  // demande 1 déjà liée à la sortie 99 -> occupe 6 places
  db.sortieRequests = [{ sortie_id: 99, request_id: 1 }];

  // capacité 10, occupé 6 -> reste 4 : demande 2 (5) exclue, demande 3 (3) acceptée
  const result = await sortieService.findCompatibleRequests(99, 'Antsirabe', 10, new Date(base));
  const ids = result.map((r) => r.id).sort((a, b) => a - b);
  assert.deepStrictEqual(ids, [3], 'propose uniquement les demandes pouvant tenir dans la capacité restante');
});

test('findCompatibleRequests : exclut les demandes déjà liées à une autre sortie', async () => {
  const base = new Date('2026-09-05T10:00:00').getTime();
  db.requests = [
    { id: 10, destination: 'Fianarantsoa', status: 'approved', date_souhaitee: new Date(base), nb_personnes: 2 },
    { id: 11, destination: 'Fianarantsoa', status: 'approved', date_souhaitee: new Date(base), nb_personnes: 2 },
  ];
  // la demande 10 est déjà liée à une autre sortie (5)
  db.sortieRequests = [{ sortie_id: 5, request_id: 10 }];

  const result = await sortieService.findCompatibleRequests(99, 'Fianarantsoa', 4, new Date(base));
  const ids = result.map((r) => r.id);
  assert.deepStrictEqual(ids, [11], 'la demande liée ailleurs ne doit pas réapparaître');
});

// ---------------------------------------------------------------------------
// autoCreateSortie
// ---------------------------------------------------------------------------
test('autoCreateSortie : ne fait rien sans véhicule', async () => {
  await sortieService.autoCreateSortie({ id: 1, date_souhaitee: new Date(), destination: 'X', nb_personnes: 1, vehicle_id: null });
  assert.strictEqual(db.sorties.length, 0);
  assert.strictEqual(db.sortieRequests.length, 0);
});

test('autoCreateSortie : crée une sortie pour une demande approuvée avec véhicule disponible', async () => {
  db.employees = [{ id: 5, nom: 'Doe', prenom: 'Jean' }];
  db.vehicles = [{ id: 1, capacity: 10, status: 'available', type: 'voiture' }];

  await sortieService.autoCreateSortie({
    id: 42, employee_id: 5, vehicle_id: 1, destination: 'Morondava',
    motif: 'Mission service',
    date_souhaitee: new Date('2026-09-06T09:00:00'), nb_personnes: 3,
  });

  assert.strictEqual(db.sorties.length, 1, 'une sortie doit être créée');
  assert.strictEqual(db.sorties[0].status, 'planned');
  assert.strictEqual(db.sorties[0].destination, 'Morondava');
  assert.strictEqual(db.sorties[0].motif, 'Mission service', 'la sortie conserve le motif de la demande');
  assert.strictEqual(db.vehicles[0].status, 'busy', 'le véhicule devient occupé');
  assert.strictEqual(db.sortieRequests.length, 1);
  assert.strictEqual(db.sortieRequests[0].request_id, 42);
  assert.strictEqual(notifyCalls.length, 1);
  assert.strictEqual(notifyCalls[0][0], 'sortie_created');
});

test('autoCreateSortie : réutilise une sortie planifiée compatible (regroupement)', async () => {
  db.vehicles = [{ id: 1, capacity: 10, status: 'busy', type: 'voiture' }];
  db.requests = [
    { id: 1, nb_personnes: 2, destination: 'Toliara', status: 'approved' },
    { id: 2, nb_personnes: 3, destination: 'Toliara', status: 'approved', date_souhaitee: new Date('2026-09-07T09:10:00') },
  ];
  db.sorties = [{
    id: 100, vehicle_id: 1, status: 'planned', destination: 'Toliara',
    departure_time: new Date('2026-09-07T09:00:00'),
  }];
  db.sortieRequests = [{ sortie_id: 100, request_id: 1 }];

  await sortieService.autoCreateSortie({
    id: 2, employee_id: 1, vehicle_id: 1, destination: 'Toliara',
    date_souhaitee: new Date('2026-09-07T09:10:00'), nb_personnes: 3,
  });

  assert.strictEqual(db.sorties.length, 1, 'aucune nouvelle sortie créée');
  assert.strictEqual(db.sortieRequests.length, 2, 'la demande est ajoutée à la sortie existante');
  assert.ok(db.sortieRequests.some((sr) => sr.sortie_id === 100 && sr.request_id === 2), 'lie la nouvelle demande');
});

test('autoCreateSortie : ne regroupe pas si la capacité est dépassée', async () => {
  db.vehicles = [{ id: 1, capacity: 5, status: 'busy', type: 'voiture' }];
  db.requests = [
    { id: 1, nb_personnes: 4, destination: 'Tamatave', status: 'approved' },
    { id: 2, nb_personnes: 3, destination: 'Tamatave', status: 'approved', date_souhaitee: new Date('2026-09-08T09:20:00') },
  ];
  db.sorties = [{
    id: 100, vehicle_id: 1, status: 'planned', destination: 'Tamatave',
    departure_time: new Date('2026-09-08T09:00:00'),
  }];
  db.sortieRequests = [{ sortie_id: 100, request_id: 1 }];

  await sortieService.autoCreateSortie({
    id: 2, employee_id: 1, vehicle_id: 1, destination: 'Tamatave',
    date_souhaitee: new Date('2026-09-08T09:20:00'), nb_personnes: 3,
  });

  // capacité 5 déjà occupée par 4 -> il ne reste que 1 place, la demande fait 3 -> refusé
  assert.strictEqual(db.sortieRequests.length, 1, 'la demande ne doit pas être liée (capacité insuffisante)');
});

test('autoCreateSortie : état véhicule "moto" renseigne le conducteur avec le nom de l\'employé', async () => {
  db.employees = [{ id: 5, nom: 'Andri', prenom: 'Rija' }];
  db.vehicles = [{ id: 2, capacity: 1, status: 'available', type: 'moto' }];

  await sortieService.autoCreateSortie({
    id: 7, employee_id: 5, vehicle_id: 2, destination: 'Centre',
    date_souhaitee: new Date('2026-09-09T10:00:00'), nb_personnes: 1,
  });

  assert.strictEqual(db.sorties.length, 1);
  assert.strictEqual(db.sorties[0].driver_name, 'Rija Andri');
});

// ---------------------------------------------------------------------------
// attachRequestToSortie — invariants du regroupement (aucune demande perdue)
// ---------------------------------------------------------------------------
function seedGroupable() {
  const base = new Date('2026-09-10T10:00:00').getTime();
  db.vehicles = [{ id: 1, capacity: 10, status: 'busy', type: 'voiture' }];
  db.sorties = [{
    id: 100, vehicle_id: 1, destination: 'Antananarivo', status: 'planned',
    departure_time: new Date(base), motif: 'Mission',
  }];
  db.requests = [
    { id: 1, employee_id: 7, destination: 'Antananarivo', motif: 'Réunion', date_souhaitee: new Date(base), nb_personnes: 2, status: 'approved', vehicle_id: 1 },
    { id: 2, employee_id: 8, destination: 'Antananarivo', motif: 'Achat fournisseur', date_souhaitee: new Date(base + 10 * 60 * 1000), nb_personnes: 1, status: 'pending', vehicle_id: null },
    { id: 3, employee_id: 9, destination: 'Antananarivo', motif: 'Livraison', date_souhaitee: new Date(base - 15 * 60 * 1000), nb_personnes: 3, status: 'approved', vehicle_id: 1 },
    { id: 4, employee_id: 10, destination: 'Mahajanga', motif: 'Autre', date_souhaitee: new Date(base), nb_personnes: 2, status: 'pending', vehicle_id: null },
    { id: 5, employee_id: 11, destination: 'Antananarivo', motif: 'Formation', date_souhaitee: new Date(base + 3 * 60 * 1000), nb_personnes: 2, status: 'pending', vehicle_id: null },
  ];
}

test('attachRequestToSortie : ajoute une demande compatible et conserve id, employé, motif, statut', async () => {
  seedGroupable();

  const result = await sortieService.attachRequestToSortie({ sortieId: 100, requestId: 2 });

  assert.strictEqual(result.status, 'added');
  assert.strictEqual(result.request.id, 2, 'la demande garde son propre id');
  assert.strictEqual(result.request.employee_id, 8, 'la demande garde son utilisateur');
  assert.strictEqual(result.request.motif, 'Achat fournisseur', 'la demande garde son motif');
  assert.strictEqual(result.request.status, 'approved', 'statut passé à approved');
  assert.strictEqual(db.requests.find((r) => r.id === 2).status, 'approved');

  const links = db.sortieRequests.filter((sr) => sr.request_id === 2);
  assert.strictEqual(links.length, 1, 'la demande est liée à la sortie (et une seule)');
  assert.strictEqual(links[0].sortie_id, 100);
  assert.strictEqual(links[0].status, 'pending');
});

test('attachRequestToSortie : plusieurs demandes compatibles restent toutes traçables (aucune perte)', async () => {
  seedGroupable();

  const added = [];
  for (const requestId of [2, 3, 5]) {
    const r = await sortieService.attachRequestToSortie({ sortieId: 100, requestId });
    assert.strictEqual(r.status, 'added');
    added.push(requestId);
  }

  assert.deepStrictEqual(added, [2, 3, 5], 'toutes les demandes compatibles sont ajoutées');
  const links = db.sortieRequests.filter((sr) => sr.sortie_id === 100);
  assert.strictEqual(links.length, 3, '3 liens existent, aucune demande écrasée');
  for (const requestId of [2, 3, 5]) {
    const req = db.requests.find((r) => r.id === requestId);
    assert.ok(req, `la demande ${requestId} existe toujours`);
    assert.strictEqual(req.status, 'approved', `la demande ${requestId} est validée`);
    assert.strictEqual(req.motif.length > 0, true, `la demande ${requestId} a conservé son motif`);
  }
});

test('attachRequestToSortie : déjà liée à cette sortie → already_linked (pas de doublon)', async () => {
  seedGroupable();
  db.sortieRequests = [{ id: 1, sortie_id: 100, request_id: 1, status: 'pending' }];
  db.requests[0].status = 'approved';

  const result = await sortieService.attachRequestToSortie({ sortieId: 100, requestId: 1 });

  assert.strictEqual(result.status, 'already_linked');
  assert.strictEqual(db.sortieRequests.filter((sr) => sr.request_id === 1).length, 1, 'un seul lien conservé');
});

test('attachRequestToSortie : refuse si la capacité du véhicule est dépassée', async () => {
  seedGroupable();
  db.vehicles = [{ id: 1, capacity: 3, status: 'busy', type: 'voiture' }];
  // demande 1 déjà dans la sortie (2 personnes) + demande 5 (2 personnes) > 3
  db.sortieRequests = [{ id: 1, sortie_id: 100, request_id: 1, status: 'pending' }];

  await assert.rejects(
    sortieService.attachRequestToSortie({ sortieId: 100, requestId: 5 }),
    (err) => err.status === 400
  );
  assert.strictEqual(db.sortieRequests.filter((sr) => sr.request_id === 5).length, 0, 'aucun lien créé');
});

test('attachRequestToSortie : refuse une destination différente de la sortie', async () => {
  seedGroupable();

  await assert.rejects(
    sortieService.attachRequestToSortie({ sortieId: 100, requestId: 4 }),
    (err) => err.status === 400 && /destination/i.test(err.message)
  );
  assert.strictEqual(db.sortieRequests.length, 0);
});

test('attachRequestToSortie : refuse de déplacer une demande déjà liée à une sortie en cours/terminée', async () => {
  seedGroupable();
  db.sorties.push({ id: 50, vehicle_id: 2, destination: 'Antananarivo', status: 'ongoing', departure_time: new Date('2026-09-10T10:00:00') });
  // la demande 5 est déjà dans la sortie en cours 50
  db.sortieRequests = [{ id: 1, sortie_id: 50, request_id: 5, status: 'ongoing' }];

  await assert.rejects(
    sortieService.attachRequestToSortie({ sortieId: 100, requestId: 5 }),
    (err) => err.status === 400
  );
  const still = db.sortieRequests.find((sr) => sr.request_id === 5);
  assert.strictEqual(still.sortie_id, 50, 'la demande reste sur sa sortie historique');
});

test('attachRequestToSortie : déplace une demande depuis une autre sortie planifiée (unicité du groupe)', async () => {
  seedGroupable();
  // la demande 2 était déjà planifiée sur la sortie 50 (seule demande)
  db.sorties.push({ id: 50, vehicle_id: 9, destination: 'Antananarivo', status: 'planned', departure_time: new Date('2026-09-10T10:05:00') });
  db.sortieRequests = [{ id: 1, sortie_id: 50, request_id: 2, status: 'pending' }];

  const result = await sortieService.attachRequestToSortie({ sortieId: 100, requestId: 2 });

  assert.strictEqual(result.status, 'added');
  const links = db.sortieRequests.filter((sr) => sr.request_id === 2);
  assert.strictEqual(links.length, 1, 'la demande n\'a plus qu\'un seul lien');
  assert.strictEqual(links[0].sortie_id, 100, 'le lien pointe vers la nouvelle sortie');
  assert.ok(!db.sorties.some((s) => s.id === 50), 'l\'ancienne sortie vidée est supprimée');
  assert.deepStrictEqual(releaseCalls, [9], 'le véhicule de l\'ancienne sortie est libéré');
  assert.ok(notifyCalls.some(([event, payload]) => event === 'sortie_updated' && payload.id === 50 && payload.deleted === true));
});

test('autoCreateSortie : le regroupement conserve les DEUX demandes (originale + nouvelle)', async () => {
  db.vehicles = [{ id: 1, capacity: 10, status: 'busy', type: 'voiture' }];
  db.requests = [
    { id: 1, nb_personnes: 2, destination: 'Toliara', status: 'approved', motif: 'A' },
    { id: 2, nb_personnes: 3, destination: 'Toliara', status: 'approved', motif: 'B', date_souhaitee: new Date('2026-09-07T09:10:00') },
  ];
  db.sorties = [{
    id: 100, vehicle_id: 1, status: 'planned', destination: 'Toliara',
    departure_time: new Date('2026-09-07T09:00:00'),
  }];
  db.sortieRequests = [{ sortie_id: 100, request_id: 1 }];

  await sortieService.autoCreateSortie({
    id: 2, employee_id: 1, vehicle_id: 1, destination: 'Toliara',
    date_souhaitee: new Date('2026-09-07T09:10:00'), nb_personnes: 3,
  });

  assert.strictEqual(db.sorties.length, 1, 'aucune nouvelle sortie créée');
  assert.strictEqual(db.sortieRequests.length, 2, 'les deux demandes restent liées (aucune perte)');
  assert.ok(db.sortieRequests.some((sr) => sr.sortie_id === 100 && sr.request_id === 1));
  assert.ok(db.sortieRequests.some((sr) => sr.sortie_id === 100 && sr.request_id === 2));
  assert.ok(db.requests.some((r) => r.id === 1 && r.motif === 'A'), 'la demande d\'origine existe toujours');
  assert.ok(db.requests.some((r) => r.id === 2 && r.motif === 'B'), 'la demande regroupée existe toujours');
});
