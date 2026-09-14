const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const { app, request, db, seed, login, authHeader, close, getSite } = require('../integration/helpers');

describe('Flux Chauffeur (intégration)', () => {
  let tokens, sortieId;

  before(async () => {
    await seed();
    tokens = await loginAll();
    // Create a sortie assigned to the chauffeur
    const chauffeur = await db.Employee.findOne({ where: { role: 'chauffeur' } });
    const vehicle = (await db.Vehicle.findAll())[0];
    const sortie = await db.Sortie.create({
      vehicle_id: vehicle.id,
      driver_employee_id: chauffeur.id,
      driver_name: 'Pierre Chauffeur',
      destination: 'Toamasina',
      motif: 'Transport test chauffeur',
      departure_time: new Date(Date.now() + 3600000),
      status: 'planned',
      site_id: getSite().id,
    });
    sortieId = sortie.id;
  });

  after(async () => { await close(); });

  async function loginAll() {
    const sa = await login('superadmin@test.com', 'Test1234');
    const ch = await login('chief@test.com', 'Test1234');
    const drv = await login('chauffeur@test.com', 'Test1234');
    return { superadmin: sa, chief: ch, chauffeur: drv };
  }

  it('GET /api/sorties/driver/mine — chauffeur voit ses sorties', async () => {
    const res = await request(app)
      .get('/api/sorties/driver/mine')
      .set(authHeader(tokens.chauffeur.accessToken));
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.ok(res.body.find((s) => s.id === sortieId));
  });

  it('PATCH /api/sorties/:id/driver/depart — chauffeur démarre la sortie', async () => {
    const res = await request(app)
      .patch(`/api/sorties/${sortieId}/driver/depart`)
      .set(authHeader(tokens.chauffeur.accessToken))
      .send({ departure_km: 5000 });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'ongoing');
    assert.strictEqual(res.body.departure_km, 5000);
  });

  it('PATCH /api/sorties/:id/driver/arrivee — chauffeur termine la sortie', async () => {
    const res = await request(app)
      .patch(`/api/sorties/${sortieId}/driver/arrivee`)
      .set(authHeader(tokens.chauffeur.accessToken))
      .send({ arrival_km: 5200, returned_at: new Date().toISOString() });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'finished');
    assert.strictEqual(res.body.distance_km, 200);
  });

  it('PATCH /api/sorties/:id/driver/depart — employé non-chauffeur refusé', async () => {
    const emp = await login('employee@test.com', 'Test1234');
    const newSortie = await db.Sortie.create({
      vehicle_id: (await db.Vehicle.findAll())[0].id,
      driver_name: 'test',
      destination: 'Test',
      motif: 'Test',
      departure_time: new Date(Date.now() + 7200000),
      status: 'planned',
      site_id: getSite().id,
    });
    const res = await request(app)
      .patch(`/api/sorties/${newSortie.id}/driver/depart`)
      .set(authHeader(emp.accessToken))
      .send({ departure_km: 100 });
    assert.strictEqual(res.status, 403);
  });
});
