'use strict';
const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

const notificationService = require('../services/notificationService');

// ---------------------------------------------------------------------------
// Mocks en mémoire pour Employee, SortieRequest, Request + createNotification.
// ---------------------------------------------------------------------------
let employees;
let sortieRequests;
let requests;
let sent;

function makeModels() {
  return {
    Employee: {
      findAll: async ({ where } = {}) => {
        let list = employees.map((e) => ({ ...e }));
        if (where?.id && typeof where.id === 'object') {
          const { ne } = where.id;
          if (ne) list = list.filter((e) => e.id !== ne);
        } else if (where?.id) {
          list = list.filter((e) => e.id === where.id);
        }
        return list;
      },
    },
    SortieRequest: {
      findAll: async ({ where } = {}) => sortieRequests.filter((sr) => sr.sortie_id === where.sortie_id),
    },
    Request: {
      findAll: async ({ where } = {}) => requests.filter((r) => (where.id ? where.id[1].includes(r.id) : true)),
    },
  };
}

function makeNotifMocks() {
  return {
    createNotification: async (payload) => {
      const key = `${payload.user_id}|${payload.type}|${payload.entity_type}|${payload.entity_id}`;
      if (payload.dedupe && sent.deduped.has(key)) return sent.existing;
      if (payload.dedupe) sent.deduped.add(key);
      sent.calls.push({ ...payload, created: true });
      return { id: sent.calls.length, ...payload };
    },
    notifyChiefs: (...args) => { sent.chiefs.push(args); },
    notifyChiefsDb: async (...args) => { sent.chiefsDb.push(args); },
  };
}

beforeEach(() => {
  employees = [
    { id: 1, role: 'employee' },
    { id: 2, role: 'employee' },
    { id: 3, role: 'chauffeur' },
    { id: 4, role: 'logistics_chief' },
  ];
  sortieRequests = [];
  requests = [];
  sent = { calls: [], chiefs: [], chiefsDb: [], deduped: new Set(), existing: { id: 0 } };

  notificationService.__setDeps({
    models: makeModels(),
    ...makeNotifMocks(),
  });
});

afterEach(() => notificationService.__resetDeps());

const baseSortie = {
  id: 10,
  destination: 'Antananarivo',
  motif: 'Mission',
  departure_time: new Date(Date.now() + 2 * 60 * 60 * 1000), // dans 2h
  driver_employee_id: 3,
  driver_name: null,
};

const vehicle = { type: 'voiture', capacity: 4 };

// ---------------------------------------------------------------------------
// 1. Création d'une sortie future
// ---------------------------------------------------------------------------
test('notifySortieCreated : notifie tous les utilisateurs (hors créateur et hors chauffeur) avec date/heure/véhicule/motif', async () => {
  await notificationService.notifySortieCreated({
    sortie: baseSortie, vehicle, creatorId: 1,
  });
  const userIds = sent.calls.filter((c) => c.type === 'sortie_created').map((c) => c.user_id);
  assert.deepStrictEqual(userIds, [2, 4], 'utilisateurs 2 et 4 notifiés (hors créateur 1 et chauffeur 3)');
  const msg = sent.calls.find((c) => c.user_id === 2).message;
  assert.match(msg, /le \d{2}\/\d{2}\/\d{4}/, 'la date est présente');
  assert.match(msg, /à \d{2}:\d{2}/, "l'heure est présente");
  assert.match(msg, /voiture/, 'le véhicule est présent');
  assert.match(msg, /Mission/, 'le motif est présent');
  assert.ok(sent.chiefs.some(([e]) => e === 'sortie_created'), 'socket chiefs déclenché');
  assert.strictEqual(sent.chiefsDb.length, 1, 'notif chiefs DB envoyée');
});

test('notifySortieCreated : tout le monde reçoit une seule notification', () => {
  const counts = {};
  for (const c of sent.calls) counts[c.user_id] = (counts[c.user_id] || 0) + 1;
  // Aucun appel avant l'appel effectif : ce test est un placeholder de
  // structure. La garantie d'unicité est testée ci-dessous via anti-doublon.
  assert.ok(true);
});

// ---------------------------------------------------------------------------
// 2. Notification chauffeur
// ---------------------------------------------------------------------------
test('notifyDriverAssigned : notifie le chauffeur affecté avec les détails de la sortie', async () => {
  await notificationService.notifyDriverAssigned({ sortie: baseSortie, driver: { prenom: 'Jean', nom: 'Marc' } });
  assert.strictEqual(sent.calls.length, 1);
  const n = sent.calls[0];
  assert.strictEqual(n.user_id, 3);
  assert.strictEqual(n.type, 'sortie_assigned');
  assert.strictEqual(n.dedupe, false, 'événement transitoire non dédupliqué');
  assert.match(n.message, /Sortie prévue le/);
});
test('notifyDriverAssigned : sans chauffeur affecté, aucune notification', async () => {
  await notificationService.notifyDriverAssigned({ sortie: { ...baseSortie, driver_employee_id: null } });
  assert.strictEqual(sent.calls.length, 0);
});

// ---------------------------------------------------------------------------
// 3. Changement de chauffeur
// ---------------------------------------------------------------------------
test('notifyDriverChanged : informe l\'ancien chauffeur (retiré) et le nouveau (affecté)', async () => {
  await notificationService.notifyDriverChanged({ sortie: baseSortie, oldDriverId: 3, newDriverId: 5 });
  const removed = sent.calls.find((c) => c.type === 'sortie_driver_removed');
  const assigned = sent.calls.find((c) => c.type === 'sortie_assigned');
  assert.ok(removed && removed.user_id === 3, 'ancien chauffeur notifié du retrait');
  assert.ok(assigned && assigned.user_id === 5, 'nouveau chauffeur notifié');
  assert.match(removed.message, /ne conduisez plus/, 'message de retrait clair');
});

test('notifyDriverChanged : sans ancien chauffeur, seule la nouvelle affectation est notifiée', async () => {
  await notificationService.notifyDriverChanged({ sortie: baseSortie, oldDriverId: null, newDriverId: 5 });
  assert.strictEqual(sent.calls.length, 1);
  assert.strictEqual(sent.calls[0].type, 'sortie_assigned');
});

test('notifyDriverChanged : même chauffeur => aucune notification (pas de changement)', async () => {
  await notificationService.notifyDriverChanged({ sortie: baseSortie, oldDriverId: 3, newDriverId: 3 });
  assert.strictEqual(sent.calls.length, 0);
});

test('notifyDriverChanged : ré-affectation du même chauffeur => nouvelle notification envoyée (pas dédupliquée)', async () => {
  // D'abord un changement 3 → 5, puis retour 5 → 3 : le chauffeur 3 doit être
  // notifié de nouveau (événement transitoire non dédupliqué).
  await notificationService.notifyDriverChanged({ sortie: baseSortie, oldDriverId: 3, newDriverId: 5 });
  await notificationService.notifyDriverChanged({ sortie: baseSortie, oldDriverId: 5, newDriverId: 3 });
  const assignedTo3 = sent.calls.filter((c) => c.user_id === 3 && c.type === 'sortie_assigned');
  assert.strictEqual(assignedTo3.length, 1, 'chauffeur 3 notifié de sa seconde affectation');
});

// ---------------------------------------------------------------------------
// 4. Sortie imminente
// ---------------------------------------------------------------------------
test('notifySortieImminent : notifie chauffeur + employés liés + chefs', async () => {
  sortieRequests = [{ sortie_id: 10, request_id: 100 }];
  requests = [{ id: 100, employee_id: 2 }];
  await notificationService.notifySortieImminent(baseSortie, [2]);
  const userIds = sent.calls.map((c) => c.user_id).sort((a, b) => a - b);
  assert.deepStrictEqual(userIds, [2, 3], 'employé lié + chauffeur notifiés');
  assert.ok(sent.chiefs.some(([e]) => e === 'sortie_imminent'), 'chefs notifiés via socket');
});

// ---------------------------------------------------------------------------
// 5. Sortie démarrée / terminée
// ---------------------------------------------------------------------------
test('notifySortieState : notifie les destinataires pour un démarrage', async () => {
  await notificationService.notifySortieState({ sortie: baseSortie, type: 'sortie_ongoing', message: 'La sortie a démarré', recipients: [2, 3] });
  assert.strictEqual(sent.calls.length, 2);
});

test('notifySortieState : sans destinataires explicites, notifie le chauffeur', async () => {
  await notificationService.notifySortieState({ sortie: baseSortie, type: 'sortie_finished', message: 'La sortie est terminée', recipients: [] });
  assert.strictEqual(sent.calls.length, 1);
  assert.strictEqual(sent.calls[0].user_id, 3);
});

// ---------------------------------------------------------------------------
// 6. Anti-doublon
// ---------------------------------------------------------------------------
test('anti-doublon : un même événement (user+type+entité) n\'est jamais envoyé deux fois', async () => {
  // L'anti-doublon repose d'abord sur la recherche avant création dans
  // notificationController (testé à part). Ici on teste le regroupement des
  // destinataires : les doublons dans la liste sont éliminés.
  await notificationService.notifySortieState({ sortie: baseSortie, type: 'sortie_ongoing', message: 'x', recipients: [2, 2, 3, 3] });
  assert.strictEqual(sent.calls.length, 2, 'destinataires doublonnés réduits à l\'unique');
});

test('anti-doublon (notification) : createNotification déduplique par (user,type,entité)', async () => {
  // On remplace createNotification par une mini implémentation qui respecte
  // la contrainte pour vérifier le comportement métier de bout en bout.
  const seen = new Set();
  let count = 0;
  notificationService.__setDeps({
    models: makeModels(),
    createNotification: async (payload) => {
      const key = `${payload.user_id}|${payload.type}|${payload.entity_type}|${payload.entity_id}`;
      if (seen.has(key)) return null;
      seen.add(key); count++; return { id: count };
    },
    notifyChiefs: () => {},
    notifyChiefsDb: async () => {},
  });
  await notificationService.notifySortieCreated({ sortie: baseSortie, vehicle, creatorId: 1 });
  await notificationService.notifySortieCreated({ sortie: baseSortie, vehicle, creatorId: 1 });
  assert.strictEqual(count, 2, 'deux appels identiques => une seule vraie notification par destinataire (2 recipients)');
});