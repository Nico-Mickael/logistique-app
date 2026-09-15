const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const { app, request, seed, authHeader, close, loginAll, CHAUFFEUR } = require('../integration/helpers');

describe('Flux Employés (intégration)', () => {
  let tokens, employeeId;

  before(async () => {
    await seed();
    tokens = await loginAll();
  });

  after(async () => { await close(); });

  it('POST /api/employees — superadmin crée un employé', async () => {
    const res = await request(app)
      .post('/api/employees')
      .set(authHeader(tokens.superadmin.accessToken))
      .send({ nom: 'TestEmployee', prenom: 'Nouveau', email: 'newemp@test.com', password: 'Test1234', department: 'RH', role: 'employee' });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.email, 'newemp@test.com');
    employeeId = res.body.id;
  });

  it('GET /api/employees — superadmin voit tous les employés', async () => {
    const res = await request(app)
      .get('/api/employees')
      .set(authHeader(tokens.superadmin.accessToken));
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.length >= 1);
    assert.ok(res.body.find((e) => e.id === employeeId));
  });

  it('PUT /api/employees/:id — superadmin modifie un employé', async () => {
    const res = await request(app)
      .put(`/api/employees/${employeeId}`)
      .set(authHeader(tokens.superadmin.accessToken))
      .send({ nom: 'TestEmployee', prenom: 'Modifié', department: 'IT' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.prenom, 'Modifié');
    assert.strictEqual(res.body.department, 'IT');
  });

  it('GET /api/employees/chauffeurs — liste les chauffeurs', async () => {
    const res = await request(app)
      .get('/api/employees/chauffeurs')
      .set(authHeader(tokens.chief.accessToken));
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.ok(res.body.some((e) => e.email === CHAUFFEUR.email));
  });

  it('DELETE /api/employees/:id — superadmin supprime un employé', async () => {
    const res = await request(app)
      .delete(`/api/employees/${employeeId}`)
      .set(authHeader(tokens.superadmin.accessToken));
    assert.strictEqual(res.status, 200);
  });

  it('GET /api/employees — employé supprimé n\'apparaît plus', async () => {
    const res = await request(app)
      .get('/api/employees')
      .set(authHeader(tokens.superadmin.accessToken));
    assert.ok(!res.body.find((e) => e.id === employeeId));
  });

  it('POST /api/employees — chef non-superadmin refusé', async () => {
    const res = await request(app)
      .post('/api/employees')
      .set(authHeader(tokens.chief.accessToken))
      .send({ nom: 'Fail', prenom: 'Test', email: 'fail@test.com', password: 'Test1234', role: 'employee' });
    assert.strictEqual(res.status, 403);
  });
});
