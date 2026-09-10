const { Op } = require('sequelize');

// ---------------------------------------------------------------------------
// Service de notification centralisé et extensible.
//
// Toutes les notifications métier liées aux sorties transitent ici, ce qui :
//   - évite la duplication de logique entre contrôleurs/services,
//   - offre un point unique pour ajouter de nouveaux types d'événements,
//   - garantit l'anti-doublon via entity_type + entity_id (avec contrainte
//     unique en base).
// ---------------------------------------------------------------------------

// Dépendances injectables (modèles + notif + socket) par défaut. Permet de
// tester le service en isolation en injectant des mocks.
function defaultDeps() {
  return {
    models: require('../models'),
    createNotification: require('../controllers/notificationController').createNotification,
    notifyChiefsDb: require('../controllers/notificationController').notifyChiefsDb,
    notifyChiefs: require('./socketService').notifyChiefs,
  };
}

let _deps = null;
function getDeps() {
  if (!_deps) _deps = defaultDeps();
  return _deps;
}

function __setDeps(deps) { _deps = deps; }
function __resetDeps() { _deps = null; }

// Types d'événements (source unique). Chaque type lié à une sortie porte
// entity_type='sortie' et entity_id=sortie.id → un seul envoi par événement.
const EVENT_TYPES = {
  SORTIE_CREATED: 'sortie_created',
  SORTIE_ASSIGNED: 'sortie_assigned',   // chauffeur affecté
  SORTIE_DRIVER_CHANGED: 'sortie_driver_changed',
  SORTIE_DRIVER_REMOVED: 'sortie_driver_removed',
  SORTIE_IMMINENT: 'sortie_imminent',
  SORTIE_STARTED: 'sortie_ongoing',
  SORTIE_FINISHED: 'sortie_finished',
  SORTIE_JOINED: 'sortie_assignment',
};

// Seuil "imminence" (minutes avant le départ)
const IMMINENT_WINDOW_MIN = 30;

/**
 * Construit un message riche pour une sortie (date, heure, véhicule,
 * chauffeur, motif — le motif seulement si disponible).
 * @param {object} sortie instance Sortie (avec éventuellement Vehicle/driver liés)
 * @param {object|null} vehicle instance Vehicle ou { type, capacity }
 * @param {object|null} driver instance Employee (compte chauffeur) ou { nom, prenom }
 * @returns {string}
 */
function buildSortieMessage(sortie, vehicle, driver) {
  const date = new Date(sortie.departure_time).toLocaleDateString('fr-FR');
  const heur = new Date(sortie.departure_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const vLabel = vehicle ? `${vehicle.type || ''}${vehicle.capacity ? ` (${vehicle.capacity} places)` : ''}`.trim() : 'Véhicule non précisé';
  const dName = driver
    ? (driver.prenom && driver.nom ? `${driver.prenom} ${driver.nom}` : driver.nom || driver.prenom || '')
    : sortie.driver_name || '';
  const dLabel = dName ? `Chauffeur: ${dName}. ` : '';
  const motif = sortie.motif ? `Motif: ${sortie.motif}. ` : '';
  return `Sortie prévue le ${date} à ${heur} — ${sortie.destination}. Véhicule: ${vLabel}. ${dLabel}${motif}`.trim();
}

/**
 * Notifie une liste d'utilisateurs pour un événement de sortie.
 * `recipients` = tableau de user_id.
 * `dedupe` (true par défaut) : n'envoie qu'une fois par (user, type, entité).
 * Les événements "transitoires" (affectation/changement de chauffeur) passent
 * dedupe=false : chaque occurrence doit être notifiée, même si elle se répète
 * sur la même sortie (ex. ré-affectation du même chauffeur).
 */
async function notifyRecipients({ sortie, type, recipients, message, excludeUserId, dedupe = true }) {
  const { createNotification } = getDeps();
  const uniqueIds = [...new Set((recipients || []).map(Number))];
  await Promise.all(
    uniqueIds
      .filter((id) => !(excludeUserId && id === Number(excludeUserId)))
      .map((userId) => createNotification({
        user_id: userId,
        message: message || buildSortieMessage(sortie, null, null),
        type,
        entity_type: dedupe ? 'sortie' : null,
        entity_id: dedupe ? sortie?.id : null,
        dedupe,
      }))
  );
}

/**
 * Récupère l'ensemble des employés (tous rôles confondus) hormis le créateur.
 */
async function getAllEmployeeIds(excludeUserId) {
  const { models } = getDeps();
  const { Employee } = models;
  const rows = await Employee.findAll({
    where: excludeUserId ? { id: { [Op.ne]: excludeUserId } } : undefined,
    attributes: ['id'],
  });
  return rows.map((e) => e.id);
}

/**
 * Notifie TOUS les utilisateurs (employés, chauffeurs, chefs) d'une nouvelle
 * sortie, avec le message détaillant date/heure/véhicule/chauffeur/motif.
 * Le chauffeur affecté est exclu du broadcast : il reçoit sa propre
 * notification d'affectation (notifyDriverAssigned) pour éviter le doublon.
 */
exports.notifySortieCreated = async ({ sortie, vehicle, driver, creatorId }) => {
  const allIds = await getAllEmployeeIds(creatorId);
  const driverId = Number(sortie.driver_employee_id);
  const recipients = allIds.filter((id) => id !== driverId);

  await notifyRecipients({
    sortie, type: EVENT_TYPES.SORTIE_CREATED, recipients,
    message: buildSortieMessage(sortie, vehicle, driver),
    excludeUserId: creatorId,
  });

  const { notifyChiefs, notifyChiefsDb } = getDeps();
  notifyChiefs('sortie_created', sortie);
  await notifyChiefsDb({
    message: `Nouvelle sortie planifiée vers ${sortie.destination}${sortie.motif ? ` — ${sortie.motif}` : ''}`,
    type: EVENT_TYPES.SORTIE_CREATED,
    excludeUserId: creatorId,
  });
};

/**
 * Notifie le chauffeur affecté à une sortie.
 */
exports.notifyDriverAssigned = async ({ sortie, driver }) => {
  if (!sortie.driver_employee_id) return;
  await notifyRecipients({
    sortie, type: EVENT_TYPES.SORTIE_ASSIGNED,
    recipients: [sortie.driver_employee_id],
    message: buildSortieMessage(sortie, null, driver),
    dedupe: false,
  });
};

/**
 * Lors d'un changement de chauffeur : notifie l'ancien (retiré) et le nouveau
 * (affecté). Ces événements transitoires ne sont pas dédupliqués : chaque
 * changement doit informer, même si le même chauffeur est ré-affecté plus tard.
 */
exports.notifyDriverChanged = async ({ sortie, oldDriverId, newDriverId }) => {
  if (oldDriverId && oldDriverId !== newDriverId) {
    await notifyRecipients({
      sortie, type: EVENT_TYPES.SORTIE_DRIVER_REMOVED,
      recipients: [oldDriverId],
      message: `Vous ne conduisez plus la sortie vers ${sortie.destination} prévue le ${new Date(sortie.departure_time).toLocaleDateString('fr-FR')} à ${new Date(sortie.departure_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}.`,
      dedupe: false,
    });
  }
  if (newDriverId && newDriverId !== oldDriverId) {
    await notifyRecipients({
      sortie, type: EVENT_TYPES.SORTIE_ASSIGNED,
      recipients: [newDriverId],
      message: buildSortieMessage(sortie, null, null),
      dedupe: false,
    });
  }
};

/**
 * Notifie un départ imminent : chauffeur + employés liés + chefs.
 * Antidoublon par (user, type='sortie_imminent', entity).
 */
exports.notifySortieImminent = async (sortie, linkedEmployeeIds) => {
  const recipients = [...(linkedEmployeeIds || []), sortie.driver_employee_id].filter(Boolean);
  await notifyRecipients({
    sortie, type: EVENT_TYPES.SORTIE_IMMINENT, recipients,
    message: `La sortie vers ${sortie.destination} commence dans quelques minutes (${new Date(sortie.departure_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}).`,
  });
  getDeps().notifyChiefs('sortie_imminent', sortie);
};

/**
 * Notifie les employés liés (chauffeur inclus) d'un changement d'état générique
 * (démarrage, fin). Type passé en argument pour rester extensible.
 */
exports.notifySortieState = async ({ sortie, type, message, recipients }) => {
  const ids = (recipients && recipients.length)
    ? recipients
    : [sortie.driver_employee_id].filter(Boolean);
  await notifyRecipients({ sortie, type, recipients: ids, message });
};

/**
 * Récupère les user_id des employés liés à une sortie via les demandes liées.
 * @returns {Promise<number[]>}
 */
exports.getLinkedEmployeeIds = async (sortie) => {
  const { models } = getDeps();
  const { SortieRequest, Request } = models;
  const links = await SortieRequest.findAll({ where: { sortie_id: sortie.id } });
  const requestIds = links.map((l) => l.request_id);
  if (requestIds.length === 0) return [];
  const requests = await Request.findAll({ where: { id: { [Op.in]: requestIds } }, attributes: ['employee_id'] });
  return [...new Set(requests.map((r) => r.employee_id))];
};

// Exposé pour tests et pour le planificateur
exports.buildSortieMessage = buildSortieMessage;
exports.EVENT_TYPES = EVENT_TYPES;
exports.IMMINENT_WINDOW_MIN = IMMINENT_WINDOW_MIN;
exports.__setDeps = __setDeps;
exports.__resetDeps = __resetDeps;
