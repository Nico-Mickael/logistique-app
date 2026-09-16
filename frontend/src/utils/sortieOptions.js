import { vehicleDisplayName, availabilityStatusLabel, availabilityStatusDot } from './labels';

export const vehicleOptionsFor = (vehicles, sortie) => vehicles
  .filter((v) => v.status === 'available' || v.id === sortie.vehicle_id)
  .map((v) => ({ value: String(v.id), label: `${vehicleDisplayName(v)} (${v.capacity} pers.)` }));

// Options chauffeur pour l'affectation : les disponibles (availability_status
// effectif renvoyé par l'API) d'abord, les autres désactivés. La disponibilité
// déclarée prime sur l'état de connexion : un chauffeur non connecté mais
// disponible reste sélectionnable.
export const chauffeurOptions = (chauffeurs) => {
  const rank = (c) => ((c.availability_status || 'available') === 'available' ? 0 : 1);
  return [...(chauffeurs || [])]
    .sort((a, b) => rank(a) - rank(b) || a.nom.localeCompare(b.nom) || a.prenom.localeCompare(b.prenom))
    .map((c) => {
      const status = c.availability_status || 'available';
      return {
        value: String(c.id),
        label: `${c.prenom} ${c.nom}`.trim(),
        disabled: status !== 'available',
        availability: status,
        statusLabel: availabilityStatusLabel[status] || status,
        dot: availabilityStatusDot[status] || '#9098a3',
      };
    });
};