'use strict';
const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

const scheduler = require('../services/sortieScheduler');
const { Op } = require('sequelize');

let sorties;
let notified;

beforeEach(() => {
  sorties = [];
  notified = [];

  const fakeNotificationService = {
    getLinkedEmployeeIds: async () => [2],
    notifySortieImminent: async (sortie, ids) => { notified.push({ sortie, ids }); },
    IMMINENT_WINDOW_MIN: 30,
  };

  scheduler.__setDeps({
    Sortie: {
      findAll: async ({ where, include }) => {
        const gte = where.departure_time[Op.gte];
        const lte = where.departure_time[Op.lte];
        const from = new Date(gte).getTime();
        const to = new Date(lte).getTime();
        return sorties.filter((s) => {
          if (s.status !== where.status) return false;
          const t = new Date(s.departure_time).getTime();
          if (include && s.Vehicle === undefined) return false;
          return t >= from && t <= to;
        });
      },
    },
    Vehicle: { name: 'Vehicle' },
    notificationService: fakeNotificationService,
  });
});

afterEach(() => scheduler.__resetDeps());

test('findImminentSorties : ne renvoie que les sorties planifiées imminentes', async () => {
  const soon = Date.now() + 10 * 60 * 1000;   // dans 10 min → imminente
  const later = Date.now() + 2 * 60 * 60 * 1000; // dans 2h → pas imminente
  sorties = [
    { id: 1, status: 'planned', departure_time: new Date(soon), Vehicle: { id: 1, type: 'voiture' } },
    { id: 2, status: 'planned', departure_time: new Date(later), Vehicle: { id: 2, type: 'voiture' } },
    { id: 3, status: 'ongoing', departure_time: new Date(soon), Vehicle: { id: 3, type: 'voiture' } },
  ];
  const res = await scheduler.findImminentSorties();
  assert.strictEqual(res.length, 1, 'une seule sortie imminente planifiée');
  assert.strictEqual(res[0].id, 1);
});

test('checkAndNotifyImminent : notifie chaque sortie imminente', async () => {
  const soon = Date.now() + 5 * 60 * 1000;
  sorties = [
    { id: 1, status: 'planned', departure_time: new Date(soon), Vehicle: { id: 1 } },
    { id: 2, status: 'planned', departure_time: new Date(soon + 60 * 1000), Vehicle: { id: 2 } },
  ];
  const count = await scheduler.checkAndNotifyImminent();
  assert.strictEqual(count, 2);
  assert.deepStrictEqual(notified.map((n) => n.sortie.id), [1, 2], 'les deux sorties sont notifiées');
  assert.strictEqual(notified[0].ids[0], 2, 'l\'employé lié est transmis');
});

test('checkAndNotifyImminent : aucune sortie imminente => aucune notification', async () => {
  const later = Date.now() + 2 * 60 * 60 * 1000;
  sorties = [{ id: 1, status: 'planned', departure_time: new Date(later), Vehicle: { id: 1 } }];
  const count = await scheduler.checkAndNotifyImminent();
  assert.strictEqual(count, 0);
  assert.strictEqual(notified.length, 0);
});

test('imminentWindowBounds : fenêtre = maintenant → départ + 30 min', () => {
  const now = new Date('2026-09-09T12:00:00Z');
  const { from, to } = scheduler.imminentWindowBounds(now);
  assert.strictEqual(from.getTime(), now.getTime());
  assert.strictEqual(to.getTime(), now.getTime() + 30 * 60 * 1000);
});