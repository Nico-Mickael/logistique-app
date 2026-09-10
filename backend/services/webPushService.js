'use strict';

// ============================================================
// Notifications push (Web Push — Push API + VAPID)
// ------------------------------------------------------------
// Mécanisme standard et gratuit : les navigateurs (Chrome/Edge →
// FCM, Firefox → Mozilla autopush, Safari → APNs) délivrent les
// notifications selon le protocole Web Push. Aucun fournisseur
// externe payant n'est requis.
//
// Activation : passer VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY dans
// l'environnement (voir docs/NOTIFICATIONS-PUSH.md). Sans ces
// clés, le service est désactivé et toutes les fonctions deviennent
// des no-ops : le système de notification existant n'est pas impacté.
// ============================================================

const webpush = require('web-push');
const { PushSubscription } = require('../models');

const MAX_SUBSCRIPTIONS_PER_USER = 5;

const PUSH_TITLES = {
  sortie_created: 'Nouvelle sortie',
  sortie_imminent: 'Sortie imminente',
  sortie_ongoing: 'Sortie démarrée',
  sortie_finished: 'Sortie terminée',
  sortie_assignment: 'Votre demande est confirmée',
  sortie_assigned: 'Affectation chauffeur',
  sortie_driver_changed: 'Chauffeur modifié',
  sortie_driver_removed: 'Chauffeur retiré d\'une sortie',
  sortie_updated: 'Sortie mise à jour',
  sortie_cancelled: 'Sortie annulée',
  return_marked: 'Retour enregistré',
  approved: 'Demande validée',
  rejected: 'Demande refusée',
  rescheduled: 'Demande replanifiée',
  cancelled: 'Demande annulée',
  vehicle_alert: 'Alerte véhicule',
};

// --- Injection de dépendances (utilisé par les tests) ---
function defaultDeps() {
  return {
    PushSubscription,
    webpush,
    sendOne: (subscription, payload, webPushInstance = webpush) =>
      webPushInstance.sendNotification(subscription.toWebPushSubscription(), JSON.stringify(payload)),
  };
}
let deps = defaultDeps();
function __setDeps(overrides) { deps = { ...defaultDeps(), ...overrides }; }
function __resetDeps() { deps = defaultDeps(); }

function isEnabled() {
  if (process.env.PUSH_ENABLED === 'false') return false;
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

function configure() {
  if (!isEnabled()) return false;
  deps.webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:logistique@ades.mg',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
  return true;
}

function getVapidPublicKey() {
  return process.env.VAPID_PUBLIC_KEY || null;
}

// Titre court + corps + contexte utilisés par le service worker.
function buildPayload(notif = {}) {
  return {
    title: PUSH_TITLES[notif.type] || 'Logistique ADES',
    body: notif.message || '',
    data: {
      url: '/',
      notification_id: notif.id != null ? notif.id : null,
      notification_type: notif.type || null,
      entity_type: notif.entity_type || null,
      entity_id: notif.entity_id != null ? notif.entity_id : null,
    },
  };
}

function buildTestPayload() {
  return {
    title: 'Logistique ADES',
    body: 'Test de notification push réussi ✅',
    data: { url: '/', test: true },
  };
}

function serializeSubscription(row) {
  return row == null ? null : {
    id: row.id,
    endpoint: row.endpoint,
    device: row.device,
    createdAt: row.createdAt,
  };
}

// Ajoute (ou met à jour, anti-doublon par endpoint) un abonnement.
async function subscribe({ userId, endpoint, p256dh, auth, device = null }) {
  if (!userId || !endpoint || !p256dh || !auth) {
    throw Object.assign(new Error('Abonnement push invalide'), { status: 400 });
  }

  const existing = await deps.PushSubscription.findOne({
    where: { user_id: userId, endpoint },
  });

  let row;
  if (existing) {
    existing.p256dh = p256dh;
    existing.auth = auth;
    existing.device = device || existing.device;
    row = await existing.save();
  } else {
    row = await deps.PushSubscription.create({ user_id: userId, endpoint, p256dh, auth, device });
  }

  // Borne le nombre de tokens par utilisateur (les anciens sont purgés).
  const count = await deps.PushSubscription.count({ where: { user_id: userId } });
  if (count > MAX_SUBSCRIPTIONS_PER_USER) {
    const toRemove = await deps.PushSubscription.findAll({
      where: { user_id: userId },
      order: [['createdAt', 'DESC']],
      offset: MAX_SUBSCRIPTIONS_PER_USER,
      limit: count - MAX_SUBSCRIPTIONS_PER_USER,
    });
    await Promise.all(toRemove.map((s) => s.destroy()));
  }

  return serializeSubscription(row);
}

async function unsubscribe({ userId, endpoint }) {
  return deps.PushSubscription.destroy({ where: { user_id: userId, endpoint } });
}

async function getSubscriptions(userId) {
  const rows = await deps.PushSubscription.findAll({
    where: { user_id: userId },
    order: [['createdAt', 'DESC']],
  });
  return rows.map(serializeSubscription);
}

// Une subscription "gond" (404/410) doit être retirée en base.
function isGoneError(err) {
  const status = err && (err.statusCode || err.status);
  return status === 404 || status === 410;
}

function toWebPushSubscription(row) {
  return {
    endpoint: row.endpoint,
    keys: { p256dh: row.p256dh, auth: row.auth },
  };
}

// Envoi à tous les appareils d'un utilisateur. Ne lève JAMAIS :
// une erreur ici ne doit pas casser le flux de notification existant.
async function sendToUser(userId, payload) {
  if (!isEnabled()) return { sent: 0, failed: 0 };
  if (!deps.webpush.getVapidPublicKey || !deps.webpush.getVapidPublicKey()) {
    return { sent: 0, failed: 0 };
  }

  // Ne lève JAMAIS : une erreur ici ne doit pas casser le flux existant.
  try {
    const rows = await deps.PushSubscription.findAll({ where: { user_id: userId } });
    if (rows.length === 0) return { sent: 0, failed: 0 };

    const results = await Promise.allSettled(
      rows.map((row) => deps.sendOne({ ...row.toJSON(), toWebPushSubscription: () => toWebPushSubscription(row) }, payload))
    );

    let sent = 0;
    let failed = 0;
    results.forEach((res, i) => {
      if (res.status === 'fulfilled') {
        sent += 1;
      } else {
        failed += 1;
        const err = res.reason;
        if (isGoneError(err)) {
          rows[i].destroy().catch((destroyErr) =>
            console.error('[push] Échec suppression subscription expirée:', destroyErr.message));
        } else {
          console.error('[push] Échec d\'envoi:', err.statusCode || err.message);
        }
      }
    });

    return { sent, failed };
  } catch (err) {
    console.error('[push] Erreur inattendue:', err.message);
    return { sent: 0, failed: 0 };
  }
}

module.exports = {
  configure,
  isEnabled,
  getVapidPublicKey,
  buildPayload,
  buildTestPayload,
  subscribe,
  unsubscribe,
  getSubscriptions,
  sendToUser,
  isGoneError,
  toWebPushSubscription,
  MAX_SUBSCRIPTIONS_PER_USER,
  __setDeps,
  __resetDeps,
};