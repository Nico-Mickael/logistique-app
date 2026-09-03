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
  if (cond && typeof cond === 'object' && !(cond instanceof Date)) {
    if (cond[Op.iLike] !== undefined) {
      const pattern = cond[Op.iLike].replace(/%/g, '.*');
      return new RegExp(`^${pattern}$`, 'i').test(actual);
    }
    if (cond[Op.in] !== undefined) return cond[Op.in].includes(actual);
    if (cond[Op.notIn] !== undefined) return !cond[Op.notIn].includes(actual);
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
    destroy: async ({ where } = {}) => {
      db.sortieRequests = db.sortieRequests.filter((sr) => !matchFilter(sr, where));
      return 1;
    },
  },
  Sortie: {
    findOne: async ({ where } = {}) => saveable(db.sorties.find((s) => matchFilter(s, where)), 'sorties') || null,
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

beforeEach(() => {
  db = { requests: [], vehicles: [], sorties: [], sortieRequests: [], employees: [] };
  notifyCalls.length = 0;
  sortieService.__setDeps({ models: fakeModels, notifyChiefs: fakeNotify });
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
    date_souhaitee: new Date('2026-09-06T09:00:00'), nb_personnes: 3,
  });

  assert.strictEqual(db.sorties.length, 1, 'une sortie doit être créée');
  assert.strictEqual(db.sorties[0].status, 'planned');
  assert.strictEqual(db.sorties[0].destination, 'Morondava');
  assert.strictEqual(db.vehicles[0].status, 'busy', 'le véhicule devient occupé');
  assert.strictEqual(db.sortieRequests.length, 1);
  assert.strictEqual(db.sortieRequests[0].request_id, 42);
  assert.strictEqual(notifyCalls.length, 1);
  assert.strictEqual(notifyCalls[0][0], 'sortie_created');
});

test('autoCreateSortie : réutilise une sortie planifiée compatible (regroupement)', async () => {
  db.vehicles = [{ id: 1, capacity: 10, status: 'busy', type: 'voiture' }];
  db.requests = [{ id: 1, nb_personnes: 2, destination: 'Toliara', status: 'approved' }];
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
  db.requests = [{ id: 1, nb_personnes: 4, destination: 'Tamatave', status: 'approved' }];
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
