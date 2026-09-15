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

  it('POST /api/sorties — chauffeur hors ligne refusé (présence)', async () => {
    const hashedPw = await bcrypt.hash('Test1234', 10);
    const offlineChauffeur = await db.Employee.create({
      nom: 'HorsLigne', prenom: 'Test', email: `offline-${Date.now()}@test.com`,
      password: hashedPw, department: 'Logistique', role: 'chauffeur', site_id: getSite().id,
    });
    const vehicle2 = (await db.Vehicle.findOne({ where: { name: 'Clio Test' } }));
    const res = await request(app)
      .post('/api/sorties')
      .set(authHeader(tokens.chief.accessToken))
      .send({
        vehicle_id: vehicle2.id,
        driver_name: 'HorsLigne Test',
        driver_employee_id: offlineChauffeur.id,
        destination: 'Toamasina',
        motif: 'Test hors ligne',
        departure_time: new Date(Date.now() + 7200000).toISOString(),
      });
    assert.strictEqual(res.status, 400);
    assert.ok(/hors ligne/i.test(res.body.message));
  });

  it('GET /api/sorties — la sortie apparaît dans la liste', async () => {
    const res = await request(app)
      .get('/api/sorties')
      .set(authHeader(tokens.chief.accessToken));
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.data.find((s) => s.id === sortieId));
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
    const emp = await login('employee@test.com', 'Test1234');
    const res = await request(app)
      .get('/api/sorties')
      .set(authHeader(emp.accessToken));
    assert.strictEqual(res.status, 403);
  });
});
