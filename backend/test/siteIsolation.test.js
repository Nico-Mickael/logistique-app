'use strict';
const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { Op } = require('sequelize');

const siteContext = require('../middlewares/siteContext');
const sortieService = require('../services/sortieService');
const notificationService = require('../services/notificationService');

// ---------------------------------------------------------------------------
// Isolation multi-sites : tests des barrières (helpers + services).
// Pattern DI identique aux tests existants (test/sortieService.test.js).
// ---------------------------------------------------------------------------

// ---------- siteContext : résolution du site autorisé ----------
test('siteContext.getResolvedSiteId : superadmin sans ?site → null (vision globale)', () => {
  const req = { user: { role: 'superadmin', site_id: 1 }, query: {} };
  assert.strictEqual(siteContext.getResolvedSiteId(req), null);
});

test('siteContext.getResolvedSiteId : superadmin avec ?site=3 → 3', () => {
  const req = { user: { role: 'superadmin', site_id: 1 }, query: { site: '3' } };
  assert.strictEqual(siteContext.getResolvedSiteId(req), 3);
});

test('siteContext.getResolvedSiteId : non-superadmin → son site, le ?site client est ignoré', () => {
  const req = { user: { role: 'logistics_chief', site_id: 2 }, query: { site: '99' } };
  assert.strictEqual(siteContext.getResolvedSiteId(req), 2);
});

test('siteContext.scopeWhere : aucun filtre pour le superadmin global, sinon { site_id }', () => {
  assert.deepStrictEqual(
    siteContext.scopeWhere({ user: { role: 'superadmin', site_id: 1 }, query: {} }),
    {}
  );
  assert.deepStrictEqual(
    siteContext.scopeWhere({ user: { role: 'superadmin', site_id: 1 }, query: { site: '3' } }),
    { site_id: 3 }
  );
  assert.deepStrictEqual(
    siteContext.scopeWhere({ user: { role: 'employee', site_id: 7 }, query: {} }),
    { site_id: 7 }
  );
});

test('siteContext.requireSiteAccess : superadmin jamais bloqué, mismatch → 403, match → ok', () => {
  const superReq = { user: { role: 'superadmin', site_id: 1 }, query: {} };
  assert.strictEqual(siteContext.requireSiteAccess(superReq, 42), true);

  const chiefSite2 = { user: { role: 'logistics_chief', site_id: 2 }, query: {} };
  assert.throws(() => siteContext.requireSiteAccess(chiefSite2, 1), (err) => err.status === 403);
  assert.throws(() => siteContext.requireSiteAccess(chiefSite2, null), (err) => err.status === 403);
  assert.strictEqual(siteContext.requireSiteAccess(chiefSite2, 2), true);
});

test('siteContext.enforceCreationSite : non-superadmin ne peut PAS injecter un site via body', () => {
  const req = { user: { role: 'employee', site_id: 7 }, body: { siteId: 99 } };
  assert.strictEqual(siteContext.enforceCreationSite(req), 7);
});

test('siteContext.enforceCreationSite : superadmin choisit body.siteId, sinon son site', () => {
  assert.strictEqual(
    siteContext.enforceCreationSite({ user: { role: 'superadmin', site_id: 1 }, body: { siteId: 3 } }),
    3
  );
  assert.strictEqual(
    siteContext.enforceCreationSite({ user: { role: 'superadmin', site_id: 1 }, body: {} }),
    1
  );
});

// ---------- sortieService : gardes multi-sites ----------
let db = { requests: [], vehicles: [], sorties: [], sortieRequests: [], employees: [] };

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

function matchFilter(row, where) {
  if (!where) return true;
  function eq(actual, cond) {
    if (cond === undefined) return true;
    if (cond === null) return actual === null;
    if (cond && typeof cond === 'object' && !(cond instanceof Date)) {
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
  return Object.entries(where).every(([key, cond]) => eq(row[key], cond));
}

// Capture les appels findAll pour vérifier le filtrage par site.
const findAllCalls = [];
function makeFakeModels() {
  return {
    Request: {
      findAll: async ({ where } = {}) => {
        findAllCalls.push({ model: 'Request', where });
        return db.requests.filter((r) => matchFilter(r, where)).map((r) => saveable(r, 'requests'));
      },
      findByPk: async (id) => saveable(db.requests.find((r) => r.id === id), 'requests') || null,
      count: async ({ where } = {}) => db.requests.filter((r) => matchFilter(r, where)).length,
    },
    Sortie: {
      findAll: async ({ where } = {}) => db.sorties.filter((s) => matchFilter(s, where)).map((s) => saveable(s, 'sorties')),
      findByPk: async (id) => saveable(db.sorties.find((s) => s.id === id), 'sorties') || null,
      create: async (data) => {
        const row = { id: db.sorties.length + 1, ...data };
        db.sorties.push(row);
        return row;
      },
      count: async ({ where } = {}) => db.sorties.filter((s) => matchFilter(s, where)).length,
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
    Vehicle: {
      findByPk: async (id) => saveable(db.vehicles.find((v) => v.id === id), 'vehicles') || null,
      count: async ({ where } = {}) => db.vehicles.filter((v) => matchFilter(v, where)).length,
    },
    Employee: {
      findAll: async () => [],
      findByPk: async (id) => db.employees.find((e) => e.id === id) || null,
    },
  };
}

beforeEach(() => {
  db = { requests: [], vehicles: [], sorties: [], sortieRequests: [], employees: [] };
  findAllCalls.length = 0;
  sortieService.__setDeps({ models: makeFakeModels(), notifyChiefs: () => {}, releaseIfIdle: () => {} });
});

afterEach(() => {
  sortieService.__resetDeps();
  notificationService.__resetDeps();
});

test('findCompatibleRequests : exclut les demandes d\'un AUTRE site', async () => {
  const base = new Date('2026-09-05T10:00:00').getTime();
  db.sorties = [{ id: 99, site_id: 1 }];
  db.requests = [
    // même destination, même créneau, statut compatible — SITE 1
    { id: 1, site_id: 1, destination: 'Antananarivo', status: 'pending', date_souhaitee: new Date(base), nb_personnes: 1 },
    // même destination, même créneau — SITE 3 (ne doit JAMAIS apparaître)
    { id: 2, site_id: 3, destination: 'Antananarivo', status: 'pending', date_souhaitee: new Date(base), nb_personnes: 1 },
  ];
  db.sortieRequests = [{ sortie_id: 99, request_id: 3 }];

  const result = await sortieService.findCompatibleRequests(99, 'Antananarivo', 10, new Date(base));
  const ids = result.map((r) => r.id);
  assert.deepStrictEqual(ids, [1], 'une demande d\'un autre site ne doit pas être proposée');
});

test('attachRequestToSortie : refuse (403) de regrouper une demande d\'un autre site', async () => {
  db.vehicles = [{ id: 1, capacity: 10, status: 'busy' }];
  db.sorties = [{ id: 99, site_id: 1, status: 'planned', destination: 'Antananarivo', vehicle_id: 1 }];
  db.requests = [{ id: 5, site_id: 3, status: 'approved', destination: 'Antananarivo', date_souhaitee: new Date('2026-09-05T10:00:00'), nb_personnes: 1 }];

  await assert.rejects(
    () => sortieService.attachRequestToSortie({ sortieId: 99, requestId: 5 }),
    (err) => err.status === 403
  );
});

test('attachRequestToSortie : accepte une demande du MÊME site', async () => {
  db.vehicles = [{ id: 1, capacity: 10, status: 'busy' }];
  db.sorties = [{ id: 99, site_id: 1, status: 'planned', destination: 'Antananarivo', vehicle_id: 1 }];
  db.requests = [{ id: 5, site_id: 1, status: 'approved', destination: 'Antananarivo', date_souhaitee: new Date('2026-09-05T10:00:00'), nb_personnes: 1 }];
  db.sortieRequests = [];

  const result = await sortieService.attachRequestToSortie({ sortieId: 99, requestId: 5 });
  assert.strictEqual(result.status, 'added');
  assert.ok(db.sortieRequests.some((sr) => sr.sortie_id === 99 && sr.request_id === 5));
});

test('autoCreateSortie : crée la sortie avec le site de la demande et ne regroupe pas celles d\'un autre site', async () => {
  db.vehicles = [{ id: 1, capacity: 10, status: 'available', type: 'voiture' }];
  db.employees = [{ id: 1, nom: 'R', prenom: 'A' }];
  // Sortie planifiée du même jour/véhicule mais d'un AUTRE site → ne pas regrouper
  db.sorties = [{
    id: 100, vehicle_id: 1, status: 'planned', destination: 'Antananarivo',
    departure_time: new Date('2026-09-07T09:00:00'), site_id: 3,
  }];
  db.sortieRequests = [];
  db.requests = [{ id: 2, site_id: 1, status: 'approved', destination: 'Antananarivo' }];

  await sortieService.autoCreateSortie({
    id: 2, employee_id: 1, vehicle_id: 1, destination: 'Antananarivo',
    date_souhaitee: new Date('2026-09-07T09:10:00'), nb_personnes: 2, site_id: 1,
  });

  const created = db.sorties.find((s) => s.id !== 100);
  assert.ok(created, 'une nouvelle sortie est créée (l\'autre est d\'un site différent)');
  assert.strictEqual(created.site_id, 1, 'la sortie porte le site de la demande');
  assert.strictEqual(db.sortieRequests.length, 1);
  assert.strictEqual(db.sortieRequests[0].sortie_id, created.id);
});

test('autoCreateSortie : regroupe UNIQUEMENT si la sortie compatible est du même site', async () => {
  db.vehicles = [{ id: 1, capacity: 10, status: 'busy', type: 'voiture' }];
  db.sorties = [{
    id: 100, vehicle_id: 1, status: 'planned', destination: 'Antananarivo',
    departure_time: new Date('2026-09-07T09:00:00'), site_id: 1,
  }];
  db.sortieRequests = [];
  db.requests = [{ id: 1, site_id: 1, status: 'approved', destination: 'Antananarivo' }, { id: 2, site_id: 1, status: 'approved', destination: 'Antananarivo' }];

  await sortieService.autoCreateSortie({
    id: 2, employee_id: 1, vehicle_id: 1, destination: 'Antananarivo',
    date_souhaitee: new Date('2026-09-07T09:10:00'), nb_personnes: 2, site_id: 1,
  });

  assert.strictEqual(db.sorties.length, 1, 'aucune nouvelle sortie : regroupée dans celle du même site');
  assert.ok(db.sortieRequests.some((sr) => sr.sortie_id === 100), 'la demande rejoint la sortie du même site');
});

// ---------- notificationService.notifySortieCreated : scope par site ----------
test('notifySortieCreated : ne notifie que les employés du site de la sortie', async () => {
  const dbNotifs = [];
  const chiefsDbCalls = [];
  const socketCalls = [];
  const fakeDeps = {
    models: {
      Employee: {
        findAll: async ({ where } = {}) => {
          findAllCalls.push({ model: 'Employee', where });
          return db.employees
            .filter((e) => (where?.site_id == null ? true : e.site_id === where.site_id))
            .map((e) => e);
        },
      },
      SortieRequest: {
        findAll: async () => [],
      },
      Request: {
        findAll: async () => [],
      },
    },
    createNotification: async (n) => dbNotifs.push(n),
    notifyChiefsDb: async (o) => chiefsDbCalls.push(o),
    notifyChiefs: (...args) => socketCalls.push(args),
  };
  notificationService.__setDeps(fakeDeps);

  db.employees = [
    { id: 1, site_id: 1 },
    { id: 2, site_id: 1 },
    { id: 3, site_id: 3 }, // employé d'un autre site : ne doit pas recevoir
  ];

  await notificationService.notifySortieCreated({
    sortie: { id: 10, site_id: 1, destination: 'Antananarivo', departure_time: new Date('2026-09-10T09:00:00') },
    creatorId: 1,
  });

  const recipients = dbNotifs.map((n) => n.user_id);
  assert.ok(recipients.includes(2), 'l\'employé du même site reçoit la notification');
  assert.ok(!recipients.includes(3), 'l\'employé d\'un autre site ne reçoit RIEN');
  assert.strictEqual(chiefsDbCalls.length, 1);
  assert.strictEqual(chiefsDbCalls[0].site_id, 1, 'notifyChiefsDb est appelé avec le site de la sortie');
  assert.strictEqual(socketCalls[0][0], 'sortie_created');
});