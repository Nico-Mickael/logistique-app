'use strict';
const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

const vehicleService = require('../services/vehicleService');

// ---------------------------------------------------------------------------
// Implémentation en mémoire minimale des modèles utilisés par le service.
// ---------------------------------------------------------------------------
let db = { vehicles: [], requests: [], sorties: [] };

const fakeModels = {
  Vehicle: {
    findByPk: async (id) => {
      const row = db.vehicles.find((v) => v.id === id);
      if (!row) return null;
      return {
        ...row,
        async save() {
          const idx = db.vehicles.findIndex((v) => v.id === row.id);
          if (idx !== -1) db.vehicles[idx] = { ...this };
        },
      };
    },
  },
  Request: {
    findAll: async ({ where, include } = {}) => {
      return db.requests
        .filter((r) => r.vehicle_id === where.vehicle_id && where.status.includes(r.status))
        .map((r) => ({ ...r, Sorties: include ? r.Sorties : undefined }));
    },
  },
  Sortie: {
    count: async ({ where } = {}) =>
      db.sorties.filter((s) => s.vehicle_id === where.vehicle_id && !['finished'].includes(s.status)).length,
  },
};

beforeEach(() => {
  db = { vehicles: [{ id: 1, status: 'busy' }], requests: [], sorties: [] };
  vehicleService.__setDeps({ models: fakeModels });
});

afterEach(() => {
  vehicleService.__resetDeps();
});

test('releaseIfIdle : libère le véhicule quand la seule sortie est terminée (demande liée toujours approved)', async () => {
  db.sorties = [{ vehicle_id: 1, status: 'finished' }];
  db.requests = [
    { id: 1, vehicle_id: 1, status: 'approved', Sorties: [{ id: 1, status: 'finished' }] },
  ];
  await vehicleService.releaseIfIdle(1);
  assert.strictEqual(db.vehicles[0].status, 'available',
    'une demande approved liée uniquement à une sortie terminée ne doit pas bloquer le véhicule');
});

test('releaseIfIdle : ne libère PAS si une autre sortie est encore active', async () => {
  db.sorties = [
    { vehicle_id: 1, status: 'finished' },
    { vehicle_id: 1, status: 'planned' },
  ];
  db.requests = [
    { id: 1, vehicle_id: 1, status: 'approved', Sorties: [{ id: 1, status: 'finished' }] },
  ];
  await vehicleService.releaseIfIdle(1);
  assert.strictEqual(db.vehicles[0].status, 'busy',
    'une sortie planifiée active doit garder le véhicule occupé');
});

test('releaseIfIdle : ne libère PAS si une demande approved sans sortie liée existe', async () => {
  db.sorties = [{ vehicle_id: 1, status: 'finished' }];
  db.requests = [
    { id: 1, vehicle_id: 1, status: 'approved', Sorties: [] },
  ];
  await vehicleService.releaseIfIdle(1);
  assert.strictEqual(db.vehicles[0].status, 'busy',
    'une demande approved non encore affectée retient le véhicule');
});

test('releaseIfIdle : libère quand plus aucune demande active', async () => {
  db.sorties = [{ vehicle_id: 1, status: 'finished' }];
  db.requests = [
    { id: 1, vehicle_id: 1, status: 'cancelled', Sorties: [] },
    { id: 2, vehicle_id: 1, status: 'rejected', Sorties: [] },
  ];
  await vehicleService.releaseIfIdle(1);
  assert.strictEqual(db.vehicles[0].status, 'available',
    'aucune demande active => le véhicule se libère');
});

test('syncKm : initialise current_km quand il est nul', async () => {
  db.vehicles = [{ id: 1, status: 'busy', current_km: null }];
  await vehicleService.syncKm(1, 2500);
  assert.strictEqual(db.vehicles[0].current_km, 2500);
});

test('syncKm : ne régresse jamais le kilométrage (km inférieur ou égal)', async () => {
  db.vehicles = [{ id: 1, status: 'busy', current_km: 4000 }];
  await vehicleService.syncKm(1, 3000);
  assert.strictEqual(db.vehicles[0].current_km, 4000, 'un km plus faible ne doit pas écraser');
  await vehicleService.syncKm(1, 4000);
  assert.strictEqual(db.vehicles[0].current_km, 4000, 'un km identique ne déclenche pas d\'écriture');
});

test('syncKm : ignore un véhicule inconnu ou des km vides', async () => {
  db.vehicles = [{ id: 1, status: 'busy', current_km: 1000 }];
  await vehicleService.syncKm(999, 5000);
  await vehicleService.syncKm(1, null);
  await vehicleService.syncKm(null, 5000);
  assert.strictEqual(db.vehicles[0].current_km, 1000);
});

test('isRequestable : véhicule busy avec sortie encore planifiée => toujours demandable', () => {
  assert.strictEqual(vehicleService.isRequestable({ id: 1, status: 'busy' }, false, false), true,
    'tant que la sortie n\'a pas démarré, les employés doivent pouvoir demander');
});

test('isRequestable : véhicule plein => plus de demande (même si la sortie est planifiée)', () => {
  assert.strictEqual(vehicleService.isRequestable({ id: 1, status: 'busy' }, false, true), false,
    'toutes les places occupées => plus aucune demande possible');
  assert.strictEqual(vehicleService.isRequestable({ id: 2, status: 'available' }, false, true), false);
});

test('isRequestable : bloqué dès qu\'une sortie a démarré, en panne ou en maintenance', () => {
  assert.strictEqual(vehicleService.isRequestable({ id: 1, status: 'busy' }, true, false), false,
    'une sortie démarrée (ongoing/pending_return) limite les nouvelles demandes');
  for (const status of ['maintenance', 'broken']) {
    assert.strictEqual(vehicleService.isRequestable({ id: 2, status }, false, false), false,
      `un véhicule en ${status} n'est jamais demandable`);
  }
});

test('isRequestable : véhicule inconnu jamais demandable', () => {
  assert.strictEqual(vehicleService.isRequestable(null, false), false);
});
