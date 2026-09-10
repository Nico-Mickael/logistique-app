'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { rateLimit } = require('../middlewares/rateLimiter');

function makeReq(ip, body = {}) {
  return { ip, body, headers: {} };
}

function makeRes() {
  const headers = {};
  return {
    headers,
    statusCode: null,
    setHeader(name, value) { headers[name] = value; },
    json() { return this; },
    status(code) { this.statusCode = code; return this; },
  };
}

// Le limiter répond SOIT par next(), SOIT par res.status(x).json(...).
// Le promise de run() doit se résoudre dans les deux cas, sinon un
// `await run(...)` sur un refus (429) ne rendrait jamais la main.
function run(middleware, req, res) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };

    const origStatus = res.status.bind(res);
    const origJson = res.json.bind(res);
    res.status = (code) => {
      res.statusCode = code;
      return { json: (payload) => { finish({ status: code, payload }); return res; } };
    };
    res.json = (payload) => { origJson(payload); finish({ json: payload }); return res; };

    middleware(req, res, () => finish({ next: true }));
    res.status = origStatus;
    res.json = origJson;
  });
}

test('limite par IP : renvoie 429 après max tentatives', async () => {
  const mw = rateLimit({ windowMs: 60 * 1000, max: 2 });
  const res = makeRes();

  assert.deepStrictEqual(await run(mw, makeReq('1.1.1.1'), makeRes()), { next: true });
  assert.deepStrictEqual(await run(mw, makeReq('1.1.1.1'), makeRes()), { next: true });

  const third = makeRes();
  const refused = await run(mw, makeReq('1.1.1.1'), third);
  assert.strictEqual(refused.status, 429);
  assert.strictEqual(third.statusCode, 429);

  // Une autre IP n'est pas affectée (bucket distinct)
  assert.deepStrictEqual(await run(mw, makeReq('2.2.2.2'), makeRes()), { next: true });
});

test('limite par compte (keyGenerator) : isolation entre emails sur la même IP', async () => {
  const mw = rateLimit({
    windowMs: 60 * 1000,
    max: 2,
    keyGenerator: (req) => `${req.ip}|${String(req.body?.email || '').trim().toLowerCase()}`,
  });

  const base = { ip: '9.9.9.9' };

  // Email A : 2 tentatives autorisées, la 3e bloquée
  await run(mw, makeReq(base.ip, { email: 'admin@ades.mg' }), makeRes());
  await run(mw, makeReq(base.ip, { email: 'admin@ades.mg' }), makeRes());
  const blockedA = makeRes();
  const refused = await run(mw, makeReq(base.ip, { email: 'admin@ades.mg' }), blockedA);
  assert.strictEqual(refused.status, 429);

  // Email B (même IP) : toujours autorisé — la protection est par compte, pas globale
  const okB = makeRes();
  assert.deepStrictEqual(await run(mw, makeReq(base.ip, { email: 'other@ades.mg' }), okB), { next: true });

  // La casse ne crée pas de contournement (email normalisé en minuscules)
  const caseOk = makeRes();
  const refusedCase = await run(mw, makeReq(base.ip, { email: 'ADMIN@ades.mg' }), caseOk);
  assert.strictEqual(refusedCase.status, 429);
});

test('expose les en-têtes X-RateLimit', async () => {
  const mw = rateLimit({ windowMs: 60 * 1000, max: 5 });
  const res = makeRes();
  await run(mw, makeReq('3.3.3.3'), res);
  assert.strictEqual(res.headers['X-RateLimit-Limit'], 5);
  assert.strictEqual(res.headers['X-RateLimit-Remaining'], 4);
  assert.ok(res.headers['X-RateLimit-Reset']);
});