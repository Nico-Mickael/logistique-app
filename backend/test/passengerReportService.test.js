'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { Op } = require('sequelize');

const passengerReportService = require('../services/passengerReportService');

// ---------------------------------------------------------------------------
// buildFilters — construction du where du rapport "qui était à bord ?"
// ---------------------------------------------------------------------------
test('buildFilters : exige le paramètre date', () => {
  const r = passengerReportService.buildFilters({});
  assert.ok(r.error);
  assert.match(r.error, /date/i);
});

test('buildFilters : date seule → exclut les sorties planifiées et borne le jour', () => {
  const r = passengerReportService.buildFilters({ date: '2026-09-04' });
  assert.strictEqual(r.error, undefined);
  assert.strictEqual(r.where.status[Op.ne], 'planned');
  assert.deepStrictEqual(r.where.departure_time, {
    [Op.gte]: new Date('2026-09-04T00:00:00'),
    [Op.lt]: new Date('2026-09-04T23:59:59.999'),
  });
});

test('buildFilters : vehicle_id entier filtré', () => {
  const r = passengerReportService.buildFilters({ date: '2026-09-04', vehicle_id: '3' });
  assert.strictEqual(r.where.vehicle_id, 3);
});

test('buildFilters : vehicle_id invalide → erreur', () => {
  const r = passengerReportService.buildFilters({ date: '2026-09-04', vehicle_id: 'abc' });
  assert.ok(r.error);
  assert.match(r.error, /entier/i);
});

test('buildFilters : vehicle_type filtré dans le JOIN', () => {
  const r = passengerReportService.buildFilters({ date: '2026-09-04', vehicle_type: 'voiture' });
  assert.deepStrictEqual(r.vehicleWhere, { type: 'voiture' });
});

test('buildFilters : time_from/time_to bornent departure_time', () => {
  const r = passengerReportService.buildFilters({ date: '2026-09-04', time_from: '08:15', time_to: '18:00' });
  assert.strictEqual(r.where.departure_time[Op.gte].getTime(), new Date('2026-09-04T08:15:00').getTime());
  assert.strictEqual(r.where.departure_time[Op.lt].getTime(), new Date('2026-09-04T18:00:00').getTime());
});

test('buildFilters : heure invalide → erreur 400', () => {
  const r = passengerReportService.buildFilters({ date: '2026-09-04', time_from: '25:00' });
  assert.ok(r.error);
  assert.strictEqual(r.status, 400);
});

test('buildFilters : structure non numérique', () => {
  const r = passengerReportService.buildFilters({ date: '2026-09-04', time_to: 'abc' });
  assert.ok(r.error);
  assert.strictEqual(r.status, 400);
});

// ---------------------------------------------------------------------------
// findReport — requête unique + mapping DTO
// ---------------------------------------------------------------------------
let db;

const fakeModels = {
  Sortie: {
    findAll: async ({ include, where, order, subQuery }) => {
      db.calls = { where, include, order, subQuery };
      return [
        {
          id: 21,
          destination: 'Antananarivo',
          motif: 'Mission officielle',
          status: 'finished',
          departure_time: new Date('2026-09-04T09:00:00'),
          departed_at: new Date('2026-09-04T09:12:00'),
          returned_at: new Date('2026-09-04T15:30:00'),
          departure_km: 12000,
          arrival_km: 12245,
          distance_km: 245,
          driver: { id: 3, nom: 'Rakoto', prenom: 'Jean', department: 'Logistique' },
          driver_name: null,
          Vehicle: { id: 1, type: 'voiture', capacity: 4 },
          Requests: [
            { id: 11, employee_id: 8, status: 'approved', destination: 'Antananarivo', motif: 'Réunion', nb_personnes: 2, Employee: { id: 8, nom: 'Rabe', prenom: 'Solo', department: 'RH' } },
            { id: 12, employee_id: 9, status: 'approved', destination: 'Antananarivo', motif: 'Formation', nb_personnes: 1, Employee: { id: 9, nom: 'Mina', prenom: 'Lova', department: 'Compta' } },
            { id: 13, employee_id: 10, status: 'rejected', destination: 'Antananarivo', motif: 'Rejetée', nb_personnes: 3, Employee: null },
          ],
        },
      ];
    },
  },
};

before(() => {
  passengerReportService.__setDeps({ models: fakeModels });
});

after(() => {
  passengerReportService.__resetDeps();
});

test('findReport : ne garde que les demandes validées et construit le DTO complet', async () => {
  db = {};
  const result = await passengerReportService.findReport({ date: '2026-09-04', vehicle_type: 'voiture' });

  assert.strictEqual(result.error, undefined);
  assert.strictEqual(result.data.length, 1);

  const s = result.data[0];
  assert.strictEqual(s.id, 21);
  assert.strictEqual(s.status, 'finished');
  assert.strictEqual(s.driver_name, 'Jean Rakoto');
  assert.strictEqual(s.driver_department, 'Logistique');
  assert.strictEqual(s.vehicle.type, 'voiture');
  assert.strictEqual(s.passenger_count, 2, 'la demande rejetée est exclue');
  assert.strictEqual(s.passengers[0].request_id, 11);
  assert.strictEqual(s.passengers[0].employee.nom, 'Rabe');
  assert.strictEqual(s.passengers[1].request_id, 12);
  assert.strictEqual(s.passengers[0].motif, 'Réunion');

  assert.strictEqual(db.calls.subQuery, false, 'pas de sous-requête paginée');
  assert.strictEqual(db.calls.order[0][0], 'departure_time');
  const vehicleInc = db.calls.include[0];
  assert.strictEqual(vehicleInc.where.type, 'voiture', 'le type de véhicule est filtré dans le JOIN');
});

test('findReport : date manquante → error sans requête', async () => {
  const result = await passengerReportService.findReport({});
  assert.ok(result.error);
});