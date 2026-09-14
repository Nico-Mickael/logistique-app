const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const { app, request, db, seed, login, authHeader, close } = require('../integration/helpers');

describe('Flux Stats & Exports (intégration)', () => {
  let tokens;

  before(async () => {
    await seed();
    tokens = await loginAll();
  });

  after(async () => { await close(); });

  async function loginAll() {
    const sa = await login('superadmin@test.com', 'Test1234');
    const ch = await login('chief@test.com', 'Test1234');
    const emp = await login('employee@test.com', 'Test1234');
    return { superadmin: sa, chief: ch, employee: emp };
  }

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