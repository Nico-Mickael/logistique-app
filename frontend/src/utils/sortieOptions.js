import { vehicleDisplayName } from './labels';

export const vehicleOptionsFor = (vehicles, sortie) => vehicles
  .filter((v) => v.status === 'available' || v.id === sortie.vehicle_id)
  .map((v) => ({ value: String(v.id), label: `${vehicleDisplayName(v)} (${v.capacity} pers.)` }));

// Options chauffeur pour l'affectation : en ligne d'abord, hors ligne désactivés.
// isOnline(id) → prédicat de présence temps réel (socket) ; on le fusionne à la
// source HTTP (c.online) pour être exact dès le premier rendu.
export const chauffeurOptions = (chauffeurs, isOnline = () => false) => {
  const withPresence = (chauffeurs || []).map((c) => ({
    ...c,
    present: Boolean(c.online) || (typeof isOnline === 'function' && isOnline(c.id)),
  }));
  return [...withPresence]
    .sort((a, b) => (b.present - a.present) || a.nom.localeCompare(b.nom) || a.prenom.localeCompare(b.prenom))
    .map((c) => ({
      value: String(c.id),
      label: `${c.prenom} ${c.nom}`.trim(),
      disabled: !c.present,
      online: c.present,
    }));
};