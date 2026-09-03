'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // Requests : filtres fréquents des listes (statut, employé, véhicule, date)
    await queryInterface.addIndex('Requests', ['status']);
    await queryInterface.addIndex('Requests', ['employee_id']);
    await queryInterface.addIndex('Requests', ['vehicle_id']);
    await queryInterface.addIndex('Requests', ['date_souhaitee']);
    // Requête d'occupation : statuts actifs par véhicule + date
    await queryInterface.addIndex('Requests', ['vehicle_id', 'status', 'date_souhaitee'], { name: 'requests_vehicle_status_date' });

    // Sorties : filtres des listes + recherche de sorties compatibles (regroupement)
    await queryInterface.addIndex('Sorties', ['status']);
    await queryInterface.addIndex('Sorties', ['vehicle_id']);
    await queryInterface.addIndex('Sorties', ['departure_time']);
    // Regroupement : même véhicule + statut + destination + fenêtre de départ
    await queryInterface.addIndex('Sorties', ['vehicle_id', 'status', 'destination', 'departure_time'], { name: 'sorties_vehicle_status_dest_time' });

    // SortieRequests : jointure request <-> sortie (clé de regroupement + statut)
    await queryInterface.addIndex('SortieRequests', ['request_id']);
    await queryInterface.addIndex('SortieRequests', ['sortie_id']);
    await queryInterface.addIndex('SortieRequests', ['sortie_id', 'status'], { name: 'sortierequests_sortie_status' });

    // Notifications : lecture "mes notifications non lues" par utilisateur
    await queryInterface.addIndex('Notifications', ['user_id', 'is_read'], { name: 'notifications_user_read' });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('Requests', 'requests_vehicle_status_date');
    await queryInterface.removeIndex('Requests', 'requests_status');
    await queryInterface.removeIndex('Requests', 'requests_employee_id');
    await queryInterface.removeIndex('Requests', 'requests_vehicle_id');
    await queryInterface.removeIndex('Requests', 'requests_date_souhaitee');

    await queryInterface.removeIndex('Sorties', 'sorties_vehicle_status_dest_time');
    await queryInterface.removeIndex('Sorties', 'sorties_status');
    await queryInterface.removeIndex('Sorties', 'sorties_vehicle_id');
    await queryInterface.removeIndex('Sorties', 'sorties_departure_time');

    await queryInterface.removeIndex('SortieRequests', 'sortierequests_sortie_status');
    await queryInterface.removeIndex('SortieRequests', 'sortierequests_request_id');
    await queryInterface.removeIndex('SortieRequests', 'sortierequests_sortie_id');

    await queryInterface.removeIndex('Notifications', 'notifications_user_read');
  },
};
