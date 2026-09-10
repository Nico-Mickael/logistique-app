const asyncHandler = require('../utils/asyncHandler');
const webPushService = require('../services/webPushService');

// GET /api/push/config — configuration publique (la clé VAPID est publique)
exports.config = asyncHandler(async (req, res) => {
  res.json({
    enabled: webPushService.isEnabled(),
    vapidPublicKey: webPushService.getVapidPublicKey(),
    maxPerUser: webPushService.MAX_SUBSCRIPTIONS_PER_USER,
  });
});

// POST /api/push/subscribe — abonner l'appareil de l'utilisateur connecté
exports.subscribe = asyncHandler(async (req, res) => {
  if (!webPushService.isEnabled()) {
    return res.status(503).json({ message: 'Notifications push non configurées côté serveur' });
  }

  const { subscription, device } = req.body || {};
  if (!subscription || !subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
    return res.status(400).json({ message: 'Abonnement push invalide' });
  }

  const result = await webPushService.subscribe({
    userId: req.user.id,
    endpoint: subscription.endpoint,
    p256dh: subscription.keys.p256dh,
    auth: subscription.keys.auth,
    device: device || null,
  });

  res.status(201).json({ message: 'Abonnement push enregistré', subscription: result });
});

// DELETE /api/push/subscribe — désabonner un appareil (par son endpoint)
exports.unsubscribe = asyncHandler(async (req, res) => {
  const { endpoint } = req.body || {};
  if (!endpoint) {
    return res.status(400).json({ message: 'endpoint requis' });
  }
  await webPushService.unsubscribe({ userId: req.user.id, endpoint });
  res.json({ message: 'Abonnement push supprimé' });
});

// GET /api/push/subscriptions — appareils abonnés de l'utilisateur connecté
exports.list = asyncHandler(async (req, res) => {
  const subscriptions = await webPushService.getSubscriptions(req.user.id);
  res.json({ data: subscriptions });
});

// POST /api/push/test — envoie une notification de test sur les appareils
// de l'utilisateur connecté (validation de bout en bout).
exports.sendTest = asyncHandler(async (req, res) => {
  if (!webPushService.isEnabled()) {
    return res.status(503).json({ message: 'Notifications push non configurées côté serveur' });
  }

  const result = await webPushService.sendToUser(req.user.id, webPushService.buildTestPayload());
  if (result.sent === 0) {
    return res.status(404).json({ message: 'Aucun appareil abonné. Abonnez ce téléphone d\'abord.', result });
  }
  res.json({ message: `Test envoyé sur ${result.sent} appareil(s)`, result });
});