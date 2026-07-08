'use strict';
const bcrypt = require('bcrypt');

module.exports = {
  async up(queryInterface) {
    const hash = await bcrypt.hash('admin123', 10);
    const hash2 = await bcrypt.hash('employee123', 10);

    // 1. Employees
    await queryInterface.bulkInsert('Employees', [
      { id: 1, nom: 'Rakoto', prenom: 'Chef', email: 'admin@logistique.com', password: hash, department: 'Logistique', role: 'logistics_chief', createdAt: new Date(), updatedAt: new Date() },
      { id: 2, nom: 'Rabe', prenom: 'Jean', email: 'employee@logistique.com', password: hash2, department: 'Transport', role: 'employee', createdAt: new Date(), updatedAt: new Date() },
      { id: 3, nom: 'Claire', prenom: 'Marie', email: 'marie.claire@logistique.com', password: hash2, department: 'Transport', role: 'employee', createdAt: new Date(), updatedAt: new Date() },
      { id: 4, nom: 'Rabenjamina', prenom: 'Pierre', email: 'pierre.raben@logistique.com', password: hash2, department: 'Maintenance', role: 'employee', createdAt: new Date(), updatedAt: new Date() },
      { id: 5, nom: 'Soa', prenom: 'Lala', email: 'lala.soa@logistique.com', password: hash2, department: 'Logistique', role: 'employee', createdAt: new Date(), updatedAt: new Date() },
    ]);

    // 2. Vehicles
    await queryInterface.bulkInsert('Vehicles', [
      { id: 1, type: 'moto', capacity: 2, status: 'available', maintenance_until: null, createdAt: new Date(), updatedAt: new Date() },
      { id: 2, type: 'voiture', capacity: 5, status: 'available', maintenance_until: null, createdAt: new Date(), updatedAt: new Date() },
      { id: 3, type: 'minibus', capacity: 15, status: 'maintenance', maintenance_until: new Date('2026-07-15'), createdAt: new Date(), updatedAt: new Date() },
      { id: 4, type: 'voiture', capacity: 5, status: 'busy', maintenance_until: null, createdAt: new Date(), updatedAt: new Date() },
    ]);

    // 3. Requests
    const now = new Date();
    const day = 86400000;
    await queryInterface.bulkInsert('Requests', [
      { id: 1, employee_id: 2, destination: 'Antananarivo', motif: 'Livraison colis urgents', date_souhaitee: new Date(now.getTime() + day), nb_personnes: 2, status: 'pending', createdAt: new Date(now.getTime() - 5 * day), updatedAt: new Date(now.getTime() - 5 * day) },
      { id: 2, employee_id: 3, destination: 'Toamasina', motif: 'Réunion partenaires', date_souhaitee: new Date(now.getTime() + 2 * day), nb_personnes: 4, status: 'approved', createdAt: new Date(now.getTime() - 4 * day), updatedAt: new Date(now.getTime() - day) },
      { id: 3, employee_id: 4, destination: 'Antananarivo', motif: 'Achat matériel bureau', date_souhaitee: new Date(now.getTime() + day), nb_personnes: 3, status: 'pending', createdAt: new Date(now.getTime() - 3 * day), updatedAt: new Date(now.getTime() - 3 * day) },
      { id: 4, employee_id: 5, destination: 'Fianarantsoa', motif: 'Formation personnel', date_souhaitee: new Date(now.getTime() + 5 * day), nb_personnes: 6, status: 'rescheduled', createdAt: new Date(now.getTime() - 2 * day), updatedAt: new Date(now.getTime() - day) },
      { id: 5, employee_id: 2, destination: 'Antsirabe', motif: 'Suivi chantier', date_souhaitee: new Date(now.getTime() - 3 * day), nb_personnes: 2, status: 'approved', createdAt: new Date(now.getTime() - 10 * day), updatedAt: new Date(now.getTime() - 6 * day) },
      { id: 6, employee_id: 3, destination: 'Mahajanga', motif: 'Inspection site', date_souhaitee: new Date(now.getTime() - 7 * day), nb_personnes: 3, status: 'rejected', createdAt: new Date(now.getTime() - 12 * day), updatedAt: new Date(now.getTime() - 8 * day) },
      { id: 7, employee_id: 4, destination: 'Toamasina', motif: 'Livraison équipement', date_souhaitee: new Date(now.getTime() + 3 * day), nb_personnes: 2, status: 'approved', createdAt: new Date(now.getTime() - day), updatedAt: new Date(now.getTime()) },
      { id: 8, employee_id: 5, destination: 'Antananarivo', motif: 'Réunion direction', date_souhaitee: new Date(now.getTime() + day), nb_personnes: 1, status: 'pending', createdAt: new Date(now.getTime()), updatedAt: new Date(now.getTime()) },
    ]);

    // 4. Sorties
    await queryInterface.bulkInsert('Sorties', [
      { id: 1, vehicle_id: 2, driver_name: 'Rakoto Chef', destination: 'Antananarivo', departure_time: new Date(now.getTime() + day), status: 'planned', departure_km: null, arrival_km: null, distance_km: null, createdAt: new Date(now.getTime() - day), updatedAt: new Date(now.getTime() - day) },
      { id: 2, vehicle_id: 4, driver_name: 'Mbola', destination: 'Toamasina', departure_time: new Date(now.getTime() - 2 * day), status: 'ongoing', departure_km: 12450, arrival_km: null, distance_km: null, createdAt: new Date(now.getTime() - 3 * day), updatedAt: new Date(now.getTime() - 2 * day) },
      { id: 3, vehicle_id: 1, driver_name: 'Koto', destination: 'Antsirabe', departure_time: new Date(now.getTime() - 5 * day), status: 'finished', departure_km: 8200, arrival_km: 8530, distance_km: 330, createdAt: new Date(now.getTime() - 6 * day), updatedAt: new Date(now.getTime() - 4 * day) },
    ]);

    // 5. SortieRequests
    await queryInterface.bulkInsert('SortieRequests', [
      { sortie_id: 1, request_id: 1, createdAt: new Date(), updatedAt: new Date() },
      { sortie_id: 1, request_id: 3, createdAt: new Date(), updatedAt: new Date() },
      { sortie_id: 1, request_id: 8, createdAt: new Date(), updatedAt: new Date() },
      { sortie_id: 2, request_id: 2, createdAt: new Date(), updatedAt: new Date() },
      { sortie_id: 2, request_id: 7, createdAt: new Date(), updatedAt: new Date() },
      { sortie_id: 3, request_id: 5, createdAt: new Date(), updatedAt: new Date() },
    ]);

    // 6. Notifications
    await queryInterface.bulkInsert('Notifications', [
      { id: 1, user_id: 2, message: 'Votre demande vers Antsirabe a été validée', type: 'approved', is_read: true, createdAt: new Date(now.getTime() - 6 * day), updatedAt: new Date(now.getTime() - 6 * day) },
      { id: 2, user_id: 3, message: 'Votre demande vers Toamasina a été validée', type: 'approved', is_read: false, createdAt: new Date(now.getTime() - day), updatedAt: new Date(now.getTime() - day) },
      { id: 3, user_id: 3, message: 'Votre demande vers Mahajanga a été refusée', type: 'rejected', is_read: true, createdAt: new Date(now.getTime() - 8 * day), updatedAt: new Date(now.getTime() - 8 * day) },
      { id: 4, user_id: 5, message: 'Votre demande vers Fianarantsoa a été replanifiée', type: 'rescheduled', is_read: false, createdAt: new Date(now.getTime() - day), updatedAt: new Date(now.getTime() - day) },
      { id: 5, user_id: 5, message: 'Votre demande a été intégrée à une sortie vers Antananarivo', type: 'sortie_assignment', is_read: false, createdAt: new Date(now.getTime()), updatedAt: new Date(now.getTime()) },
      { id: 6, user_id: 2, message: 'Votre demande a été intégrée à une sortie vers Antananarivo', type: 'sortie_assignment', is_read: false, createdAt: new Date(now.getTime()), updatedAt: new Date(now.getTime()) },
    ]);

    // Reset sequence IDs
    await queryInterface.sequelize.query("SELECT setval('\"Employees_id_seq\"', COALESCE((SELECT MAX(id) FROM \"Employees\"), 1))");
    await queryInterface.sequelize.query("SELECT setval('\"Vehicles_id_seq\"', COALESCE((SELECT MAX(id) FROM \"Vehicles\"), 1))");
    await queryInterface.sequelize.query("SELECT setval('\"Requests_id_seq\"', COALESCE((SELECT MAX(id) FROM \"Requests\"), 1))");
    await queryInterface.sequelize.query("SELECT setval('\"Sorties_id_seq\"', COALESCE((SELECT MAX(id) FROM \"Sorties\"), 1))");
    await queryInterface.sequelize.query("SELECT setval('\"SortieRequests_id_seq\"', COALESCE((SELECT MAX(id) FROM \"SortieRequests\"), 1))");
    await queryInterface.sequelize.query("SELECT setval('\"Notifications_id_seq\"', COALESCE((SELECT MAX(id) FROM \"Notifications\"), 1))");
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('SortieRequests', null, {});
    await queryInterface.bulkDelete('Notifications', null, {});
    await queryInterface.bulkDelete('Sorties', null, {});
    await queryInterface.bulkDelete('Requests', null, {});
    await queryInterface.bulkDelete('Vehicles', null, {});
    await queryInterface.bulkDelete('Employees', null, {});
  },
};
