'use strict';
const bcrypt = require('bcrypt');

module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkDelete('SortieRequests', null, {});
    await queryInterface.bulkDelete('Notifications', null, {});
    await queryInterface.bulkDelete('Sorties', null, {});
    await queryInterface.bulkDelete('Requests', null, {});
    await queryInterface.bulkDelete('Vehicles', null, {});
    await queryInterface.bulkDelete('Employees', null, {});

    const hash = await bcrypt.hash('admin123', 10);
    const hash2 = await bcrypt.hash('employee123', 10);
    const hash3 = await bcrypt.hash('Ades', 10);
    const now = new Date();
    const d = 86400000;

    // ── 1. EMPLOYEES ──────────────────────────────────────────
    await queryInterface.bulkInsert('Employees', [
      { id: 1, nom: 'Admin-IT', prenom: '',       email: 'admin@logistique.com',       password: hash3, department: 'IT',         role: 'superadmin',   createdAt: new Date(now - 30*d), updatedAt: new Date(now - 30*d) },
      { id: 2, nom: 'Rakoto',    prenom: 'Chef',    email: 'chef@logistique.com',        password: hash,  department: 'Logistique',  role: 'logistics_chief', createdAt: new Date(now - 30*d), updatedAt: new Date(now - 30*d) },
      { id: 3, nom: 'Rabe',      prenom: 'Jean',    email: 'employee@logistique.com',    password: hash2, department: 'Transport',   role: 'employee', createdAt: new Date(now - 30*d), updatedAt: new Date(now - 30*d) },
      { id: 4, nom: 'Claire',    prenom: 'Marie',   email: 'marie.claire@logistique.com', password: hash2, department: 'Transport',   role: 'employee', createdAt: new Date(now - 30*d), updatedAt: new Date(now - 30*d) },
      { id: 5, nom: 'Rabenjamina', prenom: 'Pierre', email: 'pierre.raben@logistique.com', password: hash2, department: 'Maintenance', role: 'employee', createdAt: new Date(now - 30*d), updatedAt: new Date(now - 30*d) },
      { id: 6, nom: 'Soa',       prenom: 'Lala',    email: 'lala.soa@logistique.com',    password: hash2, department: 'Logistique',  role: 'employee', createdAt: new Date(now - 30*d), updatedAt: new Date(now - 30*d) },
    ]);

    // ── 2. VEHICLES ───────────────────────────────────────────
    // Une demande approuvée avec vehicle_id → sortie auto-créée
    // Les statuts ici reflètent l'état final après les seeds
    await queryInterface.bulkInsert('Vehicles', [
      { id: 1, type: 'moto',    capacity: 2,  status: 'available',   maintenance_until: null,                     createdAt: new Date(now - 30*d), updatedAt: new Date(now - 3*d) },
      { id: 2, type: 'voiture', capacity: 5,  status: 'busy',        maintenance_until: null,                     createdAt: new Date(now - 30*d), updatedAt: new Date(now - d)     },
      { id: 3, type: 'minibus', capacity: 15, status: 'maintenance', maintenance_until: new Date(now + 20*d),    createdAt: new Date(now - 30*d), updatedAt: new Date(now - 30*d) },
      { id: 4, type: 'voiture', capacity: 5,  status: 'busy',        maintenance_until: null,                     createdAt: new Date(now - 20*d), updatedAt: new Date(now - d)     },
    ]);

    // ── 3. REQUESTS ───────────────────────────────────────────
    // Règle : une demande approuvée avec vehicle_id DOIT avoir une sortie correspondante
    //   (que le contrôleur créerait automatiquement — le seed la crée manuellement)
    // Les demandes pending / rejected / cancelled / rescheduled n'ont PAS de sortie
    await queryInterface.bulkInsert('Requests', [
      // ── En attente (pending) ── sans véhicule, pas de sortie ──
      { id: 1,  employee_id: 3, destination: 'Antananarivo', motif: 'Livraison colis urgents',  date_souhaitee: new Date(now + d),     nb_personnes: 2, status: 'pending',    vehicle_id: null, createdAt: new Date(now - 5*d), updatedAt: new Date(now - 5*d) },
      { id: 3,  employee_id: 5, destination: 'Antananarivo', motif: 'Achat matériel bureau',     date_souhaitee: new Date(now + d),     nb_personnes: 3, status: 'pending',    vehicle_id: null, createdAt: new Date(now - 3*d), updatedAt: new Date(now - 3*d) },
      { id: 8,  employee_id: 6, destination: 'Antananarivo', motif: 'Réunion direction',         date_souhaitee: new Date(now + d),     nb_personnes: 1, status: 'pending',    vehicle_id: null, createdAt: new Date(now),        updatedAt: new Date(now) },

      // ── Approuvées (approved) ── avec véhicule → créent des sorties ──
      // #2 + #7 : même destination, même véhicule, même créneau → regroupées dans Sortie #1
      { id: 2,  employee_id: 4, destination: 'Toamasina',    motif: 'Réunion partenaires',       date_souhaitee: new Date(now + 2*d),   nb_personnes: 4, status: 'approved',   vehicle_id: 2,   createdAt: new Date(now - 4*d), updatedAt: new Date(now - d)     },
      { id: 7,  employee_id: 5, destination: 'Toamasina',    motif: 'Livraison équipement',      date_souhaitee: new Date(now + 2*d),   nb_personnes: 2, status: 'approved',   vehicle_id: 2,   createdAt: new Date(now - d),     updatedAt: new Date(now) },
      // #5 : sortie passée terminée
      { id: 5,  employee_id: 2, destination: 'Antsirabe',    motif: 'Suivi chantier',             date_souhaitee: new Date(now - 3*d),   nb_personnes: 2, status: 'approved',   vehicle_id: 1,   createdAt: new Date(now - 10*d), updatedAt: new Date(now - 6*d) },
      // #9 : sortie en cours
      { id: 9,  employee_id: 4, destination: 'Toliary',      motif: 'Inspection chantier',        date_souhaitee: new Date(now - d),     nb_personnes: 3, status: 'approved',   vehicle_id: 4,   createdAt: new Date(now - 7*d), updatedAt: new Date(now - 4*d) },

      // ── Refusée (rejected) ──
      { id: 6,  employee_id: 4, destination: 'Mahajanga',    motif: 'Inspection site',            date_souhaitee: new Date(now - 7*d),   nb_personnes: 3, status: 'rejected',   vehicle_id: null, createdAt: new Date(now - 12*d), updatedAt: new Date(now - 8*d) },

      // ── Annulée (cancelled) ──
      { id: 10, employee_id: 5, destination: 'Antsirabe',    motif: 'Visite fournisseur',         date_souhaitee: new Date(now - d),     nb_personnes: 2, status: 'cancelled',  vehicle_id: null, createdAt: new Date(now - 9*d), updatedAt: new Date(now - 3*d) },

      // ── Replanifiée (rescheduled) ──
      { id: 4,  employee_id: 6, destination: 'Fianarantsoa', motif: 'Formation personnel',        date_souhaitee: new Date(now + 5*d),   nb_personnes: 6, status: 'rescheduled', vehicle_id: null, createdAt: new Date(now - 2*d), updatedAt: new Date(now - d) },
    ]);

    // ── 4. SORTIES ────────────────────────────────────────────
    // Chaque demande approuvée avec vehicle_id a sa sortie (ou partage une sortie groupée)
    await queryInterface.bulkInsert('Sorties', [
      // Sortie #1 (planned) : Toamasina, veh#2 — regroupe les demandes #2 + #7
      { id: 1, vehicle_id: 2, driver_name: 'Mbola', destination: 'Toamasina', departure_time: new Date(now + 2*d), status: 'planned', departure_km: null, arrival_km: null, distance_km: null, createdAt: new Date(now - d), updatedAt: new Date(now - d) },
      // Sortie #2 (ongoing) : Toliary, veh#4 — liée à la demande #9
      { id: 2, vehicle_id: 4, driver_name: 'Koto', destination: 'Toliary', departure_time: new Date(now - d), status: 'ongoing', departure_km: 15600, arrival_km: null, distance_km: null, createdAt: new Date(now - 4*d), updatedAt: new Date(now - d) },
      // Sortie #3 (finished) : Antsirabe, veh#1 — liée à la demande #5
      { id: 3, vehicle_id: 1, driver_name: 'Bema', destination: 'Antsirabe', departure_time: new Date(now - 3*d), status: 'finished', departure_km: 8200, arrival_km: 8530, distance_km: 330, createdAt: new Date(now - 6*d), updatedAt: new Date(now - 3*d) },
    ]);

    // ── 5. SORTIE_REQUESTS (jonction) ─────────────────────────
    await queryInterface.bulkInsert('SortieRequests', [
      { sortie_id: 1, request_id: 2, createdAt: new Date(), updatedAt: new Date() },
      { sortie_id: 1, request_id: 7, createdAt: new Date(), updatedAt: new Date() },
      { sortie_id: 2, request_id: 9, createdAt: new Date(), updatedAt: new Date() },
      { sortie_id: 3, request_id: 5, createdAt: new Date(), updatedAt: new Date() },
    ]);

    // ── 6. NOTIFICATIONS ──────────────────────────────────────
    await queryInterface.bulkInsert('Notifications', [
      { id: 1, user_id: 3, message: 'Votre demande vers Antsirabe a été validée',                          type: 'approved',         is_read: true,  createdAt: new Date(now - 6*d), updatedAt: new Date(now - 6*d) },
      { id: 2, user_id: 4, message: 'Votre demande vers Toamasina a été validée',                          type: 'approved',         is_read: false, createdAt: new Date(now - d),     updatedAt: new Date(now - d) },
      { id: 3, user_id: 4, message: 'Votre demande vers Mahajanga a été refusée',                          type: 'rejected',         is_read: true,  createdAt: new Date(now - 8*d), updatedAt: new Date(now - 8*d) },
      { id: 4, user_id: 5, message: 'Votre demande vers Toamasina a été validée',                          type: 'approved',         is_read: false, createdAt: new Date(now),        updatedAt: new Date(now) },
      { id: 5, user_id: 5, message: 'Votre demande a été intégrée à une sortie vers Toamasina',             type: 'sortie_assignment', is_read: false, createdAt: new Date(now),        updatedAt: new Date(now) },
      { id: 6, user_id: 4, message: 'Votre demande a été intégrée à une sortie vers Toliary',               type: 'sortie_assignment', is_read: false, createdAt: new Date(now - d),     updatedAt: new Date(now - d) },
      { id: 7, user_id: 6, message: 'Votre demande vers Fianarantsoa a été replanifiée',                   type: 'rescheduled',     is_read: false, createdAt: new Date(now - d),     updatedAt: new Date(now - d) },
      { id: 8, user_id: 5, message: 'Votre demande vers Antsirabe a été annulée',                           type: 'cancelled',       is_read: true,  createdAt: new Date(now - 3*d), updatedAt: new Date(now - 3*d) },
      { id: 9, user_id: 4, message: 'Votre demande a été intégrée à une sortie vers Toamasina',             type: 'sortie_assignment', is_read: false, createdAt: new Date(now - d),     updatedAt: new Date(now - d) },
    ]);

    // Reset séquences PostgreSQL
    await queryInterface.sequelize.query("SELECT setval('\"Employees_id_seq\"', COALESCE((SELECT MAX(id) FROM \"Employees\"), 6))");
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
