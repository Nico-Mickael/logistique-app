const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const bcrypt = require('bcrypt');
const { app, request, db, seed, login, authHeader, close, loginAll, getSite } = require('../integration/helpers');

describe('Flux Sorties (intégration)', () => {
  let tokens, sortieId, vehicleId;

  before(async () => {
    await seed();
    tokens = await loginAll();
  });

  after(async () => { await close(); });

  it('POST /api/sorties — chef crée une sortie', async () => {
    const chauffeur = await db.Employee.findOne({ where: { role: 'chauffeur' } });
    const vehicle = (await db.Vehicle.findOne({ order: [['id', 'ASC']] }));
    vehicleId = vehicle.id;
    const res = await request(app)
      .post('/api/sorties')
      .set(authHeader(tokens.chief.accessToken))
      .send({
        vehicle_id: vehicle.id,
        driver_name: 'Chauffeur Test',
        driver_employee_id: chauffeur.id,
        destination: 'Antsirabe',
        motif: 'Transport équipe',
        departure_time: new Date(Date.now() + 3600000).toISOString(),
      });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.status, 'planned');
    assert.strictEqual(res.body.destination, 'Antsirabe');
    sortieId = res.body.id;
  });

  it('POST /api/sorties — chauffeur déclaré indisponible refusé (disponibilité)', async () => {
    const hashedPw = await bcrypt.hash('Test1234', 10);
    // L'assignation dépend de la disponibilité DÉCLARÉE, pas de la connexion :
    // un chauffeur disponible mais non connecté reste assignable ; un chauffeur
    // déclaré indisponible (ici 'offline') ne l'est plus.
    const offlineChauffeur = await db.Employee.create({
      nom: 'Indispo', prenom: 'Test', email: `offline-${Date.now()}@test.com`,
      password: hashedPw, department: 'Logistique', role: 'chauffeur', site_id: getSite().id,
      availability_status: 'offline',
    });
    const vehicle2 = (await db.Vehicle.findOne({ where: { name: 'Clio Test' } }));
    const res = await request(app)
      .post('/api/sorties')
      .set(authHeader(tokens.chief.accessToken))
      .send({
        vehicle_id: vehicle2.id,
        driver_name: 'Indispo Test',
        driver_employee_id: offlineChauffeur.id,
        destination: 'Toamasina',
        motif: 'Test indisponible',
        departure_time: new Date(Date.now() + 7200000).toISOString(),
      });
    assert.strictEqual(res.status, 400);
    assert.ok(/indisponible/i.test(res.body.message));
  });

  it('POST /api/sorties — chauffeur en congé refusé (période active)', async () => {
    const hashedPw = await bcrypt.hash('Test1234', 10);
    const today = new Date();
    const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const start = new Date(today);
    start.setDate(today.getDate() - 1);
    const end = new Date(today);
    end.setDate(today.getDate() + 5);
    const leaveChauffeur = await db.Employee.create({
      nom: 'EnCongé', prenom: 'Test', email: `leave-${Date.now()}@test.com`,
      password: hashedPw, department: 'Logistique', role: 'chauffeur', site_id: getSite().id,
      availability_status: 'on_leave',
      leave_start_date: fmt(start),
      leave_end_date: fmt(end),
    });
    const vehicle2 = (await db.Vehicle.findOne({ where: { name: 'Clio Test' } }));
    const res = await request(app)
      .post('/api/sorties')
      .set(authHeader(tokens.chief.accessToken))
      .send({
        vehicle_id: vehicle2.id,
        driver_name: 'EnCongé Test',
        driver_employee_id: leaveChauffeur.id,
        destination: 'Toliara',
        motif: 'Test congé',
        departure_time: new Date(Date.now() + 7200000).toISOString(),
      });
    assert.strictEqual(res.status, 400);
    assert.ok(/indisponible/i.test(res.body.message));
  });

  it('POST /api/sorties — chauffeur dont le congé est terminé accepté (auto-retour)', async () => {
    const hashedPw = await bcrypt.hash('Test1234', 10);
    const today = new Date();
    const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const end = new Date(today);
    end.setDate(today.getDate() - 1);
    const returnedChauffeur = await db.Employee.create({
      nom: 'Retour', prenom: 'Test', email: `return-${Date.now()}@test.com`,
      password: hashedPw, department: 'Logistique', role: 'chauffeur', site_id: getSite().id,
      availability_status: 'on_leave',
      leave_start_date: fmt(new Date(end.getFullYear(), end.getMonth(), end.getDate() - 10)),
      leave_end_date: fmt(end),
    });
    const vehicle2 = (await db.Vehicle.findOne({ where: { name: 'Clio Test' } }));
    const res = await request(app)
      .post('/api/sorties')
      .set(authHeader(tokens.chief.accessToken))
      .send({
        vehicle_id: vehicle2.id,
        driver_name: 'Retour Test',
        driver_employee_id: returnedChauffeur.id,
        destination: 'Morondava',
        motif: 'Retour de congé',
        departure_time: new Date(Date.now() + 7200000).toISOString(),
      });
    assert.strictEqual(res.status, 201, JSON.stringify(res.body));
  });

  it('POST /api/sorties — chauffeur disponible mais non connecté accepté (pas de présence)', async () => {
    const hashedPw = await bcrypt.hash('Test1234', 10);
    // Un chauffeur jamais connecté (aucune session/socket) doit rester assignable :
    // sa disponibilité par défaut est 'available'.
    const freshChauffeur = await db.Employee.create({
      nom: 'Farmeur', prenom: 'Test', email: `fresh-${Date.now()}@test.com`,
      password: hashedPw, department: 'Logistique', role: 'chauffeur', site_id: getSite().id,
    });
    const vehicle2 = (await db.Vehicle.findOne({ where: { name: 'Clio Test' } }));
    const res = await request(app)
      .post('/api/sorties')
      .set(authHeader(tokens.chief.accessToken))
      .send({
        vehicle_id: vehicle2.id,
        driver_name: 'Farmeur Test',
        driver_employee_id: freshChauffeur.id,
        destination: 'Antsiranana',
        motif: 'Non connecté mais disponible',
        departure_time: new Date(Date.now() + 7200000).toISOString(),
      });
    assert.strictEqual(res.status, 201, JSON.stringify(res.body));
  });

  it('GET /api/sorties — la sortie apparaît dans la liste', async () => {
    const res = await request(app)
      .get('/api/sorties')
      .set(authHeader(tokens.chief.accessToken));
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.data.find((s) => s.id === sortieId));
  });

  it('POST /api/sorties/:id/join — employé rejoint une sortie planifiée future', async () => {
    const futureVehicle = (await db.Vehicle.findOne({ order: [['id', 'ASC']] }));
    const createRes = await request(app)
      .post('/api/sorties')
      .set(authHeader(tokens.chief.accessToken))
      .send({
        vehicle_id: futureVehicle.id,
        driver_name: 'Chauffeur Test',
        destination: 'Fianarantsoa',
        motif: 'Tournée future',
        departure_time: new Date(Date.now() + 86400000).toISOString(),
      });
    assert.strictEqual(createRes.status, 201);

    const res = await request(app)
      .post(`/api/sorties/${createRes.body.id}/join`)
      .set(authHeader(tokens.employee.accessToken))
      .send({ nb_personnes: 1 });
    assert.strictEqual(res.status, 201);

    const prepNotifs = await db.Notification.findAll({ where: { type: 'sortie_prepare' } });
    assert.strictEqual(prepNotifs.length, 0, 'pas de notification "préparez-vous" pour une sortie future');
  });

  it('POST /api/sorties/:id/join — refusé quand le départ est déjà dépassé', async () => {
    const pastVehicle = (await db.Vehicle.findOne({ order: [['id', 'ASC']] }));
    const createRes = await request(app)
      .post('/api/sorties')
      .set(authHeader(tokens.chief.accessToken))
      .send({
        vehicle_id: pastVehicle.id,
        driver_name: 'Chauffeur Test',
        destination: 'Mahajanga',
        motif: 'Sortie déjà partie',
        departure_time: new Date(Date.now() - 3600000).toISOString(),
      });
    assert.strictEqual(createRes.status, 201);

    const res = await request(app)
      .post(`/api/sorties/${createRes.body.id}/join`)
      .set(authHeader(tokens.employee.accessToken))
      .send({ nb_personnes: 1 });
    assert.strictEqual(res.status, 400);
    assert.ok(/déjà passé/i.test(res.body.message));
    const links = await db.SortieRequest.findAll({ where: { sortie_id: createRes.body.id } });
    assert.strictEqual(links.length, 0, 'aucune demande créée/liée');
  });

  it('POST /api/sorties/:id/join — autorisé dans la tolérance de 20 min après le départ', async () => {
    const graceVehicle = (await db.Vehicle.findOne({ order: [['id', 'ASC']] }));
    const createRes = await request(app)
      .post('/api/sorties')
      .set(authHeader(tokens.chief.accessToken))
      .send({
        vehicle_id: graceVehicle.id,
        driver_name: 'Chauffeur Test',
        destination: 'Antsirabe',
        motif: 'Moto 5 min de retard',
        departure_time: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      });
    assert.strictEqual(createRes.status, 201);

    const res = await request(app)
      .post(`/api/sorties/${createRes.body.id}/join`)
      .set(authHeader(tokens.employee.accessToken))
      .send({ nb_personnes: 1 });
    assert.strictEqual(res.status, 201);

    const prepNotifs = await db.Notification.findAll({ where: { type: 'sortie_prepare' } });
    assert.strictEqual(prepNotifs.length, 1, 'la notification "préparez-vous" est envoyée à l\'employé qui rejoint dans la tolérance');
    assert.ok(/20 minutes/.test(prepNotifs[0].message));
  });

  it('GET /api/sorties/planned — exclut les sorties dont le départ est dépassé', async () => {
    const pastVehicle = (await db.Vehicle.findOne({ order: [['id', 'ASC']] }));
    const pastSortie = await request(app)
      .post('/api/sorties')
      .set(authHeader(tokens.chief.accessToken))
      .send({
        vehicle_id: pastVehicle.id,
        driver_name: 'Chauffeur Test',
        destination: 'Toamasina',
        motif: 'Déjà partie',
        departure_time: new Date(Date.now() - 7200000).toISOString(),
      });
    assert.strictEqual(pastSortie.status, 201);

    // Une sortie partie depuis 10 min (≤ tolérance 20 min) reste disponible
    const graceVehicle = (await db.Vehicle.findOne({ order: [['id', 'ASC']] }));
    const graceSortie = await request(app)
      .post('/api/sorties')
      .set(authHeader(tokens.chief.accessToken))
      .send({
        vehicle_id: graceVehicle.id,
        driver_name: 'Chauffeur Test',
        destination: 'Tamatave',
        motif: 'Retard toléré',
        departure_time: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      });
    assert.strictEqual(graceSortie.status, 201);

    const res = await request(app)
      .get('/api/sorties/planned')
      .set(authHeader(tokens.employee.accessToken));
    assert.strictEqual(res.status, 200);
    assert.ok(!res.body.find((s) => s.id === pastSortie.body.id), 'la sortie déjà partie (2 h) ne doit plus apparaître');
    assert.ok(res.body.find((s) => s.id === graceSortie.body.id), 'la sortie avec retard ≤ 20 min doit rester disponible');
  });

  it('PUT /api/sorties/:id — chef modifie la sortie planifiée', async () => {
    const res = await request(app)
      .put(`/api/sorties/${sortieId}`)
      .set(authHeader(tokens.chief.accessToken))
      .send({ destination: 'Antsirabe Centre', motif: 'Transport modifié' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.destination, 'Antsirabe Centre');
  });

  it('PATCH /api/sorties/:id/depart — chef enregistre le départ', async () => {
    const res = await request(app)
      .patch(`/api/sorties/${sortieId}/depart`)
      .set(authHeader(tokens.chief.accessToken))
      .send({ departure_km: 10000 });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'ongoing');
    assert.strictEqual(res.body.departure_km, 10000);
  });

  it('PATCH /api/sorties/:id/status — chef passe à pending_return', async () => {
    const res = await request(app)
      .patch(`/api/sorties/${sortieId}/status`)
      .set(authHeader(tokens.chief.accessToken))
      .send({ status: 'pending_return' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'pending_return');
  });

  it('PATCH /api/sorties/:id/validate-return — chef valide le retour', async () => {
    const res = await request(app)
      .patch(`/api/sorties/${sortieId}/validate-return`)
      .set(authHeader(tokens.chief.accessToken));
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'finished');
  });

  it('GET /api/sorties/last/:vehicleId — dernière sortie d\'un véhicule', async () => {
    const res = await request(app)
      .get(`/api/sorties/last/${vehicleId}`)
      .set(authHeader(tokens.chief.accessToken));
    assert.strictEqual(res.status, 200);
    assert.ok(res.body);
  });

  it('DELETE /api/sorties/:id — supprime une sortie terminée (soft delete)', async () => {
    const res = await request(app)
      .delete(`/api/sorties/${sortieId}`)
      .set(authHeader(tokens.chief.accessToken));
    assert.strictEqual(res.status, 200);
    // Sortie should be soft-deleted (deleted_at set)
    const sortie = await db.Sortie.findByPk(sortieId);
    assert.ok(sortie.deleted_at);
  });

  it('GET /api/sorties — la sortie supprimée n\'apparaît plus', async () => {
    const res = await request(app)
      .get('/api/sorties')
      .set(authHeader(tokens.chief.accessToken));
    assert.ok(!res.body.data.find((s) => s.id === sortieId));
  });

  it('GET /api/stats/kilometrage — mais reste dans l\'historique', async () => {
    const res = await request(app)
      .get('/api/stats/kilometrage?year=2026')
      .set(authHeader(tokens.chief.accessToken));
    assert.strictEqual(res.status, 200);
  });

  it('GET /api/sorties — employé sans rôle chef est refusé', async () => {
    const res = await request(app)
      .get('/api/sorties')
      .set(authHeader(tokens.employee.accessToken));
    assert.strictEqual(res.status, 403);
  });
});
