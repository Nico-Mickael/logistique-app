'use strict';

const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

const webPushService = require('../services/webPushService');

function fakeRow({ id = 1, user_id = 7, endpoint, p256dh = 'p', auth = 'a', device = null, createdAt = null } = {}) {
  return {
    id,
    user_id,
    endpoint: endpoint || `https://push.example.com/${id}`,
    p256dh,
    auth,
    device,
    createdAt: createdAt || '2026-09-10T00:00:00.000Z',
    toJSON() { return { id, user_id, endpoint: this.endpoint, p256dh, auth, device, createdAt }; },
    destroy: async () => {},
    save: async function () { return this; },
  };
}

beforeEach(() => {
  process.env.VAPID_PUBLIC_KEY = 'pub-test';
  process.env.VAPID_PRIVATE_KEY = 'priv-test';
  process.env.PUSH_ENABLED = 'true';
  webPushService.__resetDeps();
});

afterEach(() => {
  delete process.env.VAPID_PUBLIC_KEY;
  delete process.env.VAPID_PRIVATE_KEY;
  delete process.env.PUSH_ENABLED;
});

test('isEnabled : activé quand VAPID renseigné, sinon désactivé', () => {
  assert.equal(webPushService.isEnabled(), true);
  delete process.env.VAPID_PUBLIC_KEY;
  assert.equal(webPushService.isEnabled(), false);
});

test('isEnabled : PUSH_ENABLED=false force la désactivation', () => {
  process.env.PUSH_ENABLED = 'false';
  assert.equal(webPushService.isEnabled(), false);
});

test('buildPayload : titre mappé par type + contexte complet', () => {
  const payload = webPushService.buildPayload({
    id: 42, type: 'sortie_imminent', message: 'La sortie vers X commence bientôt',
    entity_type: 'sortie', entity_id: 9,
  });
  assert.equal(payload.title, 'Sortie imminente');
  assert.equal(payload.body, 'La sortie vers X commence bientôt');
  assert.deepEqual(payload.data, {
    url: '/', notification_id: 42, notification_type: 'sortie_imminent',
    entity_type: 'sortie', entity_id: 9,
  });
});

test('buildPayload : type inconnu → titre générique "Logistique ADES"', () => {
  assert.equal(webPushService.buildPayload({ type: 'xyz' }).title, 'Logistique ADES');
});

test('subscribe : crée un abonnement et n\'en crée pas de doublon (même endpoint)', async () => {
  let created = 0;
  const existing = null;
  const pushRow = fakeRow({ id: 1, user_id: 7 });
  let findOneCalls = 0;

  webPushService.__setDeps({
    PushSubscription: {
      findOne: async () => { findOneCalls += 1; return existing; },
      create: async (data) => { created += 1; return fakeRow(data); },
      count: async () => 1,
      findAll: async () => [],
    },
  });

  const sub = await webPushService.subscribe({ userId: 7, endpoint: 'https://push.example.com/1', p256dh: 'p', auth: 'a' });
  assert.equal(created, 1);
  assert.equal(sub.endpoint, 'https://push.example.com/1');

  // Upsert sur même (user_id, endpoint) : on met à jour, pas de doublon.
  const save = fakeRow({ id: 1, user_id: 7 });
  webPushService.__setDeps({
    PushSubscription: {
      findOne: async () => save,
      create: async () => { throw new Error('ne doit pas être appelé'); },
      count: async () => 1,
      findAll: async () => [],
    },
  });
  await webPushService.subscribe({ userId: 7, endpoint: 'https://push.example.com/1', p256dh: 'p2', auth: 'a2' });
  assert.equal(save.p256dh, 'p2');
  assert.equal(save.auth, 'a2');
  assert.ok(findOneCalls >= 1);
});

test('subscribe : refuse un abonnement incomplet', async () => {
  await assert.rejects(
    () => webPushService.subscribe({ userId: 7, endpoint: 'e', p256dh: 'p' }),
    (err) => { assert.equal(err.status, 400); return true; }
  );
});

test('subscribe : limite le nombre de tokens par utilisateur (purge des plus anciens)', async () => {
  const destroyed = [];
  const old = fakeRow({ id: 1 }); old.destroy = async () => destroyed.push(old.id);

  webPushService.__setDeps({
    PushSubscription: {
      findOne: async () => null,
      create: async (data) => fakeRow({ id: 99, ...data }),
      count: async () => 7,
      findAll: async () => [old, old],
    },
  });

  await webPushService.subscribe({ userId: 7, endpoint: 'e', p256dh: 'p', auth: 'a' });
  assert.equal(destroyed.length, 2);
});

test('unsubscribe : supprime le token du serveur', async () => {
  let destroyedWhere = null;
  webPushService.__setDeps({
    PushSubscription: {
      destroy: async (where) => { destroyedWhere = where; return 1; },
    },
  });
  const res = await webPushService.unsubscribe({ userId: 7, endpoint: 'https://push.example.com/1' });
  assert.equal(res, 1);
  assert.deepEqual(destroyedWhere.where, { user_id: 7, endpoint: 'https://push.example.com/1' });
});

test('sendToUser : désactivé → no-op (0 envoyé, 0 échec)', async () => {
  delete process.env.VAPID_PUBLIC_KEY;
  let sendCalls = 0;
  webPushService.__setDeps({
    PushSubscription: { findAll: async () => [fakeRow()] },
    sendOne: async () => { sendCalls += 1; },
  });
  const res = await webPushService.sendToUser(7, webPushService.buildPayload({}));
  assert.deepEqual(res, { sent: 0, failed: 0 });
  assert.equal(sendCalls, 0);
});

test('sendToUser : envoie à chaque appareil et retire les tokens 404/410', async () => {
  const subs = [fakeRow({ id: 1 }), fakeRow({ id: 2 }), fakeRow({ id: 3 })];
  const destroyed = [];
  subs.forEach((s) => { s.destroy = async () => destroyed.push(s.id); });

  const sent = [];
  webPushService.__setDeps({
    webpush: { setVapidDetails: () => {}, getVapidPublicKey: () => 'pub-test' },
    sendOne: async (row, payload) => {
      sent.push(row.id);
      if (row.id === 2) {
        const err = new Error('gone'); err.statusCode = 410; throw err;
      }
      if (row.id === 3) {
        const err = new Error('bogus'); err.statusCode = 500; throw err;
      }
    },
    PushSubscription: { findAll: async () => subs },
  });

  const res = await webPushService.sendToUser(7, webPushService.buildPayload({ message: 'x' }));
  assert.equal(res.sent, 1);
  assert.equal(res.failed, 2);
  assert.deepEqual(sent, [1, 2, 3]);
  // seule la subscription "gond" (410) est retirée en base
  assert.deepEqual(destroyed, [2]);
});

test('sendToUser : ne lève jamais, même en cas d\'erreur inattendue', async () => {
  webPushService.__setDeps({
    webpush: { setVapidDetails: () => {}, getVapidPublicKey: () => 'pub-test' },
    PushSubscription: { findAll: async () => { throw new Error('boom'); } },
  });
  const res = await webPushService.sendToUser(7, webPushService.buildPayload({}));
  assert.deepEqual(res, { sent: 0, failed: 0 });
});