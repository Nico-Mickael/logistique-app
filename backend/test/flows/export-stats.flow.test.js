const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const { app, request, db, seed, authHeader, close, loginAll } = require('../integration/helpers');

describe('Flux Stats & Exports (intégration)', () => {
  let tokens;

  before(async () => {
    await seed();
    tokens = await loginAll();
  });

  after(async () => { await close(); });

  it('GET /api/stats/overview — vue d\'ensemble', async () => {
    const res = await request(app)
      .get('/api/stats/overview?year=2026')
      .set(authHeader(tokens.chief.accessToken));
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.requests);
    assert.ok(res.body.sorties);
    assert.ok(res.body.vehicles);
    assert.ok(Array.isArray(res.body.kmByMonth));
    assert.ok(Array.isArray(res.body.topDestinations));
  });

  it('GET /api/stats/mine — stats personnelles employé', async () => {
    const res = await request(app)
      .get('/api/stats/mine?year=2026')
      .set(authHeader(tokens.employee.accessToken));
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.requests);
    assert.ok(Array.isArray(res.body.kmByMonth));
  });

  it('GET /api/stats/kilometrage — historique kilométrique', async () => {
    const res = await request(app)
      .get('/api/stats/kilometrage?year=2026')
      .set(authHeader(tokens.chief.accessToken));
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body));
  });

  it('GET /api/stats/fleet — santé de la flotte', async () => {
    const res = await request(app)
      .get('/api/stats/fleet')
      .set(authHeader(tokens.chief.accessToken));
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.vehicles);
    assert.ok(res.body.fuel);
  });

  it('GET /api/stats/overview — employé sans rôle chef refusé', async () => {
    const res = await request(app)
      .get('/api/stats/overview')
      .set(authHeader(tokens.employee.accessToken));
    assert.strictEqual(res.status, 403);
  });

  it('GET /api/stats/badges — compteurs sidebar (demandes + sorties)', async () => {
    const before = (await request(app)
      .get('/api/stats/badges')
      .set(authHeader(tokens.superadmin.accessToken))).body;
    assert.ok(Number.isInteger(before.requests));
    assert.ok(Number.isInteger(before.sorties));

    // Une demande en attente incrémente le badge "Demandes"…
    const vehicle = (await db.Vehicle.findOne({ order: [['id', 'ASC']] }));
    const created = await request(app)
      .post('/api/requests')
      .set(authHeader(tokens.employee.accessToken))
      .send({
        destination: 'Ambositra',
        motif: 'Badge test',
        date_souhaitee: new Date(Date.now() + 86400000 * 3).toISOString(),
        nb_personnes: 1,
        vehicle_id: vehicle.id,
      });
    assert.strictEqual(created.status, 201);

    const after = (await request(app)
      .get('/api/stats/badges')
      .set(authHeader(tokens.superadmin.accessToken))).body;
    assert.strictEqual(after.requests, before.requests + 1);

    // …et une fois validée, le badge "Demandes" décrémente.
    const approved = await request(app)
      .patch(`/api/requests/${created.body.id}/status`)
      .set(authHeader(tokens.chief.accessToken))
      .send({ status: 'approved' });
    assert.strictEqual(approved.status, 200);

    const final = (await request(app)
      .get('/api/stats/badges')
      .set(authHeader(tokens.superadmin.accessToken))).body;
    assert.strictEqual(final.requests, before.requests);
  });

  it('GET /api/export/fleet — export XLSX flotte', async () => {
    const res = await request(app)
      .get('/api/export/fleet')
      .set(authHeader(tokens.chief.accessToken));
    assert.strictEqual(res.status, 200);
    assert.ok(res.headers['content-type'].includes('spreadsheetml') || res.headers['content-type'].includes('csv'));
  });

  it('GET /api/export/fleet?format=csv — export CSV flotte', async () => {
    const res = await request(app)
      .get('/api/export/fleet?format=csv')
      .set(authHeader(tokens.chief.accessToken));
    assert.strictEqual(res.status, 200);
    assert.ok(res.headers['content-type'].includes('csv'));
  });

  it('GET /api/export/sorties — export XLSX sorties', async () => {
    const res = await request(app)
      .get('/api/export/sorties')
      .set(authHeader(tokens.chief.accessToken));
    assert.strictEqual(res.status, 200);
  });

  it('GET /api/export/sorties-passengers — export passagers (requiert date)', async () => {
    const date = new Date().toISOString().split('T')[0];
    const res = await request(app)
      .get(`/api/export/sorties-passengers?date=${date}`)
      .set(authHeader(tokens.chief.accessToken));
    assert.strictEqual(res.status, 200);
  });

  it('GET /api/notifications/mine — notifications de l\'employé', async () => {
    const res = await request(app)
      .get('/api/notifications/mine')
      .set(authHeader(tokens.employee.accessToken));
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.data));
  });

  it('GET /api/notifications/unread-count — nombre non lues', async () => {
    const res = await request(app)
      .get('/api/notifications/unread-count')
      .set(authHeader(tokens.employee.accessToken));
    assert.strictEqual(res.status, 200);
    assert.ok(typeof res.body.count === 'number');
  });

  it('GET /api/sites — liste les sites', async () => {
    const res = await request(app)
      .get('/api/sites')
      .set(authHeader(tokens.chief.accessToken));
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body));
  });

  it('GET /api/health — health check', async () => {
    const res = await request(app).get('/api/health');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'ok');
  });
});