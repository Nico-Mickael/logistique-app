// Statut "affiché" dynamique d'une sortie. Source unique de vérité partagée
// entre contrôleurs (sortie + chauffeur) et le frontend (labels correspondants
// dans frontend/src/utils/labels.js).
//
// Règle : à partir du statut réel et de la date de départ, on déduit un statut
// "lisible" immédiatement compréhensible par l'utilisateur.
function computeDisplayStatus(sortie) {
  const now = new Date();
  const departure = new Date(sortie.departure_time);
  const diffMs = departure.getTime() - now.getTime();
  const diffMin = Math.round(diffMs / 60000);
  const dateLabel = departure.toLocaleDateString('fr-FR');

  if (sortie.status === 'finished') return { key: 'finished', label: 'Sortie terminée', color: 'gray' };
  if (sortie.status === 'ongoing') return { key: 'ongoing', label: 'Sortie en cours', color: 'brand' };
  if (sortie.status === 'pending_return') return { key: 'pending_return', label: 'Retour à valider', color: 'orange' };

  // planned
  if (diffMin < 0) return { key: 'planned', label: `Départ prévu le ${dateLabel} (dépassé)`, color: 'red' };
  if (diffMin <= 30) return { key: 'imminent', label: 'Sortie dans quelques minutes', color: 'orange' };
  if (diffMin <= 60) return { key: 'soon', label: `Départ dans ${diffMin} min`, color: 'brandYellow' };
  return { key: 'planned', label: `Sortie prévue le ${dateLabel}`, color: 'gray' };
}

module.exports = { computeDisplayStatus };