'use strict';
const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const jwt = require('jsonwebtoken');
const path = require('path');

process.env.JWT_SECRET = 'test-secret-key';

// ---------------------------------------------------------------------------
// Tables en mémoire partagées entre auth et checkRole
// ---------------------------------------------------------------------------
let fakeEmployees = [];
let fakeSessions = [];

const fakeModelsModule = {
  Session: {
    findOne: async ({ where }) => {
      const row = fakeSessions.find((s) => s.id === where.id && s.revoked === where.revoked);
      if (!row) return null;
      return { ...row, async save() { return this; } };
    },
  },
  Employee: {
    findByPk: async (id) => fakeEmployees.find((e) => e.id === id) || null,
  },
};

// Référence vers le module `models/index.js` réellement résolu
const modelsPath = path.resolve(__dirname, '../models/index.js');

let auth, checkRole;

function loadMiddlewares() {
  // Injecte le faux module `models` dans le cache require AVANT de charger les middlewares
  require.cache[modelsPath] = {
    id: modelsPath,
    filename: modelsPath,
    loaded: true,
    exports: fakeModelsModule,
  };
  delete require.cache[require.resolve('../middlewares/auth')];
  delete require.cache[require.resolve('../middlewares/checkRole')];
  auth = require('../middlewares/auth');
  checkRole = require('../middlewares/checkRole');
}

afterEach(() => {
  delete require.cache[modelsPath];
  delete require.cache[require.resolve('../middlewares/auth')];
  delete require.cache[require.resolve('../middlewares/checkRole')];
});

function mockReqRes(overrides = {}) {
  const req = { headers: {}, ip: '127.0.0.1', connection: {}, ...overrides };
  const res = { statusCode: 200 };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  return { req, res };
}

beforeEach(() => {
  fakeEmployees = [];
  fakeSessions = [
    { id: 1, revoked: false, expires_at: new Date(Date.now() + 100000), last_active_at: new Date() },
  ];
  loadMiddlewares();
});

// ---------------------------------------------------------------------------
// auth middleware
// ---------------------------------------------------------------------------
test('auth : refuse une requête sans header Authorization', async () => {
  const { req, res } = mockReqRes();
  let nextCalled = false;
  await auth(req, res, () => { nextCalled = true; });
  assert.strictEqual(res.statusCode, 401);
  assert.strictEqual(nextCalled, false);
});

test('auth : refuse un token invalide', async () => {
  const { req, res } = mockReqRes({ headers: { authorization: 'Bearer abc.invalid.token' } });
  let nextCalled = false;
  await auth(req, res, () => { nextCalled = true; });
  assert.strictEqual(res.statusCode, 401);
  assert.strictEqual(nextCalled, false);
});

test('auth : accepte un token valide et remplit req.user', async () => {
  const token = jwt.sign({ id: 3, role: 'employee', sid: 1 }, process.env.JWT_SECRET, { expiresIn: '5m' });
  const { req, res } = mockReqRes({ headers: { authorization: `Bearer ${token}` } });
  let nextCalled = false;
  await auth(req, res, () => { nextCalled = true; });
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(nextCalled, true);
  assert.strictEqual(req.user.id, 3);
  assert.strictEqual(req.user.role, 'employee');
});

test('auth : refuse une session révoquée', async () => {
  fakeSessions = [{ id: 1, revoked: true, expires_at: new Date(Date.now() + 100000), last_active_at: new Date() }];
  const token = jwt.sign({ id: 3, role: 'employee', sid: 1 }, process.env.JWT_SECRET, { expiresIn: '5m' });
  const { req, res } = mockReqRes({ headers: { authorization: `Bearer ${token}` } });
  let nextCalled = false;
  await auth(req, res, () => { nextCalled = true; });
  assert.strictEqual(res.statusCode, 401);
  assert.strictEqual(nextCalled, false);
});

// ---------------------------------------------------------------------------
// checkRole middleware
// ---------------------------------------------------------------------------
test('checkRole : refuse si le rôle de l\'utilisateur n\'est pas autorisé', async () => {
  fakeEmployees = [{ id: 3, role: 'employee' }];
  const guard = checkRole(['logistics_chief', 'superadmin']);
  const { req, res } = mockReqRes({ user: { id: 3 } });
  let nextCalled = false;
  await guard(req, res, () => { nextCalled = true; });
  assert.strictEqual(res.statusCode, 403);
  assert.strictEqual(nextCalled, false);
});

test('checkRole : autorise si le rôle de l\'utilisateur est autorisé', async () => {
  fakeEmployees = [{ id: 3, role: 'logistics_chief' }];
  const guard = checkRole(['logistics_chief', 'superadmin']);
  const { req, res } = mockReqRes({ user: { id: 3, role: 'employee' } });
  let nextCalled = false;
  await guard(req, res, () => { nextCalled = true; });
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(nextCalled, true);
  assert.strictEqual(req.user.role, 'logistics_chief', 'req.user.role mis à jour depuis la DB');
});

test('checkRole : refuse si le compte est introuvable (supprimé)', async () => {
  fakeEmployees = [];
  const guard = checkRole(['logistics_chief', 'superadmin']);
  const { req, res } = mockReqRes({ user: { id: 999 } });
  let nextCalled = false;
  await guard(req, res, () => { nextCalled = true; });
  assert.strictEqual(res.statusCode, 401);
  assert.strictEqual(nextCalled, false);
});
