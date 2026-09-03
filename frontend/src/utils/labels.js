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
  planned: 'Planifiée',
  ongoing: 'En cours',
  pending_return: 'Retour à valider',
  finished: 'Terminée',
};

export const sortieStatusColor = {
  planned: 'gray',
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

export const sortieStatusAccent = {
  planned: 'var(--mantine-color-gray-5)',
  ongoing: 'var(--mantine-color-brand-6)',
  pending_return: 'var(--mantine-color-orange-6)',
  finished: 'var(--mantine-color-brandYellow-6)',
};
