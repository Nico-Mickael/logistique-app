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
