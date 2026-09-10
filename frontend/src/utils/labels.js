// Libellés et couleurs Mantine par statut métier (source unique).

export const requestStatusLabel = {
  pending: 'En attente',
  approved: 'Validée',
  rescheduled: 'Replanifiée',
  rejected: 'Refusée',
  cancelled: 'Annulée',
};

export const requestStatusColor = {
  pending: 'gray',
  approved: 'brand',
  rescheduled: 'brandYellow',
  rejected: 'red',
  cancelled: 'gray',
};

export const sortieStatusLabel = {
  planned: 'Sortie prévue',
  imminent: 'Sortie imminente',
  soon: 'Bientôt',
  ongoing: 'Sortie en cours',
  pending_return: 'Retour à valider',
  finished: 'Sortie terminée',
  cancelled: 'Annulée',
};

export const sortieStatusColor = {
  planned: 'gray',
  imminent: 'orange',
  soon: 'brandYellow',
  ongoing: 'brand',
  pending_return: 'orange',
  finished: 'brandYellow',
};

export const vehicleStatusLabel = {
  available: 'Disponible',
  busy: 'En sortie',
  maintenance: 'Maintenance',
  broken: 'En panne',
};

export const vehicleStatusColor = {
  available: 'brand',
  busy: 'brandYellow',
  maintenance: 'red',
  broken: 'red',
};

export const PIE_COLORS = {
  pending: 'gray.5',
  approved: 'brand.6',
  rescheduled: 'brandYellow',
  rejected: 'red.6',
  cancelled: 'gray.3',
};

export const VEHICLE_TYPE_OPTIONS = [
  { value: 'moto', label: 'Moto' },
  { value: 'voiture', label: 'Voiture' },
  { value: 'minibus', label: 'Minibus' },
];

// Nom d'affichage d'un véhicule : le nom si renseigné, sinon le type capitalisé.
export const vehicleDisplayName = (vehicle) => {
  if (!vehicle) return '—';
  const name = (vehicle.name || '').trim();
  if (name) return name;
  const type = (vehicle.type || '').trim();
  if (!type) return '—';
  return type.charAt(0).toUpperCase() + type.slice(1);
};

export const sortieStatusAccent = {
  planned: 'var(--mantine-color-gray-5)',
  imminent: 'var(--mantine-color-orange-6)',
  soon: 'var(--mantine-color-brandYellow-6)',
  ongoing: 'var(--mantine-color-brand-6)',
  pending_return: 'var(--mantine-color-orange-6)',
  finished: 'var(--mantine-color-brandYellow-6)',
};
