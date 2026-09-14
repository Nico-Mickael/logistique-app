import { vehicleDisplayName } from './labels';

export const vehicleOptionsFor = (vehicles, sortie) => vehicles
  .filter((v) => v.status === 'available' || v.id === sortie.vehicle_id)
  .map((v) => ({ value: String(v.id), label: `${vehicleDisplayName(v)} (${v.capacity} pers.)` }));

export const chauffeurOptions = (chauffeurs) =>
  chauffeurs.map((c) => ({ value: String(c.id), label: `${c.prenom} ${c.nom}`.trim() }));