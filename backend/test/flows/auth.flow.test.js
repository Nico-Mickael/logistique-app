const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const { app, request, db, SUPERADMIN, CHIEF, EMPLOYEE, seed, login, authHeader, close, getSite } = require('../integration/helpers');

describe('Flux Auth (intégration)', () => {
  let tokens;

  before(async () => {
    const data = await seed();
    tokens = await loginAll();
  });

  after(async () => { await close(); });

  async function loginAll() {
    const sa = await login(SUPERADMIN.email, SUPERADMIN.password);
    const ch = await login(CHIEF.email, CHIEF.password);
    const emp = await login(EMPLOYEE.email, EMPLOYEE.password);
    return { superadmin: sa, chief: ch, employee: emp };
  }

  it('POST /api/auth/login — connecte avec de bons identifiants', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: SUPERADMIN.email, password: SUPERADMIN.password });
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.accessToken);
    assert.ok(res.body.refreshToken);
    assert.strictEqual(res.body.user.email, SUPERADMIN.email);
    assert.strictEqual(res.body.user.role, 'superadmin');
  });

  it('POST /api/auth/login — refuse les mauvais identifiants', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: SUPERADMIN.email, password: 'mauvais' });
    assert.strictEqual(res.status, 401);
  });

  it('POST /api/auth/login — refuse un email inexistant', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@test.com', password: 'Test1234' });
    assert.strictEqual(res.status, 401);
  });

  it('GET /api/auth/me — retourne le profil utilisateur', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set(authHeader(tokens.superadmin.accessToken));
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.email, SUPERADMIN.email);
    assert.strictEqual(res.body.role, 'superadmin');
  });

  it('GET /api/auth/me — refuse sans token', async () => {
    const res = await request(app).get('/api/auth/me');
    assert.strictEqual(res.status, 401);
  });

  it('POST /api/auth/refresh — rafraîchit le token', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: tokens.superadmin.refreshToken });
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.accessToken);
    assert.ok(res.body.refreshToken);
  });

  it('POST /api/auth/refresh — refuse un refresh token invalide', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'token_invalide' });
    assert.strictEqual(res.status, 401);
  });

  it('GET /api/auth/sessions — liste les sessions', async () => {
    const res = await request(app)
      .get('/api/auth/sessions')
      .set(authHeader(tokens.superadmin.accessToken));
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.ok(res.body.length >= 1);
    const current = res.body.find((s) => s.current);
    assert.ok(current);
  });

  it('POST /api/auth/logout — déconnecte et révoque la session', async () => {
    const loginRes = await login(SUPERADMIN.email, SUPERADMIN.password);
    const res = await request(app)
      .post('/api/auth/logout')
      .set(authHeader(loginRes.accessToken))
      .send({ refreshToken: loginRes.refreshToken });
    assert.strictEqual(res.status, 200);
  });

  it('POST /api/auth/register — crée un compte (superadmin)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set(authHeader(tokens.superadmin.accessToken))
      .send({ nom: 'Test', prenom: 'Register', email: 'register@test.com', password: 'Test1234', department: 'IT', role: 'employee', siteId: getSite().id });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.email, 'register@test.com');
  });

  it('POST /api/auth/register — refuse un email déjà utilisé', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set(authHeader(tokens.superadmin.accessToken))
      .send({ nom: 'Dup', prenom: 'Email', email: SUPERADMIN.email, password: 'Test1234', department: 'IT' });
    assert.strictEqual(res.status, 400);
  });
});