const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const bcrypt = require('bcrypt');
const { app, request, db, seed, authHeader, close, loginAll } = require('../integration/helpers');

describe('Flux Disponibilité (intégration)', () => {
  let tokens, site;

  before(async () => {
    ({ site } = await seed());
    tokens = await loginAll();
  });

  after(async () => { await close(); });

  it('GET /api/auth/me — un utilisateur est disponible par défaut', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set(authHeader(tokens.employee.accessToken));
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.availability_status, 'available');
    assert.strictEqual(res.body.leave_start_date, null);
    assert.strictEqual(res.body.leave_end_date, null);
  });

  it('PATCH /api/auth/me/availability — passe en hors ligne', async () => {
    const res = await request(app)
      .patch('/api/auth/me/availability')
      .set(authHeader(tokens.employee.accessToken))
      .send({ availability_status: 'offline' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.availability_status, 'offline');

    const me = await request(app)
      .get('/api/auth/me')
      .set(authHeader(tokens.employee.accessToken));
    assert.strictEqual(me.status, 200);
    assert.strictEqual(me.body.availability_status, 'offline');
  });

  it('PATCH /api/auth/me/availability — congé sans dates refusé', async () => {
    const res = await request(app)
      .patch('/api/auth/me/availability')
      .set(authHeader(tokens.employee.accessToken))
      .send({ availability_status: 'on_leave', leave_start_date: null, leave_end_date: null });
    assert.strictEqual(res.status, 400);
    assert.ok(/date/i.test(res.body.message));
  });

  it('PATCH /api/auth/me/availability — congé avec dates correctes accepté', async () => {
    const res = await request(app)
      .patch('/api/auth/me/availability')
      .set(authHeader(tokens.employee.accessToken))
      .send({ availability_status: 'on_leave', leave_start_date: '2026-09-15', leave_end_date: '2026-09-25' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.availability_status, 'on_leave');
    assert.strictEqual(res.body.leave_start_date, '2026-09-15');
    assert.strictEqual(res.body.leave_end_date, '2026-09-25');
  });

  it('PATCH /api/auth/me/availability — retour à available vide les dates', async () => {
    const res = await request(app)
      .patch('/api/auth/me/availability')
      .set(authHeader(tokens.employee.accessToken))
      .send({ availability_status: 'available' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.availability_status, 'available');
    assert.strictEqual(res.body.leave_start_date, null);
    assert.strictEqual(res.body.leave_end_date, null);
  });

  it('PATCH /api/auth/me/availability — statut invalide refusé', async () => {
    const res = await request(app)
      .patch('/api/auth/me/availability')
      .set(authHeader(tokens.employee.accessToken))
      .send({ availability_status: 'en_vacances' });
    assert.strictEqual(res.status, 400);
    assert.ok(/invalide/i.test(res.body.message));
  });

  it('PUT /api/employees/:id — superadmin peut modifier la disponibilité d\'un chauffeur', async () => {
    const chauffeur = await db.Employee.findOne({ where: { email: 'chauffeur@test.com' } });
    const res = await request(app)
      .put(`/api/employees/${chauffeur.id}`)
      .set(authHeader(tokens.superadmin.accessToken))
      .send({ availability_status: 'absent' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.availability_status, 'absent');
  });

  it('GET /api/employees/chauffeurs — un chauffeur absent est listé avec son statut', async () => {
    const res = await request(app)
      .get('/api/employees/chauffeurs')
      .set(authHeader(tokens.chief.accessToken));
    assert.strictEqual(res.status, 200);
    const chauffeur = res.body.find((c) => c.email === 'chauffeur@test.com');
    assert.ok(chauffeur);
    assert.strictEqual(chauffeur.availability_status, 'absent');
  });

  it('GET /api/employees/chauffeurs — un chauffeur dont le congé est terminé redevient disponible', async () => {
    const hashedPw = await bcrypt.hash('Test1234', 10);
    const returned = await db.Employee.create({
      nom: 'AutoRetour', prenom: 'Test', email: `autoretour-${Date.now()}@test.com`,
      password: hashedPw, department: 'Logistique', role: 'chauffeur', site_id: site.id,
      availability_status: 'on_leave',
      leave_start_date: '2026-09-01',
      leave_end_date: '2026-09-30',
    });
    const res = await request(app)
      .get('/api/employees/chauffeurs')
      .set(authHeader(tokens.chief.accessToken));
    assert.strictEqual(res.status, 200);
    const c = res.body.find((e) => e.id === returned.id);
    assert.ok(c);
    // On est au 16/09/2026 ; le congé finit le 30/09 → on_leave actif.
    assert.strictEqual(c.availability_status, 'on_leave');

    // On force une date de retour passée pour tester l'auto-retour (evalué au read).
    await db.Employee.update({ leave_end_date: '2020-01-01' }, { where: { id: returned.id } });
    const res2 = await request(app)
      .get('/api/employees/chauffeurs')
      .set(authHeader(tokens.chief.accessToken));
    assert.strictEqual(res2.status, 200);
    const c2 = res2.body.find((e) => e.id === returned.id);
    assert.strictEqual(c2.availability_status, 'available', 'auto-retour au jour J');
  });

  it('POST /api/sorties — chauffeur indiqué indisponible par le superadmin refusé', async () => {
    // Le chauffeur a été mis en 'absent' par le superadmin précédemment.
    const chauffeur = await db.Employee.findOne({ where: { email: 'chauffeur@test.com' } });
    const vehicle = (await db.Vehicle.findOne({ order: [['id', 'ASC']] }));
    const res = await request(app)
      .post('/api/sorties')
      .set(authHeader(tokens.chief.accessToken))
      .send({
        vehicle_id: vehicle.id,
        driver_name: 'Chauffeur Test',
        driver_employee_id: chauffeur.id,
        destination: 'Fianarantsoa',
        motif: 'Test indispo admin',
        departure_time: new Date(Date.now() + 3600000).toISOString(),
      });
    assert.strictEqual(res.status, 400);
    assert.ok(/indisponible/i.test(res.body.message));
  });
});
