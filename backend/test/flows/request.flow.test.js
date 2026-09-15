const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const { app, request, db, seed, authHeader, close, loginAll } = require('../integration/helpers');

describe('Flux Demandes (intégration)', () => {
  let tokens, sortieId, requestId;

  before(async () => {
    await seed();
    tokens = await loginAll();
  });

  after(async () => { await close(); });

  it('POST /api/requests — employé crée une demande', async () => {
    const vehicle = (await db.Vehicle.findOne({ order: [['id', 'ASC']] }));
    const res = await request(app)
      .post('/api/requests')
      .set(authHeader(tokens.employee.accessToken))
      .send({
        destination: 'Antananarivo',
        motif: 'Réunion partenaire',
        date_souhaitee: new Date(Date.now() + 86400000 * 2).toISOString(),
        nb_personnes: 2,
        vehicle_id: vehicle.id,
      });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.status, 'pending');
    assert.strictEqual(res.body.destination, 'Antananarivo');
    requestId = res.body.id;
  });

  it('GET /api/requests/mine — employé voit ses demandes', async () => {
    const res = await request(app)
      .get('/api/requests/mine')
      .set(authHeader(tokens.employee.accessToken));
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.length >= 1);
    assert.ok(res.body.find((r) => r.id === requestId));
  });

  it('GET /api/requests — chef voit toutes les demandes', async () => {
    const res = await request(app)
      .get('/api/requests')
      .set(authHeader(tokens.chief.accessToken));
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.total >= 1);
  });

  it('PATCH /api/requests/:id/status — chef approuve la demande', async () => {
    const res = await request(app)
      .patch(`/api/requests/${requestId}/status`)
      .set(authHeader(tokens.chief.accessToken))
      .send({ status: 'approved' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'approved');
  });

  it('GET /api/requests/to-process — chef voit les demandes validées sans sortie', async () => {
    const res = await request(app)
      .get('/api/requests/to-process')
      .set(authHeader(tokens.chief.accessToken));
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body));
  });

  it('POST /api/requests/:id/assign — chef affecte un véhicule et crée une sortie', async () => {
    const vehicle = (await db.Vehicle.findOne({ order: [['id', 'ASC']] }));
    const res = await request(app)
      .post(`/api/requests/${requestId}/assign`)
      .set(authHeader(tokens.chief.accessToken))
      .send({ vehicle_id: vehicle.id });
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.sortie);
    sortieId = res.body.sortie.id;
  });

  it('GET /api/sorties — la sortie est visible dans la liste', async () => {
    const res = await request(app)
      .get('/api/sorties')
      .set(authHeader(tokens.chief.accessToken));
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.data.find((s) => s.id === sortieId));
  });

  it('PATCH /api/sorties/:id/depart — chef démarre la sortie avec km de départ', async () => {
    const res = await request(app)
      .patch(`/api/sorties/${sortieId}/depart`)
      .set(authHeader(tokens.chief.accessToken))
      .send({ departure_km: 0 });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'ongoing');
    assert.strictEqual(res.body.departure_km, 0);
  });

  it('PATCH /api/sorties/:id/arrivee — chef termine la sortie avec km', async () => {
    const res = await request(app)
      .patch(`/api/sorties/${sortieId}/arrivee`)
      .set(authHeader(tokens.chief.accessToken))
      .send({ arrival_km: 150, returned_at: new Date().toISOString() });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'finished');
    assert.strictEqual(res.body.distance_km, 150);
  });

  it('PATCH /api/requests/:id/cancel — employé annule une demande', async () => {
    // Create a new request to cancel
    const vehicle = (await db.Vehicle.findOne({ order: [['id', 'ASC']] }));
    const createRes = await request(app)
      .post('/api/requests')
      .set(authHeader(tokens.employee.accessToken))
      .send({
        destination: 'Toamasina',
        motif: 'Annulation test',
        date_souhaitee: new Date(Date.now() + 86400000 * 5).toISOString(),
        nb_personnes: 1,
        vehicle_id: vehicle.id,
      });
    assert.strictEqual(createRes.status, 201);

    const res = await request(app)
      .patch(`/api/requests/${createRes.body.id}/cancel`)
      .set(authHeader(tokens.employee.accessToken));
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'cancelled');
  });

  it('PATCH /api/requests/:id/status — chef refuse une demande', async () => {
    const vehicle = (await db.Vehicle.findOne({ order: [['id', 'ASC']] }));
    const createRes = await request(app)
      .post('/api/requests')
      .set(authHeader(tokens.employee.accessToken))
      .send({
        destination: 'Fianarantsoa',
        motif: 'Refus test',
        date_souhaitee: new Date(Date.now() + 86400000 * 6).toISOString(),
        nb_personnes: 1,
        vehicle_id: vehicle.id,
      });
    assert.strictEqual(createRes.status, 201);

    const res = await request(app)
      .patch(`/api/requests/${createRes.body.id}/status`)
      .set(authHeader(tokens.chief.accessToken))
      .send({ status: 'rejected' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'rejected');
  });

  it('DELETE /api/requests/:id — employé supprime sa demande', async () => {
    const vehicle = (await db.Vehicle.findOne({ order: [['id', 'ASC']] }));
    const createRes = await request(app)
      .post('/api/requests')
      .set(authHeader(tokens.employee.accessToken))
      .send({
        destination: 'Mahajanga',
        motif: 'Suppression test',
        date_souhaitee: new Date(Date.now() + 86400000 * 7).toISOString(),
        nb_personnes: 1,
        vehicle_id: vehicle.id,
      });
    assert.strictEqual(createRes.status, 201);

    const res = await request(app)
      .delete(`/api/requests/${createRes.body.id}`)
      .set(authHeader(tokens.employee.accessToken));
    assert.strictEqual(res.status, 200);
  });
});
