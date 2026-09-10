const { Op } = require('sequelize');
const notificationService = require('./notificationService');

// Dépendances injectables par défaut. Permet de tester le planificateur en
// isolation avec des mocks.
function defaultDeps() {
  const { Sortie, Vehicle } = require('../models');
  return {
    Sortie,
    Vehicle,
    notificationService,
  };
}

let _deps = null;
function getDeps() {
  if (!_deps) _deps = defaultDeps();
  return _deps;
}

function __setDeps(deps) { _deps = deps; }
function __resetDeps() { _deps = null; }

// Intervalle de scrutation (ms). Le seuil d'imminence est géré dans
// notificationService.IMMINENT_WINDOW_MIN. On scrute régulièrement et le
// mécanisme d'anti-doublon (entity_type/entity_id) garantit qu'une sortie
// n'est notifiée qu'une seule fois, même si le serveur redémarre.
const SCAN_INTERVAL_MS = 60 * 1000;

// Fenêtre d'imminence : sorties planifiées dont le départ est dans les
// IMMINENT_WINDOW_MIN prochaines minutes (dans le futur, encore à démarrer).
function imminentWindowBounds(now) {
  const within = notificationService.IMMINENT_WINDOW_MIN * 60 * 1000;
  return {
    from: now,
    to: new Date(now.getTime() + within),
  };
}

/**
 * Trouve les sorties planifiées devenant imminentes (jamais notifiées).
 * L'anti-doublon n'envoie réellement que celles qui n'ont pas encore reçu
 * l'événement sortie_imminent pour cette entité.
 * @returns {Promise<Array>} sorties imminentes
 */
async function findImminentSorties() {
  const { Sortie, Vehicle } = getDeps();
  const now = new Date();
  const { from, to } = imminentWindowBounds(now);
  return Sortie.findAll({
    where: {
      status: 'planned',
      departure_time: { [Op.gte]: from, [Op.lte]: to },
    },
    include: [
      { model: Vehicle, attributes: ['id', 'type', 'capacity', 'name'] },
    ],
  });
}

/**
 * Déclenche une notification d'imminence pour chaque sortie imminente.
 * La contrainte unique (user_id, type, entity) empêche les doublons.
 */
async function checkAndNotifyImminent() {
  const { notificationService: notif } = getDeps();
  const sorties = await findImminentSorties();
  for (const sortie of sorties) {
    const linkedIds = await notif.getLinkedEmployeeIds(sortie);
    await notif.notifySortieImminent(sortie, linkedIds);
  }
  return sorties.length;
}

let timer = null;

/**
 * Démarre la boucle périodique (idempotent).
 */
function start() {
  if (timer) return timer;
  // Premier passage rapide pour couvrir les sorties déjà imminentes au boot.
  setImmediate(() => {
    checkAndNotifyImminent()
      .catch((err) => console.error('[scheduler-imminence] Erreur :', err.message));
  });
  timer = setInterval(() => {
    checkAndNotifyImminent()
      .catch((err) => console.error('[scheduler-imminence] Erreur :', err.message));
  }, SCAN_INTERVAL_MS);
  if (timer.unref) timer.unref();
  return timer;
}

function stop() {
  if (timer) { clearInterval(timer); timer = null; }
}

module.exports = {
  start,
  stop,
  checkAndNotifyImminent,
  findImminentSorties,
  imminentWindowBounds,
  SCAN_INTERVAL_MS,
  __setDeps,
  __resetDeps,
};
