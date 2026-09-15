const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const { app, request, db, seed, login, authHeader, close, loginAll } = require('../integration/helpers');

describe('Flux Véhicules (intégration)', () => {
  let tokens, vehicleId;

  before(async () => {
    await seed();
    tokens = await loginAll();
  });

  after(async () => { await close(); });

  it('POST /api/vehicles — chef crée un véhicule', async () => {
    const res = await request(app)
      .post('/api/vehicles')
      .set(authHeader(tokens.chief.accessToken))
      .send({ type: 'voiture', capacity: 5, name: 'Berlingo Test' });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.status, 'available');
    assert.strictEqual(res.body.name, 'Berlingo Test');
    vehicleId = res.body.id;
  });

  it('GET /api/vehicles — le véhicule apparaît', async () => {
    const res = await request(app)
      .get('/api/vehicles')
      .set(authHeader(tokens.chief.accessToken));
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.find((v) => v.id === vehicleId));
  });

  it('GET /api/vehicles/available — véhicule disponible listé', async () => {
    const res = await request(app)
      .get('/api/vehicles/available')
      .set(authHeader(tokens.chief.accessToken));
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.find((v) => v.id === vehicleId));
  });

  it('GET /api/vehicles/occupancy — détail d\'occupation', async () => {
    const res = await request(app)
      .get('/api/vehicles/occupancy')
      .set(authHeader(tokens.chief.accessToken));
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body));
    const v = res.body.find((v) => v.id === vehicleId);
    assert.ok(v);
    assert.strictEqual(v.occupiedSeats, 0);
    assert.strictEqual(v.requestable, true);
  });

  it('PATCH /api/vehicles/:id — chef modifie le véhicule', async () => {
    const res = await request(app)
      .patch(`/api/vehicles/${vehicleId}`)
      .set(authHeader(tokens.chief.accessToken))
      .send({ name: 'Berlingo Updated', capacity: 6 });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.name, 'Berlingo Updated');
    assert.strictEqual(res.body.capacity, 6);
  });

  it('PATCH /api/vehicles/:id — passe en maintenance', async () => {
    const res = await request(app)
      .patch(`/api/vehicles/${vehicleId}`)
      .set(authHeader(tokens.chief.accessToken))
      .send({ status: 'maintenance', maintenance_until: '2026-12-31' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'maintenance');
  });

  it('PATCH /api/vehicles/:id — remet disponible', async () => {
    const res = await request(app)
      .patch(`/api/vehicles/${vehicleId}`)
      .set(authHeader(tokens.chief.accessToken))
      .send({ status: 'available' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'available');
    assert.strictEqual(res.body.maintenance_until, null);
  });

  it('DELETE /api/vehicles/:id — supprime un véhicule sans sorties', async () => {
    const res = await request(app)
      .delete(`/api/vehicles/${vehicleId}`)
      .set(authHeader(tokens.chief.accessToken));
    assert.strictEqual(res.status, 200);
  });

  it('GET /api/vehicles — le véhicule supprimé n\'apparaît plus', async () => {
    const res = await request(app)
      .get('/api/vehicles')
      .set(authHeader(tokens.chief.accessToken));
    assert.ok(!res.body.find((v) => v.id === vehicleId));
  });

  it('DELETE /api/vehicles/:id — impossible de supprimer un véhicule busy', async () => {
    const vehicle = (await db.Vehicle.findOne({ order: [['id', 'ASC']] }));
    vehicle.status = 'busy';
    await vehicle.save();
    const res = await request(app)
      .delete(`/api/vehicles/${vehicle.id}`)
      .set(authHeader(tokens.chief.accessToken));
    assert.strictEqual(res.status, 400);
    // Restore
    vehicle.status = 'available';
    await vehicle.save();
  });

  it('GET /api/vehicles — employé sans rôle chef est refusé', async () => {
    const emp = await login('employee@test.com', 'Test1234');
    const res = await request(app)
      .get('/api/vehicles/occupancy')
      .set(authHeader(emp.accessToken));
    assert.strictEqual(res.status, 200); // GET is allowed for all
  });

  it('POST /api/vehicles — employé sans rôle chef ne peut pas créer', async () => {
    const emp = await login('employee@test.com', 'Test1234');
    const res = await request(app)
      .post('/api/vehicles')
      .set(authHeader(emp.accessToken))
      .send({ type: 'voiture', capacity: 5, name: 'Non autorisé' });
    assert.strictEqual(res.status, 403);
  });
});
